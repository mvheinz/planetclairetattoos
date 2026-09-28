import { NO_CACHE } from '../shop/fresh'

/**
 * Anfrage-Kopf wie ein Link-Vorschau-Crawler (Facebook/Instagram, WhatsApp): Für solche „HTML-only“-Bots setzt Next die
 * Metadaten immer blockierend in den `<head>`; für Browser dürfen sie bei dynamischem Rendern (Entwicklungsserver ohne
 * Daten-Cache) in den `<body>` gestreamt werden. Ohne Daten-Cache wie `NO_CACHE`.
 */
export const CRAWLER = { ...NO_CACHE, 'user-agent': 'facebookexternalhit/1.1' } as const
