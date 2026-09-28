// Vorschau-Dialog (KONZEPT §12.5 Nr. 7): „Zahlungspflichtig bestellen“, Kassen- und Formular-Knöpfe
// (`[data-pv-block]`) und jedes Formular-Absenden (`form[data-pv-form]`) öffnen „Vorschau – hier wird nichts gekauft“
// (EN „Preview – nothing can be bought here“) und navigieren nicht. Nichts wird gesendet oder gespeichert.

export interface PreviewDialog {
  open(): void
  close(): void
  readonly el: HTMLDialogElement
  setTexts(texts: { title: string; close: string }): void
  destroy(): void
}

export function installDialogs(doc: Document): PreviewDialog {
  const dialog = doc.createElement('dialog')
  dialog.id = 'pv-dialog'
  dialog.setAttribute('aria-labelledby', 'pv-dialog-title')
  const title = doc.createElement('p')
  title.id = 'pv-dialog-title'
  title.className = 'pv-dialog__title'
  const close = doc.createElement('button')
  close.type = 'button'
  close.className = 'pv-dialog__close'
  dialog.append(title, close)
  doc.body.appendChild(dialog)

  let returnFocus: HTMLElement | null = null
  const open = () => {
    if (dialog.open) return
    returnFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    close.focus()
  }
  const doClose = () => {
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
  }
  const onClosed = () => {
    returnFocus?.focus()
    returnFocus = null
  }

  const onClick = (event: Event) => {
    const target = event.target as Element | null
    const blocked = target?.closest?.('[data-pv-block]')
    if (!blocked || dialog.contains(blocked)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    open()
  }
  const onSubmit = (event: Event) => {
    const form = event.target as Element | null
    if (!form?.closest?.('form[data-pv-form]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
    open()
  }

  close.addEventListener('click', doClose)
  dialog.addEventListener('close', onClosed)
  doc.addEventListener('click', onClick, true)
  doc.addEventListener('submit', onSubmit, true)

  return {
    el: dialog,
    open,
    close: doClose,
    setTexts(texts) {
      title.textContent = texts.title
      close.textContent = texts.close
    },
    destroy() {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('submit', onSubmit, true)
      dialog.remove()
    },
  }
}
