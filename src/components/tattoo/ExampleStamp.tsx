import React from 'react'

import styles from './Tattoo.module.css'

// Stempel „Beispiel“/„Example“ (V-28 a, U-93) auf Flash-Motiven und Galerie-Fotos aus den Beispieldaten (`seed`; öffentlich
// nur im Vorschau-Modus sichtbar): Vorschau-Datei und Rundgang zeigen so, dass Motiv und Preis erfunden sind. Klein in der
// unteren Ecke, deckt das Motiv nicht zu. Rein optisch (`aria-hidden`) – den Text für Screenreader setzt die Karte bzw.
// der Bild-Link selbst.
export function ExampleStamp({ label }: { label: string }) {
  return (
    <span className={styles.exampleStamp} data-example-stamp="" aria-hidden="true">
      {label}
    </span>
  )
}
