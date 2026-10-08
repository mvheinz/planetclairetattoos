#!/usr/bin/env bash
# =============================================================================
# scripts/cloud-setup.sh – Claude-Code-Cloud-Umgebung „planetclaire“
# Doku: docs/CLOUD-SETUP.md (Einrichtung, Ablauf, Fehlerbehebung, Quellen)
# -----------------------------------------------------------------------------
# Modi:
#
#   bash scripts/cloud-setup.sh [--provision]
#       PROVISIONIERUNG. Wird vom Setup-Skript der Umgebung aufgerufen (dort steht
#       nur der kurze Starter aus docs/CLOUD-SETUP.md, Block C). Läuft als root auf
#       Ubuntu 24.04, bevor Claude Code startet. Der Dateisystem-Stand wird nur
#       gecacht, wenn das Setup in ca. 5 Minuten fertig ist → Budget hier 270 s.
#       Installiert Node 24 (nodejs.org, SHA-256 geprüft), pnpm (corepack),
#       richtet Postgres ein (Rolle postgres/postgres, DBs planetclaire +
#       planetclaire_test), installiert Playwright-Chromium und -WebKit inkl.
#       Systembibliotheken und wärmt den pnpm-Store vor. Was nicht ins Budget
#       passt, holt der SessionStart-Hook nach.
#
#   bash scripts/cloud-setup.sh --session-start
#       SESSIONSTART-HOOK (.claude/settings.json). Läuft bei jedem Start, Resume,
#       Compact – tut aber nur etwas, wenn CLAUDE_CODE_REMOTE=true (Cloud-Session)
#       oder CLOUD_SETUP_FORCE=1 (nur Linux). Startet Postgres, legt .env an,
#       pnpm install --frozen-lockfile (nur wenn nötig), Playwright-Browser (nur
#       wenn nötig), Git-/PR-Überblick, PLAN-Stand. stdout = kurze Zusammenfassung
#       (Kontext für Claude), Details: /tmp/planetclaire-session-start.log.
#
#   bash scripts/cloud-setup.sh --check
#       DIAGNOSE. Ändert nichts. Versionen, Dienste, Netzwerk-Erreichbarkeit.
#
#   bash scripts/cloud-setup.sh --plan-status
#       Offene/gesamte Checkboxen in PLAN.md je Phase, Zeile OFFEN_P1_P10=<n>
#       und die nächste offene Aufgabe (läuft auch lokal unter Git Bash).
#
# Idempotent. Endet IMMER mit Exit-Code 0 (ein Fehler im Setup-Skript würde sonst
# den Start der Session verhindern); Probleme erscheinen als „WARNUNG“.
# Keine Geheimnisse in dieser Datei – Setup-Skripte sind für alle Nutzer der
# Umgebung lesbar.
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------- Konstanten --
readonly NODE_MAJOR="24"
# Gepinnt am 26.09.2026: neueste 24.x laut https://nodejs.org/dist/index.json.
# Prüfsummen aus https://nodejs.org/dist/v24.21.0/SHASUMS256.txt.
# Andere Version testen: CLOUD_SETUP_NODE_VERSION=24.x.y (Prüfsumme dann aus SHASUMS256.txt).
readonly NODE_VERSION_PIN="24.21.0"
readonly NODE_SHA256_PIN_LINUX_X64_XZ="fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6"
readonly NODE_SHA256_PIN_LINUX_X64_GZ="6e1db87ef58b8819e5d5402eff1536491b18edd8eb7bee5ef7897876e88dc5ff"
readonly NODE_DIR="/opt/node${NODE_MAJOR}"
readonly PNPM_VERSION_FALLBACK="10.34.5"       # maßgeblich ist "packageManager" in package.json
readonly PLAYWRIGHT_VERSION_FALLBACK="1.58.2"  # maßgeblich ist "@playwright/test" in package.json
readonly PW_BROWSERS_DIR_DEFAULT="/opt/ms-playwright"
readonly PW_REQUIRED_BROWSER="chromium"        # Pflicht (E2E, Vorschau-Export, KUNST-QA)
readonly PW_OPTIONAL_BROWSER="webkit"          # iPhone-Projekt; fehlt es → PW_SKIP_WEBKIT=1
readonly DB_HOST="127.0.0.1"
readonly DB_PORT="5432"
readonly DB_USER="postgres"
readonly DB_PASSWORD="postgres"                # nur lokale Entwicklungs-DB in der Wegwerf-VM
readonly DB_MAIN="planetclaire"
readonly DB_TEST="planetclaire_test"
readonly SESSION_LOG="/tmp/planetclaire-session-start.log"
readonly WARM_DIR="/var/tmp/planetclaire-warm"
readonly DEPS_STAMP_NAME=".planetclaire-deps-hash"
readonly ENV_MARKER="# planetclaire: scripts/cloud-setup.sh"
readonly REPO_NAME_PATTERN='"name"[[:space:]]*:[[:space:]]*"planetclairetattoos"'

MODE="provision"
case "${1:-}" in
  "" | --provision) MODE="provision" ;;
  --session-start) MODE="session" ;;
  --check) MODE="check" ;;
  --plan-status) MODE="plan" ;;
  -h | --help)
    sed -n '2,37p' "${BASH_SOURCE[0]:-$0}" 2>/dev/null || true
    exit 0
    ;;
  *)
    echo "cloud-setup: unbekannte Option '$1' (erlaubt: --provision, --session-start, --check, --plan-status, --help)" >&2
    exit 0
    ;;
esac

# Zeitbudget je Modus (Sekunden seit Skriptstart, bash-Variable SECONDS).
case "$MODE" in
  provision) BUDGET_S=270 ;;  # Setup-Cache nur bei < ~300 s
  session) BUDGET_S=1080 ;;   # Hook-Timeout in .claude/settings.json: 1200 s
  *) BUDGET_S=120 ;;
esac

WARNINGS=()
REPO=""
NODE_STATUS="?"
PNPM_STATUS="?"
DB_STATUS="?"
DEPS_STATUS="?"
PW_STATUS="?"
DOTENV_STATUS="?"
GIT_BRANCH="?"
GIT_OTHER=""
GH_REPO_DETECTED=""
OPEN_PRS="?"
PW_WEBKIT_STATE="unbekannt" # bereit | fehlgeschlagen | unbekannt

# corepack darf nie interaktiv nachfragen (Hook/Setup haben kein Terminal).
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 COREPACK_ENABLE_AUTO_PIN=0

# Nie mit Fehlercode enden (Setup-Skript: Session würde nicht starten; Hook: nur Rauschen).
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    printf '[cloud-setup] WARNUNG: unerwarteter Abbruch (Code %s). Siehe docs/CLOUD-SETUP.md §5.\n' "$rc" >&2
    if [ "$MODE" = "session" ]; then
      printf '## Cloud-Umgebung: SessionStart-Hook scripts/cloud-setup.sh wurde mit Code %s abgebrochen; Zustand unklar. Diagnose: bash scripts/cloud-setup.sh --check (Log: %s)\n' "$rc" "$SESSION_LOG"
    fi
  fi
  exit 0
}
trap on_exit EXIT

# ------------------------------------------------------------------ Logging --
# fd 3 = Detail-Log. Provisionierung/Check: stderr. Session-Start: Logdatei
# (stdout ist dort Kontext für Claude und muss kurz bleiben).
exec 3>&2

log() { printf '[cloud-setup %s] %s\n' "$(date +%H:%M:%S)" "$*" >&3; }
warn() {
  WARNINGS+=("$*")
  log "WARNUNG: $*"
}
have() { command -v "$1" >/dev/null 2>&1; }
is_root() { [ "$(id -u 2>/dev/null || echo 1)" -eq 0 ]; }
is_linux() { [ "$(uname -s 2>/dev/null || echo unknown)" = "Linux" ]; }

as_root() {
  if is_root; then
    "$@"
  elif have sudo && sudo -n true >/dev/null 2>&1; then
    sudo -n "$@"
  else
    return 1
  fi
}

as_postgres() {
  if is_root; then
    if have runuser; then
      runuser -u postgres -- "$@"
    else
      su postgres -s /bin/sh -c "$(printf '%q ' "$@")"
    fi
  elif have sudo && sudo -n true >/dev/null 2>&1; then
    sudo -n -u postgres "$@"
  else
    return 1
  fi
}

# budget <Wunsch-Sekunden>: höchstens die Restzeit bis BUDGET_S, mindestens 5 s.
budget() {
  local want="$1" r=0
  r=$((BUDGET_S - SECONDS))
  if [ "$r" -gt "$want" ]; then r="$want"; fi
  if [ "$r" -lt 5 ]; then r=5; fi
  echo "$r"
}

# limited <Sekunden> <Befehl…>: mit Zeitgrenze (TERM, nach 10 s KILL), falls `timeout` existiert.
limited() {
  local s="$1"
  shift
  if have timeout; then
    timeout -k 10 "$s" "$@"
  else
    "$@"
  fi
}

# --------------------------------------------------------------- Repository --
is_repo_dir() {
  [ -n "${1:-}" ] && [ -f "$1/package.json" ] &&
    grep -q "$REPO_NAME_PATTERN" "$1/package.json" 2>/dev/null
}

find_repo() {
  local script_dir="" candidate="" found="" d=""
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
  for candidate in "${CLAUDE_PROJECT_DIR:-}" "${script_dir%/scripts}" "$PWD" \
    "$(git rev-parse --show-toplevel 2>/dev/null || true)"; do
    if is_repo_dir "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  # Arbeitsverzeichnis des Setup-Skripts ist nicht dokumentiert → übliche Orte durchsuchen.
  for d in /home /root /workspace /workspaces /code /repo /repos /srv /mnt /tmp; do
    [ -d "$d" ] || continue
    found="$(find "$d" -maxdepth 4 -name package.json -not -path '*/node_modules/*' 2>/dev/null |
      xargs -r grep -l "$REPO_NAME_PATTERN" 2>/dev/null | head -n 1 || true)"
    if [ -n "$found" ]; then
      dirname "$found"
      return 0
    fi
  done
  return 1
}

repo_pnpm_version() {
  local v=""
  if [ -n "$REPO" ] && [ -f "$REPO/package.json" ]; then
    v="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([0-9][0-9.]*\).*/\1/p' "$REPO/package.json" | head -n 1 || true)"
  fi
  echo "${v:-$PNPM_VERSION_FALLBACK}"
}

repo_playwright_version() {
  local v=""
  if [ -n "$REPO" ] && [ -f "$REPO/package.json" ]; then
    v="$(sed -n 's/.*"@playwright\/test"[[:space:]]*:[[:space:]]*"[~^]\{0,1\}\([0-9][0-9.]*\)".*/\1/p' "$REPO/package.json" | head -n 1 || true)"
  fi
  echo "${v:-$PLAYWRIGHT_VERSION_FALLBACK}"
}

# ------------------------------------------------------------------- Node 24 --
node_platform() {
  case "$(uname -m)" in
    x86_64 | amd64) echo "linux-x64" ;;
    aarch64 | arm64) echo "linux-arm64" ;;
    *) return 1 ;;
  esac
}

ensure_node24() {
  local want="${CLOUD_SETUP_NODE_VERSION:-$NODE_VERSION_PIN}" cur=""
  if [ -x "$NODE_DIR/bin/node" ]; then
    cur="$("$NODE_DIR/bin/node" --version 2>/dev/null || true)"
    if [ "$cur" = "v$want" ]; then
      log "Node $cur liegt bereits in $NODE_DIR"
      return 0
    fi
    # Ein echtes Verzeichnis (kein Symlink von uns) mit 24.x wäre vorinstalliert → nutzen.
    if [ -z "${CLOUD_SETUP_NODE_VERSION:-}" ] && [ ! -L "$NODE_DIR" ] && [ "${cur#v"$NODE_MAJOR".}" != "$cur" ]; then
      log "Vorinstalliertes Node $cur in $NODE_DIR wird genutzt"
      return 0
    fi
  fi
  if [ -e "$NODE_DIR" ] && [ ! -L "$NODE_DIR" ]; then
    warn "$NODE_DIR existiert, ist aber kein Node $NODE_MAJOR – nutze vorinstalliertes Node"
    return 1
  fi
  if ! is_root && [ ! -w /opt ]; then
    warn "Node $want nicht installierbar (kein root, /opt nicht beschreibbar) – nutze vorinstalliertes Node"
    return 1
  fi
  if ! have curl || ! have tar || ! have sha256sum; then
    warn "curl/tar/sha256sum fehlen – Node $want nicht installiert"
    return 1
  fi
  local plat="" ext="tar.xz" tflag="J" name="" base="" tmp="" expected="" actual=""
  plat="$(node_platform)" || {
    warn "CPU-Architektur $(uname -m) nicht unterstützt – nutze vorinstalliertes Node"
    return 1
  }
  if ! have xz; then
    ext="tar.gz"
    tflag="z"
  fi
  name="node-v${want}-${plat}"
  base="https://nodejs.org/dist/v${want}"
  tmp="$(mktemp -d)"
  log "Lade $base/$name.$ext"
  if ! curl -fsSL --retry 2 --connect-timeout 15 --max-time "$(budget 90)" -o "$tmp/$name.$ext" "$base/$name.$ext"; then
    rm -rf "$tmp"
    warn "Download von nodejs.org fehlgeschlagen (nodejs.org erreichbar? Netzwerk-Allowlist prüfen)"
    return 1
  fi
  if [ "$want" = "$NODE_VERSION_PIN" ] && [ "$plat" = "linux-x64" ] && [ "$ext" = "tar.xz" ]; then
    expected="$NODE_SHA256_PIN_LINUX_X64_XZ"
  elif [ "$want" = "$NODE_VERSION_PIN" ] && [ "$plat" = "linux-x64" ] && [ "$ext" = "tar.gz" ]; then
    expected="$NODE_SHA256_PIN_LINUX_X64_GZ"
  else
    expected="$(curl -fsSL --max-time "$(budget 30)" "$base/SHASUMS256.txt" | awk -v f="$name.$ext" '$2==f {print $1}' || true)"
  fi
  actual="$(sha256sum "$tmp/$name.$ext" | awk '{print $1}')"
  if [ -z "$expected" ] || [ "$actual" != "$expected" ]; then
    rm -rf "$tmp"
    warn "SHA-256 von $name.$ext stimmt nicht (erwartet ${expected:-?}) – Node nicht installiert"
    return 1
  fi
  if ! tar -x"${tflag}"f "$tmp/$name.$ext" -C /opt; then
    rm -rf "$tmp"
    warn "Entpacken von Node nach /opt fehlgeschlagen"
    return 1
  fi
  rm -rf "$tmp"
  ln -sfn "/opt/$name" "$NODE_DIR"
  log "Node $("$NODE_DIR/bin/node" --version) installiert in $NODE_DIR"
  return 0
}

activate_node() {
  local major=""
  if [ -x "$NODE_DIR/bin/node" ]; then
    case ":$PATH:" in
      *":$NODE_DIR/bin:"*) ;;
      *) export PATH="$NODE_DIR/bin:$PATH" ;;
    esac
  fi
  hash -r
  if have node; then
    NODE_STATUS="$(node --version 2>/dev/null || echo '?')"
  else
    NODE_STATUS="fehlt"
  fi
  major="${NODE_STATUS#v}"
  major="${major%%.*}"
  case "$major" in
    '' | *[!0-9]*) warn "Node nicht gefunden" ;;
    *)
      if [ "$major" -lt 22 ]; then
        warn "Node $NODE_STATUS ist zu alt (package.json engines: >= 22.12, Ziel $NODE_MAJOR)"
      elif [ "$major" -lt "$NODE_MAJOR" ]; then
        warn "Node $NODE_STATUS aktiv statt $NODE_MAJOR (CI nutzt .nvmrc = $NODE_MAJOR) – läuft, Abweichungen möglich"
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------- pnpm --
current_pnpm_version() { (cd / && pnpm --version </dev/null 2>/dev/null) || true; }

ensure_pnpm() {
  local want="$1" nodebin=""
  if have pnpm && [ "$(current_pnpm_version)" = "$want" ]; then
    PNPM_STATUS="$want"
    log "pnpm $want vorhanden"
    return 0
  fi
  if ! have node; then
    PNPM_STATUS="fehlt"
    warn "pnpm: kein Node gefunden"
    return 1
  fi
  nodebin="$(dirname "$(command -v node)")"
  if have corepack; then
    log "Aktiviere pnpm $want per corepack in $nodebin"
    if limited "$(budget 30)" corepack enable --install-directory "$nodebin" pnpm >&3 2>&3 &&
      limited "$(budget 60)" corepack install -g "pnpm@$want" </dev/null >&3 2>&3; then
      hash -r
      if [ "$(current_pnpm_version)" = "$want" ]; then
        PNPM_STATUS="$want"
        return 0
      fi
    fi
    log "corepack hat nicht geklappt – Fallback: npm install -g pnpm@$want"
    corepack disable --install-directory "$nodebin" pnpm >&3 2>&3 || true
  fi
  if limited "$(budget 90)" npm install -g --no-fund --no-audit "pnpm@$want" </dev/null >&3 2>&3; then
    hash -r
  fi
  PNPM_STATUS="$(current_pnpm_version)"
  if [ "$PNPM_STATUS" != "$want" ]; then
    warn "pnpm $want nicht aktivierbar (aktiv: ${PNPM_STATUS:-keins})"
    [ -n "$PNPM_STATUS" ] || PNPM_STATUS="fehlt"
    return 1
  fi
  return 0
}

# ------------------------------------------------------------------ Postgres --
pg_ready() {
  have pg_isready && pg_isready -h "$DB_HOST" -p "$DB_PORT" -q >/dev/null 2>&1
}

start_postgres() {
  local i=0 ver="" cluster="" rest=""
  if pg_ready; then return 0; fi
  log "Starte PostgreSQL"
  if have service; then
    as_root service postgresql start >&3 2>&3 || true
  fi
  if ! pg_ready && have pg_lsclusters && have pg_ctlcluster; then
    while read -r ver cluster rest; do
      [ -n "$ver" ] || continue
      as_root pg_ctlcluster "$ver" "$cluster" start >&3 2>&3 || true
    done < <(pg_lsclusters --no-header 2>/dev/null || true)
  fi
  for i in $(seq 1 30); do
    if pg_ready; then return 0; fi
    sleep 1
  done
  return 1
}

db_login_ok() {
  have psql && PGPASSWORD="$DB_PASSWORD" PGCONNECT_TIMEOUT=5 \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "${1:-$DB_MAIN}" -tAc 'SELECT 1' >/dev/null 2>&1
}

ensure_database() {
  local db=""
  if ! have psql; then
    DB_STATUS="FEHLT (psql nicht installiert)"
    warn "psql/PostgreSQL nicht gefunden"
    return 1
  fi
  if ! start_postgres; then
    DB_STATUS="FEHLER (startet nicht)"
    warn "PostgreSQL startet nicht – 'service postgresql start' prüfen (Log: /var/log/postgresql/)"
    return 1
  fi
  if db_login_ok "$DB_MAIN" && db_login_ok "$DB_TEST"; then
    DB_STATUS="bereit"
    return 0
  fi
  log "Richte Rolle '$DB_USER' (Passwort-Login) und Datenbanken '$DB_MAIN', '$DB_TEST' ein"
  (cd /tmp && as_postgres psql -v ON_ERROR_STOP=1 -qc "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASSWORD';") >&3 2>&3 ||
    log "ALTER USER fehlgeschlagen (weiter mit Prüfung)"
  for db in "$DB_MAIN" "$DB_TEST"; do
    if ! (cd /tmp && as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null) | grep '^1$' >/dev/null; then
      (cd /tmp && as_postgres createdb -O "$DB_USER" "$db") >&3 2>&3 || log "createdb $db fehlgeschlagen"
    fi
  done
  if db_login_ok "$DB_MAIN" && db_login_ok "$DB_TEST"; then
    DB_STATUS="bereit"
    return 0
  fi
  DB_STATUS="FEHLER (Login mit Passwort scheitert)"
  warn "Anmeldung postgres://$DB_USER:***@$DB_HOST:$DB_PORT/$DB_MAIN bzw. /$DB_TEST scheitert"
  return 1
}

stop_postgres() {
  if have service; then as_root service postgresql stop >&3 2>&3 || true; fi
}

# ---------------------------------------------------------------- Playwright --
choose_pw_browsers_dir() {
  local dir="${PLAYWRIGHT_BROWSERS_PATH:-$PW_BROWSERS_DIR_DEFAULT}"
  if mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ]; then
    export PLAYWRIGHT_BROWSERS_PATH="$dir"
  elif [ -d "$dir" ] && ls "$dir" 2>/dev/null | grep '^chromium' >/dev/null; then
    export PLAYWRIGHT_BROWSERS_PATH="$dir"
  else
    export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
    mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null || true
  fi
}

deps_marker() { echo "$PLAYWRIGHT_BROWSERS_PATH/.planetclaire-deps-ok-$1"; }

# Ein per `timeout` abgebrochenes apt-get kann dpkg halb konfiguriert zurücklassen.
# Im Setup nur mit genug Restbudget (sonst kein Cache); der Hook repariert vor jedem --with-deps.
repair_dpkg() {
  is_root && have dpkg || return 0
  if [ "$MODE" = "provision" ] && [ "$((BUDGET_S - SECONDS))" -lt 30 ]; then
    log "dpkg-Reparatur übersprungen (Budget) – erledigt der Session-Start"
    return 0
  fi
  limited "$(budget 60)" dpkg --configure -a >&3 2>&3 || true
}

# Setup-Skript: node_modules gibt es noch nicht → gleiche Version per npx.
provision_playwright() {
  local ver="$1" b=""
  if ! have npx; then
    warn "npx fehlt – Playwright-Browser werden beim Session-Start installiert"
    return 1
  fi
  for b in "$PW_REQUIRED_BROWSER" "$PW_OPTIONAL_BROWSER"; do
    if [ "$b" = "$PW_OPTIONAL_BROWSER" ] && [ "$((BUDGET_S - SECONDS))" -lt 90 ]; then
      log "Zu wenig Restbudget für $b – der Session-Start holt es nach"
      return 0
    fi
    log "Playwright $ver: $b + Systembibliotheken nach $PLAYWRIGHT_BROWSERS_PATH"
    if limited "$(budget 200)" npx -y "playwright@$ver" install --with-deps "$b" </dev/null >&3 2>&3; then
      touch "$(deps_marker "$b")" 2>/dev/null || true
    else
      repair_dpkg
      if [ "$b" = "$PW_REQUIRED_BROWSER" ]; then
        warn "Playwright-$b nicht installiert (cdn.playwright.dev in der Allowlist?) – Session-Start versucht es erneut"
        return 1
      fi
      log "Playwright-$b nicht installiert – Session-Start versucht es erneut"
    fi
  done
  return 0
}

# Hook: mit der Playwright-Version aus node_modules. Browser-Download ist idempotent;
# Systembibliotheken (--with-deps, apt) nur, wenn der Marker fehlt.
pw_install() {
  local b="$1" args=()
  if [ ! -f "$(deps_marker "$b")" ] && is_root; then
    repair_dpkg
    args=(install --with-deps "$b")
  else
    args=(install "$b")
  fi
  log "pnpm exec playwright ${args[*]} (PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH)"
  if limited "$(budget 300)" pnpm exec playwright "${args[@]}" </dev/null >&3 2>&3; then
    if [ "${args[1]}" = "--with-deps" ]; then touch "$(deps_marker "$b")" 2>/dev/null || true; fi
    return 0
  fi
  return 1
}

ensure_playwright_browsers() {
  local cr="FEHLER" wk="fehlt"
  if [ ! -x node_modules/.bin/playwright ]; then
    PW_STATUS="übersprungen (node_modules fehlt)"
    return 1
  fi
  if pw_install "$PW_REQUIRED_BROWSER"; then
    cr="bereit"
  else
    warn "Playwright-$PW_REQUIRED_BROWSER nicht installiert (Allowlist: cdn.playwright.dev, playwright.download.prss.microsoft.com). E2E-Tests laufen so nicht."
  fi
  if pw_install "$PW_OPTIONAL_BROWSER"; then
    wk="bereit"
    PW_WEBKIT_STATE="bereit"
  else
    PW_WEBKIT_STATE="fehlgeschlagen"
    warn "Playwright-$PW_OPTIONAL_BROWSER nicht installiert → PW_SKIP_WEBKIT=1 gesetzt (iPhone-Projekt läuft als Chromium-Emulation, ARCHITEKTUR §4.5/§7.3; Eintrag in docs/OFFENE-PUNKTE.md vorgesehen)"
  fi
  PW_STATUS="$PW_REQUIRED_BROWSER $cr, $PW_OPTIONAL_BROWSER $wk ($PLAYWRIGHT_BROWSERS_PATH)"
  [ "$cr" = "bereit" ]
}

# ---------------------------------------------------------- pnpm-Store/Deps --
# Setup-Skript: pnpm-Store auf einer KOPIE von package.json/pnpm-lock.yaml füllen
# (fasst das Repo nicht an; der Hook installiert dann fast offline).
warm_pnpm_store() {
  local src="$1"
  rm -rf "$WARM_DIR"
  mkdir -p "$WARM_DIR"
  if ! cp "$src/package.json" "$src/pnpm-lock.yaml" "$WARM_DIR/" 2>/dev/null; then
    rm -rf "$WARM_DIR"
    warn "pnpm-lock.yaml nicht gefunden – pnpm-Store nicht vorgewärmt"
    return 1
  fi
  if [ -f "$src/.npmrc" ]; then cp "$src/.npmrc" "$WARM_DIR/"; fi
  if [ -f "$src/pnpm-workspace.yaml" ]; then cp "$src/pnpm-workspace.yaml" "$WARM_DIR/"; fi
  log "Wärme pnpm-Store vor (pnpm fetch)"
  if (cd "$WARM_DIR" && limited "$(budget 240)" pnpm fetch </dev/null) >&3 2>&3; then
    rm -rf "$WARM_DIR"
    return 0
  fi
  rm -rf "$WARM_DIR"
  warn "pnpm fetch fehlgeschlagen/abgebrochen – der Session-Start installiert online"
  return 1
}

deps_hash() {
  cat pnpm-lock.yaml package.json 2>/dev/null | sha256sum | awk '{print $1}'
}

ensure_node_modules() {
  local want="" stamp="node_modules/$DEPS_STAMP_NAME"
  if [ ! -f pnpm-lock.yaml ]; then
    DEPS_STATUS="FEHLER (pnpm-lock.yaml fehlt)"
    warn "pnpm-lock.yaml fehlt im Repository"
    return 1
  fi
  want="$(deps_hash)"
  if [ -d node_modules ] && [ -f "$stamp" ] && [ "$(cat "$stamp" 2>/dev/null || true)" = "$want" ]; then
    DEPS_STATUS="aktuell"
    return 0
  fi
  log "pnpm install --frozen-lockfile --prefer-offline"
  if limited "$(budget 480)" pnpm install --frozen-lockfile --prefer-offline --config.confirmModulesPurge=false </dev/null >&3 2>&3; then
    echo "$want" >"$stamp" 2>/dev/null || true
    DEPS_STATUS="installiert"
    return 0
  fi
  DEPS_STATUS="FEHLER"
  warn "pnpm install --frozen-lockfile fehlgeschlagen. Häufigste Ursache: pnpm-lock.yaml passt nicht zu package.json → 'pnpm install' ausführen und pnpm-lock.yaml committen."
  return 1
}

ensure_dotenv() {
  local line="" key="" added=0
  if [ -f .env ] && [ -f .env.example ]; then
    # Neue Schlüssel aus .env.example ergänzen, vorhandene Werte nie überschreiben.
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%$'\r'}"
      case "$line" in '' | \#*) continue ;; esac
      key="${line%%=*}"
      case "$key" in '' | *[!A-Za-z0-9_]*) continue ;; esac
      if ! grep -q "^${key}=" .env 2>/dev/null; then
        printf '%s\n' "$line" >>.env
        added=$((added + 1))
      fi
    done <.env.example
    DOTENV_STATUS="vorhanden"
    if [ "$added" -gt 0 ]; then
      DOTENV_STATUS="vorhanden, $added neue Schlüssel aus .env.example ergänzt"
      log ".env: $added Schlüssel aus .env.example ergänzt"
    fi
  elif [ -f .env ]; then
    DOTENV_STATUS="vorhanden"
  elif [ -f .env.example ]; then
    cp .env.example .env
    DOTENV_STATUS="aus .env.example angelegt"
    log ".env aus .env.example angelegt (nur Entwicklungswerte, git-ignoriert)"
  else
    DOTENV_STATUS="fehlt (.env.example nicht gefunden)"
    warn ".env.example fehlt"
  fi
}

# CLAUDE_ENV_FILE: dokumentierter Weg, Variablen für spätere Bash-Befehle der Session zu setzen.
persist_session_env() {
  [ -n "${CLAUDE_ENV_FILE:-}" ] || return 0
  if ! grep -qF "$ENV_MARKER" "$CLAUDE_ENV_FILE" 2>/dev/null; then
    {
      echo "$ENV_MARKER"
      if [ -x "$NODE_DIR/bin/node" ]; then
        echo "case \":\$PATH:\" in *\":$NODE_DIR/bin:\"*) ;; *) export PATH=\"$NODE_DIR/bin:\$PATH\" ;; esac"
      fi
      echo "export PLAYWRIGHT_BROWSERS_PATH=\"$PLAYWRIGHT_BROWSERS_PATH\""
      echo "export COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
      echo "export COREPACK_ENABLE_AUTO_PIN=0"
      echo "export NEXT_TELEMETRY_DISABLED=1"
      if [ -z "${GH_REPO:-}" ] && [ -n "$GH_REPO_DETECTED" ]; then
        echo "export GH_REPO=\"$GH_REPO_DETECTED\""
      fi
    } >>"$CLAUDE_ENV_FILE" 2>/dev/null || warn "CLAUDE_ENV_FILE nicht beschreibbar"
  fi
  if [ "$PW_WEBKIT_STATE" = "fehlgeschlagen" ] && ! grep -q '^export PW_SKIP_WEBKIT=' "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo "export PW_SKIP_WEBKIT=1" >>"$CLAUDE_ENV_FILE" 2>/dev/null || true
  fi
}

# ----------------------------------------------------------------- Git/GitHub --
# owner/repo aus der origin-URL (github.com, git@…, oder lokale Proxy-URL …/owner/repo).
detect_gh_repo() {
  local url="" path="" repo="" rest="" owner=""
  if [ -n "${GH_REPO:-}" ]; then
    GH_REPO_DETECTED="$GH_REPO"
    return 0
  fi
  url="$(git remote get-url origin 2>/dev/null || true)"
  [ -n "$url" ] || return 0
  path="${url%/}"
  path="${path%.git}"
  repo="${path##*/}"
  rest="${path%/*}"
  owner="${rest##*/}"
  owner="${owner##*:}"
  if [[ "$owner" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] && [[ "$repo" =~ ^[A-Za-z0-9._-]+$ ]]; then
    GH_REPO_DETECTED="$owner/$repo"
  fi
}

git_overview() {
  local main_tree="" b="" ahead="" merged_tree="" shallow_flag=()
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_BRANCH="(kein Git-Repository)"
    return 0
  fi
  GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null || echo false)" = "true" ]; then
    shallow_flag=(--unshallow)
  fi
  if ! limited "$(budget 120)" git fetch --quiet --prune "${shallow_flag[@]}" origin '+refs/heads/*:refs/remotes/origin/*' </dev/null >&3 2>&3; then
    warn "git fetch fehlgeschlagen – Übersicht über andere Branches evtl. veraltet"
  fi
  main_tree="$(git rev-parse -q --verify 'origin/main^{tree}' 2>/dev/null || true)"
  [ -n "$main_tree" ] || return 0
  while read -r b; do
    [ -n "$b" ] || continue
    case "$b" in origin | origin/main | origin/HEAD | "origin/$GIT_BRANCH") continue ;; esac
    ahead="$(git rev-list --count "origin/main..$b" 2>/dev/null || echo 0)"
    [ "$ahead" != "0" ] || continue
    # Squash-Merges erkennen: Branch gilt als erledigt, wenn ein Merge nach main nichts mehr ändert.
    merged_tree="$(git merge-tree --write-tree origin/main "$b" 2>/dev/null | head -n 1 || true)"
    [ "$merged_tree" = "$main_tree" ] && continue
    GIT_OTHER="${GIT_OTHER}${b#origin/} (+${ahead}); "
  done < <(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/remotes/origin 2>/dev/null | head -n 50 || true)
  GIT_OTHER="${GIT_OTHER%; }"
}

open_prs() {
  local out=""
  if ! have gh || [ -z "$GH_REPO_DETECTED" ]; then
    OPEN_PRS="unbekannt (gh oder Repo-Name fehlt)"
    return 0
  fi
  # REST statt GraphQL (der GitHub-Proxy erlaubt nur ausgewählte GraphQL-Abfragen).
  if out="$(limited "$(budget 20)" gh api "repos/$GH_REPO_DETECTED/pulls?state=open&per_page=20" \
    --jq '.[] | "#\(.number) \(.head.ref)"' 2>&3)"; then
    OPEN_PRS="$(printf '%s' "$out" | paste -sd ';' - | sed 's/;/; /g')"
    [ -n "$OPEN_PRS" ] || OPEN_PRS="keine"
  else
    OPEN_PRS="unbekannt (gh api fehlgeschlagen, Details im Log)"
  fi
}

# ------------------------------------------------------------------- PLAN.md --
# Ausgabe je Zeile: "PHASE <n|x> <offen> <gesamt>", "NEXT <text>", "NEXTANY <text>".
# Phase einer Checkbox: Kennung am Anfang des Aufgabentexts (z. B. "P3-04 …"),
# sonst die letzte Überschrift, die mit "P<n>" bzw. "Phase <n>" beginnt.
plan_status_raw() {
  [ -f PLAN.md ] || return 1
  awk '
    function phase_of(text,   t, word) {
      t = text
      sub(/^[ \t*_`]+/, "", t)
      word = 0
      if (t ~ /^[Pp]hase[ \t]+/) { sub(/^[Pp]hase[ \t]+/, "", t); word = 1 }
      if (t ~ /^P[0-9]+([^0-9A-Za-z]|$)/) { match(t, /^P[0-9]+/); return substr(t, 2, RLENGTH - 1) + 0 }
      if (word && t ~ /^[0-9]+([^0-9]|$)/) { match(t, /^[0-9]+/); return substr(t, 1, RLENGTH) + 0 }
      return -1
    }
    { sub(/\r$/, "") }
    /^#+[ \t]/ {
      h = $0
      sub(/^#+[ \t]+/, "", h)
      p = phase_of(h)
      if (p >= 0) { cur = p; hasCur = 1; head = h }
      next
    }
    /^[ \t]*[-*+][ \t]+\[[ xX]\]/ {
      box = $0
      sub(/^[ \t]*[-*+][ \t]+\[/, "", box)
      box = substr(box, 1, 1)
      item = $0
      sub(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]*/, "", item)
      p = phase_of(item)
      if (p < 0) p = hasCur ? cur : "x"
      key = p ""
      if (!(key in total)) { order[n++] = key }
      total[key]++
      if (box == " ") {
        open[key]++
        label = (hasCur ? head " → " : "") item
        if (nxtAny == "") nxtAny = label
        if (nxt == "" && key != "x" && p + 0 >= 1 && (p + 0 <= 10 || p + 0 == 12)) nxt = label
      }
    }
    END {
      for (i = 0; i < n; i++) { k = order[i]; printf "PHASE %s %d %d\n", k, open[k] + 0, total[k] }
      if (nxt != "") print "NEXT " nxt
      if (nxtAny != "") print "NEXTANY " nxtAny
    }
  ' PLAN.md 2>/dev/null
}

PLAN_OPEN_P1_P10="unbekannt"
PLAN_TABLE=""
PLAN_NEXT=""

plan_summary() {
  local raw="" kind="" a="" b="" c="" sum=0
  PLAN_TABLE=""
  PLAN_NEXT=""
  if ! raw="$(plan_status_raw)"; then
    PLAN_OPEN_P1_P10="unbekannt (PLAN.md fehlt)"
    return 0
  fi
  while read -r kind a b c; do
    case "$kind" in
      PHASE)
        if [ "$a" = "x" ]; then
          PLAN_TABLE="${PLAN_TABLE}ohne Phase ${b}/${c}; "
        else
          PLAN_TABLE="${PLAN_TABLE}P${a} ${b}/${c}; "
          if [ "$a" -ge 1 ] && [ "$a" -le 10 ]; then sum=$((sum + b)); fi
          if [ "$a" -eq 12 ]; then PLAN_OPEN_P12="$b"; fi
          if [ "$a" -eq 13 ]; then PLAN_OPEN_P13="$b"; fi
        fi
        ;;
    esac
  done <<<"$raw"
  PLAN_TABLE="${PLAN_TABLE%; }"
  PLAN_OPEN_P1_P10="$sum"
  PLAN_OPEN_P12="${PLAN_OPEN_P12:-0}"
  PLAN_OPEN_P13="${PLAN_OPEN_P13:-0}"
  PLAN_NEXT="$(printf '%s\n' "$raw" | sed -n 's/^NEXT //p' | head -n 1)"
  if [ -z "$PLAN_NEXT" ]; then
    PLAN_NEXT="$(printf '%s\n' "$raw" | sed -n 's/^NEXTANY //p' | head -n 1)"
    if [ -n "$PLAN_NEXT" ]; then
      PLAN_NEXT="(P1–P10 erledigt) $PLAN_NEXT"
    else
      PLAN_NEXT="(keine offene Checkbox)"
    fi
  fi
  if [ "${#PLAN_NEXT}" -gt 240 ]; then PLAN_NEXT="${PLAN_NEXT:0:240}…"; fi
}

# ------------------------------------------------------------------- Modi --
run_provision() {
  local pnpm_want="" pw_want="" pids=() names=() logs=() i=0 name="" lf=""
  if ! is_linux; then
    echo "cloud-setup: Provisionierung ist nur für die Claude-Cloud-Umgebung (Ubuntu). Lokal: README.md / docker compose." >&2
    return 0
  fi
  log "Provisionierung startet (Budget ${BUDGET_S}s, user=$(id -un 2>/dev/null || echo ?), cwd=$PWD, CLAUDE_CODE_REMOTE=${CLAUDE_CODE_REMOTE:-unset})"
  REPO="$(find_repo || true)"
  if [ -n "$REPO" ]; then log "Repository gefunden: $REPO"; else log "Repository nicht gefunden – pnpm-Store wird nicht vorgewärmt"; fi
  pnpm_want="$(repo_pnpm_version)"
  pw_want="$(repo_playwright_version)"
  export NEXT_TELEMETRY_DISABLED=1

  ensure_node24 || true
  activate_node
  ensure_pnpm "$pnpm_want" || true
  choose_pw_browsers_dir

  # Unabhängige Schritte parallel (Doku-Empfehlung: & + wait).
  names=(postgres playwright)
  logs=(/var/tmp/planetclaire-postgres.log /var/tmp/planetclaire-playwright.log)
  # Postgres wird nach dem Einrichten wieder gestoppt: Der Cache speichert nur Dateien;
  # ein sauber beendeter Cluster startet in jeder Session ohne Recovery.
  (
    exec 3>"${logs[0]}"
    rc=0
    ensure_database || rc=$?
    stop_postgres
    exit "$rc"
  ) &
  pids+=($!)
  (
    exec 3>"${logs[1]}"
    rc=0
    provision_playwright "$pw_want" || rc=$?
    exit "$rc"
  ) &
  pids+=($!)
  if [ -n "$REPO" ] && have pnpm; then
    names+=(pnpm-store)
    logs+=(/var/tmp/planetclaire-pnpm-store.log)
    (
      exec 3>"${logs[2]}"
      rc=0
      warm_pnpm_store "$REPO" || rc=$?
      exit "$rc"
    ) &
    pids+=($!)
  fi
  for i in "${!pids[@]}"; do
    name="${names[$i]}"
    lf="${logs[$i]}"
    if wait "${pids[$i]}"; then
      log "Schritt '$name' ok"
    else
      warn "Schritt '$name' unvollständig (wird beim Session-Start nachgeholt)"
    fi
    if [ -f "$lf" ]; then
      sed "s/^/[$name] /" "$lf" >&3 || true
      rm -f "$lf"
    fi
  done

  log "----- Ergebnis -----"
  log "Node:       $(node --version 2>/dev/null || echo fehlt) ($(command -v node 2>/dev/null || echo -))"
  log "npm:        $(npm --version 2>/dev/null || echo fehlt)"
  log "pnpm:       $(current_pnpm_version)"
  log "PostgreSQL: $(psql --version 2>/dev/null || echo fehlt)"
  log "Playwright: $(ls "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null | grep -E '^(chromium|webkit|ffmpeg)' | tr '\n' ' ' || true)"
  log "Docker:     $(docker --version 2>/dev/null || echo fehlt)"
  log "Dauer:      ${SECONDS}s (Umgebungs-Cache nur bei < ~300 s)"
  if [ "${#WARNINGS[@]}" -gt 0 ]; then
    log "${#WARNINGS[@]} Warnung(en) – die Session startet trotzdem; der SessionStart-Hook holt Fehlendes nach."
  fi
}

run_session_start() {
  local hook_input="" hook_source="startup" warn_text="" w=""
  if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${CLOUD_SETUP_FORCE:-}" != "1" ]; then
    return 0 # lokal (Windows/macOS/Linux): nichts tun
  fi
  if ! is_linux; then
    echo "cloud-setup: --session-start ist nur für die Linux-Cloud-VM gedacht; nichts getan."
    return 0
  fi
  exec 3>>"$SESSION_LOG"
  if [ ! -t 0 ]; then
    hook_input="$(limited 2 cat 2>/dev/null || true)"
    hook_source="$(printf '%s' "$hook_input" | sed -n 's/.*"source"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p' | head -n 1 || true)"
    [ -n "$hook_source" ] || hook_source="startup"
  fi
  log "===== SessionStart ($hook_source) ====="

  REPO="${CLAUDE_PROJECT_DIR:-}"
  if ! is_repo_dir "$REPO"; then REPO="$(find_repo || true)"; fi
  if [ -z "$REPO" ]; then
    echo "## Cloud-Umgebung: scripts/cloud-setup.sh hat das Repository nicht gefunden; nichts vorbereitet (docs/CLOUD-SETUP.md §5)."
    return 0
  fi
  cd "$REPO"
  export NEXT_TELEMETRY_DISABLED=1

  ensure_node24 || true
  activate_node
  choose_pw_browsers_dir
  ensure_pnpm "$(repo_pnpm_version)" || true
  ensure_database || true
  ensure_dotenv
  if have pnpm; then
    ensure_node_modules || true
    ensure_playwright_browsers || true
  else
    DEPS_STATUS="FEHLER (pnpm fehlt)"
    PW_STATUS="übersprungen (pnpm fehlt)"
  fi
  detect_gh_repo
  persist_session_env
  git_overview || true
  open_prs || true
  plan_summary || true

  # ---- Zusammenfassung für Claude (stdout = Kontext; sachlich formuliert) ----
  if [ "${#WARNINGS[@]}" -gt 0 ]; then
    for w in "${WARNINGS[@]}"; do warn_text="${warn_text}
  - ${w}"; done
  else
    warn_text=" keine"
  fi
  cat <<EOF
## Cloud-Umgebung (SessionStart-Hook scripts/cloud-setup.sh, Anlass: ${hook_source})
- Werkzeuge: Node ${NODE_STATUS} | pnpm ${PNPM_STATUS} | Postgres: ${DB_STATUS} (postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_MAIN}, Test-DB ${DB_TEST}) | .env: ${DOTENV_STATUS}
- Abhängigkeiten: ${DEPS_STATUS} | Playwright: ${PW_STATUS}
- Git: aktueller Branch ${GIT_BRANCH} | GitHub-Repo ${GH_REPO_DETECTED:-unbekannt} | Branches mit Commits, die nicht in main sind: ${GIT_OTHER:-keine} | offene PRs: ${OPEN_PRS}
- PLAN.md: offene Checkboxen P1–P10 = ${PLAN_OPEN_P1_P10}${PLAN_TABLE:+ (offen/gesamt: ${PLAN_TABLE})} | erste offene Aufgabe: ${PLAN_NEXT:-?}
- Warnungen:${warn_text}
Der Umgang mit nicht gemergten Branches und offenen PRs steht in CLAUDE.md §3; Wiederaufnahme und Fehlerbehebung in docs/CLOUD-SETUP.md §4–§5. Detail-Log: ${SESSION_LOG}. Erneute Prüfung: bash scripts/cloud-setup.sh --check
EOF
}

run_check() {
  local h="" code=""
  echo "== cloud-setup --check ($(date -u +%Y-%m-%dT%H:%M:%SZ)) =="
  echo "System:       $(uname -srm 2>/dev/null || echo ?) | user=$(id -un 2>/dev/null || echo ?) | CLAUDE_CODE_REMOTE=${CLAUDE_CODE_REMOTE:-unset}"
  REPO="$(find_repo || true)"
  echo "Repo:         ${REPO:-nicht gefunden}"
  activate_node
  echo "Node aktiv:   ${NODE_STATUS} ($(command -v node 2>/dev/null || echo -)); vorhanden: $(ls -d /opt/node* 2>/dev/null | tr '\n' ' ' || true)"
  echo "pnpm:         $(current_pnpm_version) (Soll: $(repo_pnpm_version))"
  echo "psql:         $(psql --version 2>/dev/null || echo fehlt)"
  if pg_ready; then echo "Postgres:     läuft"; else echo "Postgres:     läuft NICHT (→ bash scripts/cloud-setup.sh --session-start)"; fi
  if db_login_ok "$DB_MAIN"; then echo "DB-Login:     ok ($DB_MAIN)"; else echo "DB-Login:     FEHLER ($DB_MAIN)"; fi
  if db_login_ok "$DB_TEST"; then echo "Test-DB:      ok ($DB_TEST)"; else echo "Test-DB:      FEHLER ($DB_TEST)"; fi
  if [ -n "$REPO" ]; then
    echo "node_modules: $([ -d "$REPO/node_modules" ] && echo vorhanden || echo fehlt) | .env: $([ -f "$REPO/.env" ] && echo vorhanden || echo fehlt)"
  fi
  echo "Playwright:   PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-unset}; $(ls "${PLAYWRIGHT_BROWSERS_PATH:-$PW_BROWSERS_DIR_DEFAULT}" 2>/dev/null | tr '\n' ' ' || true)"
  echo "PW_SKIP_WEBKIT=${PW_SKIP_WEBKIT:-unset} | GH_REPO=${GH_REPO:-unset}"
  echo "Docker:       $(docker --version 2>/dev/null || echo fehlt)"
  echo "Platte:       $(df -h / 2>/dev/null | awk 'NR==2 {print $4 " frei"}' || echo ?)"
  echo "Netzwerk (HTTP-Code des Ziels; 000 = nicht erreichbar/blockiert; jeder andere Code, auch 4xx, = erreichbar):"
  for h in registry.npmjs.org nodejs.org cdn.playwright.dev playwright.download.prss.microsoft.com \
    api.stripe.com api-free.deepl.com payloadcms.com github.com; do
    code="$(curl -s -o /dev/null -m 15 -w '%{http_code} (Proxy-CONNECT %{http_connect})' "https://$h/" 2>/dev/null || true)"
    printf '  %-40s %s\n' "$h" "${code:-000}"
  done
}

run_plan_status() {
  local raw=""
  if [ -z "${CLAUDE_PROJECT_DIR:-}" ] || ! cd "$CLAUDE_PROJECT_DIR" 2>/dev/null; then
    REPO="$(find_repo || true)"
    if [ -n "$REPO" ]; then cd "$REPO"; fi
  fi
  if ! raw="$(plan_status_raw)"; then
    echo "PLAN.md fehlt ($PWD)"
    echo "OFFEN_P1_P10=unbekannt"
    return 0
  fi
  plan_summary
  echo "PLAN.md – offene/gesamte Checkboxen je Phase:"
  printf '%s\n' "$raw" | awk '$1 == "PHASE" { printf "  %s: %s/%s offen\n", ($2 == "x" ? "ohne Phase" : "P" $2), $3, $4 }'
  echo "OFFEN_P1_P10=${PLAN_OPEN_P1_P10}"
  echo "OFFEN_P12=${PLAN_OPEN_P12:-0}"
  echo "OFFEN_P13=${PLAN_OPEN_P13:-0}"
  echo "ERSTE_OFFENE_AUFGABE: ${PLAN_NEXT}"
}

case "$MODE" in
  provision) run_provision ;;
  session) run_session_start ;;
  check) run_check ;;
  plan) run_plan_status ;;
esac
exit 0
