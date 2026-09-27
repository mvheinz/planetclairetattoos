// Bewegungszustand für Tuschelinie und Verhaltensmodule (DESIGN §9.1, §9.11, §11.7): `reduced`, wenn das System
// `prefers-reduced-motion: reduce` meldet oder `html[data-motion="reduced"]` gesetzt ist (Schalter „Animationen“);
// `html[data-motion="full"]` hebt die Systemvorgabe auf. Framework-frei (ARCHITEKTUR A-11), liest keinen Speicher.
// Angelegt in P2.6 für `cart-count`; P2.16 baut Engine und Schalter darauf auf.

export type Motion = 'full' | 'reduced'

const QUERY = '(prefers-reduced-motion: reduce)'

function systemReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches
}

export function getMotion(doc: Document = document): Motion {
  const attr = doc.documentElement.getAttribute('data-motion')
  if (attr === 'reduced' || attr === 'full') return attr
  return systemReduced() ? 'reduced' : 'full'
}

/** Ruft `cb` bei jeder Änderung (Systemeinstellung oder `html[data-motion]`); gibt die Abmeldung zurück. */
export function onMotionChange(cb: (motion: Motion) => void, doc: Document = document): () => void {
  let last = getMotion(doc)
  const check = () => {
    const now = getMotion(doc)
    if (now !== last) {
      last = now
      cb(now)
    }
  }
  const mql = typeof matchMedia === 'function' ? matchMedia(QUERY) : null
  mql?.addEventListener('change', check)
  const observer = new MutationObserver(check)
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mql?.removeEventListener('change', check)
    observer.disconnect()
  }
}
