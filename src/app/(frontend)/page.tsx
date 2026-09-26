import React from 'react'

// P0-Platzhalter: bewusst statisch und ohne Datenbankzugriff, damit der Build ohne DB läuft.
// Wird in P2/P3 durch die Startseite mit Tuschelinie ersetzt (siehe docs/KONZEPT.md und docs/design/DESIGN.md).
export default function HomePage() {
  return (
    <div className="placeholder">
      <p className="kicker">planetclairetattoos.com</p>
      <h1>Planet Claire</h1>
      <p>Tattoos, handgemachte Unikat-Keramik und Zeichnungen aus Berlin. Hier entsteht gerade etwas.</p>
      <p>
        <a href="https://www.instagram.com/planet.claire.tattoos/" rel="noopener noreferrer">
          @planet.claire.tattoos
        </a>
      </p>
    </div>
  )
}
