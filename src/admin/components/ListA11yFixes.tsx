'use client'

import { useEffect } from 'react'

import { adminText } from '../translations'

// Barrierefreiheit der Payload-Standardlisten („Alle Daten“, KONZEPT §7.16): Payloads Auswahl-Kästchen je Zeile
// (`.select-row__checkbox`) haben ein leeres `aria-label` und ein `aria-labelledby` ohne Ziel – axe meldet „Form
// elements must have labels“ (serious). Payload 3 bietet dafür keine Einstellung; diese unsichtbare Komponente
// (Kopfbereich der Verwaltung) ergänzt den Namen „Zeile N auswählen“ – auch für später nachgeladene Zeilen
// (MutationObserver). Ebenso bekommen die Blätter-Pfeile der Seitennavigation (`.clickable-arrow`, nur Symbol) die Namen
// „Vorherige Seite“/„Nächste Seite“ (axe „button-name“, sichtbar ab mehr als einer Listenseite, z. B. mit dem
// Beispielbestand). Kontrast der Spaltenköpfe und Größe der Sortierknöpfe regelt `custom.scss`.

const SELECTOR = '.select-row__checkbox input[type="checkbox"], .select-row input[type="checkbox"]'

function labelRows(root: ParentNode): void {
  const boxes = root.querySelectorAll<HTMLInputElement>(SELECTOR)
  boxes.forEach((box) => {
    const labelledBy = box.getAttribute('aria-labelledby')
    if (labelledBy && !document.getElementById(labelledBy)) box.removeAttribute('aria-labelledby')
    if (box.getAttribute('aria-label')?.trim()) return
    const row = box.closest('tr')
    const index = row?.parentElement ? Array.from(row.parentElement.children).indexOf(row) + 1 : 0
    box.setAttribute(
      'aria-label',
      index > 0 ? adminText('listSelectRow', { n: index }) : adminText('listSelectRowPlain'),
    )
  })
}

const ARROW_SELECTOR = 'button.clickable-arrow'

function labelArrows(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>(ARROW_SELECTOR).forEach((button) => {
    if (button.getAttribute('aria-label')?.trim() || button.textContent?.trim()) return
    const next = button.classList.contains('clickable-arrow--right')
    button.setAttribute('aria-label', adminText(next ? 'listPageNext' : 'listPagePrev'))
  })
}

export function ListA11yFixes() {
  useEffect(() => {
    const fix = () => {
      labelRows(document)
      labelArrows(document)
    }
    fix()
    const observer = new MutationObserver(fix)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return null
}
