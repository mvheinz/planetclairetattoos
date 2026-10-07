# Text-Review P12.10 (redaktioneller Durchgang)

Geprüft: `src/i18n/messages/{de,en}.json` (ohne legal/withdraw/shippingPayment/privacyExport), `content/seed/data/*.json` (ohne Rechtstexte), gegen U-00, U-21, `docs/design/TEXTE.md`, CLAUDE.md §6.

## Korrigiert
- Ich-Form (U-21): „wir/unser“ in Kasse, Danke-Seite, Fehlermeldungen und Mail-Anhangsliste auf „ich/meine“ gestellt (DE und EN), z. B. `thanks.waitingText`, `checkout.privacy`, `checkout.fields.emailHint`, `prepaymentBank`, `billingPickupHint`, `errors.country`, `order.confirming`, `email.common.attAgb`.
- EN-Konsistenz: „cart“ durchgehend „basket“ (Header sagt „Basket“); „collection/Pick-up“ einheitlich „pickup“; `deliveryPickupOnly` ohne falsche Singular-Form („can only be picked up“).
- EN-Qualität: „Please fill in.“ → „Please fill this in.“; „(anymore)“ → „– or no longer does“; „to the best of our knowledge“ → „my“; Testmodus-Label „like PayPal back“ → „like coming back from PayPal“.
- Gesundheitsversprechen: `tattoo.aftercare.intro` „heilt es in Ruhe“ (Zusicherung) → „diese Schritte begleiten es beim Heilen“ (DE/EN).
- Typografie: gerade Apostrophe in neu angefasster EN-Zeile auf ’.

## Verbotsliste
Kein „inkl. MwSt.“, kein EU-OS-Link, keine DM-Erwähnung, Button „Zahlungspflichtig bestellen“ / „Order with obligation to pay“ unverändert (nur in `chargeStripe` und `constants.ts`). Keine Liedtitel (About-Seite nennt nur „ein Lied“). Keine Garantieversprechen außer der gesetzlichen Gewährleistung (Pflichtinformation).

## Parität
Alle Schlüssel in DE und EN vorhanden. Absichtliche Lücken: Stücke S25, S29 und Platzhalter-Alt-Text „Skizze: ein Hase“ nur deutsch (Zustand „Übersetzung fehlt“).

## Offene Ermessensfragen
- Viele Sachtexte (Kasse, Formulare) sind bewusst schlicht; Poesie nur in Leerzuständen, Fehlern, Stationen. Passt zu TEXTE.md §2.
- „Stand {number}“ (Markt) EN evtl. „Stall“; beides verständlich.
- `schmuck.intro` („deine Lieblingskette wartet bestimmt schon“) leicht niedlich, aber noch im Ton.
- Mail-Texte außerhalb der Titelzeile bewusst sachlich; „Hi/Hallo“-Anrede vs. „Liebe Grüße/Best wishes“ konsistent.
- FAQ09 nennt Heilungszeiten mit „meist“/„usually“ – als Orientierung belassen, keine Zusage.

## Bewertung
Ton: 4/5 · Korrektheit: 4/5
