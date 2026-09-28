import { CART_CHANGE_EVENT, type CartChangeDetail } from '../behaviors/cart-count'

// Korb der Vorschau (KONZEPT §12.5 Nr. 7, ARCHITEKTUR §14.6): „In den Korb“ (`[data-pv-add-to-cart]` bzw. das
// Verhaltensmodul `add-to-cart`, ab P3) zählt die Korb-Anzeige **nur im Speicher** hoch (Ereignis
// `CART_CHANGE_EVENT` mit `detail.count`, das `cart-count` im Modus `preview` liest) und zeigt kurz „In der Vorschau zeigt
// der Korb ein Beispiel“. Kein Cookie, kein Web-Storage, kein Netz.

export interface CartDemo {
  count(): number
  add(): void
  setText(text: string): void
  destroy(): void
}

const TRIGGER = '[data-pv-add-to-cart], [data-behavior~="add-to-cart"]'
const NOTE_MS = 3200

export function installCartDemo(doc: Document): CartDemo {
  let count = 0
  let text = ''
  const note = doc.createElement('p')
  note.id = 'pv-cart-note'
  note.className = 'pv-cart-note'
  note.setAttribute('role', 'status')
  note.hidden = true
  doc.body.appendChild(note)
  let timer: ReturnType<typeof setTimeout> | null = null

  const add = () => {
    count += 1
    doc.dispatchEvent(new CustomEvent<CartChangeDetail>(CART_CHANGE_EVENT, { detail: { count } }))
    note.textContent = text
    note.hidden = false
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      note.hidden = true
      timer = null
    }, NOTE_MS)
  }

  const onClick = (event: Event) => {
    const target = event.target as Element | null
    if (!target?.closest?.(TRIGGER)) return
    event.preventDefault()
    add()
  }
  doc.addEventListener('click', onClick)

  return {
    count: () => count,
    add,
    setText(t) {
      text = t
    },
    destroy() {
      doc.removeEventListener('click', onClick)
      if (timer) clearTimeout(timer)
      note.remove()
    },
  }
}
