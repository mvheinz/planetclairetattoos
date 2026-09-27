import 'server-only'

// Versand-Adapter (ARCHITEKTUR §3.7): ab P1 als Gerüst, genutzt ab P5. Keine API („Später“: DHL-API-Labels, E-26).

export type CarrierCode = 'dhl' | 'deutsche_post'

/** Eintrag aus `settings.shipping.trackingUrlTemplates` (DATENMODELL §7.1). */
export interface TrackingUrlTemplate {
  carrier: CarrierCode
  /** Muss `{trackingNumber}` enthalten; optional `{locale}`. */
  urlTemplate: string
}

export interface CarrierAdapter {
  readonly driver: 'manual'
  /** Vorlage aus den Einstellungen; ohne Vorlage oder ohne Nummer `null`. */
  trackingUrl(carrier: CarrierCode, trackingNumber: string, locale: 'de' | 'en'): string | null
  /** Format-Plausibilität. */
  validateTrackingNumber(carrier: CarrierCode, trackingNumber: string): boolean
  /** Nicht implementiert (E-26). */
  createLabel?(orderId: number): Promise<never>
}
