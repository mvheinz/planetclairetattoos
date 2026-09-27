import React from 'react'

// Marken in der Verwaltung (`admin.components.graphics`, PLAN P2.5, DESIGN §12.6): Wortmarke auf der Login-Seite,
// Planet-Marke in der Navigation. Beide Dateien kommen vom eigenen Origin (keine Fremd-Requests, R-136).

export function AdminLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG vom eigenen Origin
    <img
      src="/art/wordmark.svg"
      alt="planet claire"
      width={260}
      height={66}
      style={{ height: 66, width: 'auto' }}
    />
  )
}

export function AdminIcon() {
  // eslint-disable-next-line @next/next/no-img-element -- SVG vom eigenen Origin
  return <img src="/icon.svg" alt="" width={24} height={24} />
}
