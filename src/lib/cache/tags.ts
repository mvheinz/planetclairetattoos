// Cache-Tags (ARCHITEKTUR §9.3) – einzige Stelle für Tag-Namen.
export const TAGS = {
  products: 'products',
  home: 'home',
  sitemap: 'sitemap',
  faqs: 'faqs',
  siteTexts: 'site-texts',
  settings: 'settings',
  flash: 'flash',
  tattooOffers: 'tattoo-offers',
  tattooGallery: 'tattoo-gallery',
  product: (id: number | string) => `product:${id}`,
  category: (key: string) => `category:${key}`,
  page: (key: string) => `page:${key}`,
  legal: (type: string) => `legal:${type}`,
  media: (id: number | string) => `media:${id}`,
} as const

/** Tags eines Stücks (reserviert/freigegeben/verkauft/bearbeitet). */
export function productTags(id: number | string, category?: string | null): string[] {
  const tags = [TAGS.product(id), TAGS.products, TAGS.home, TAGS.sitemap]
  if (category) tags.push(TAGS.category(category))
  return tags
}
