// Zusätze des zugänglichen Kartennamens je Live-Zustand (DESIGN KO-07/AK-DS-10) für die Wurzel eines
// `product-status`-Bereichs (PLAN P3.11): „{Titel}, {Preis}{, gerade reserviert | , verkauft | , nicht mehr da}“.

type CardT = (key: 'stateReserved' | 'stateSold' | 'stateGone') => string

export function statusLabelAttrs(t: CardT): Record<`data-label-${string}`, string> {
  return {
    'data-label-reserved': `, ${t('stateReserved')}`,
    'data-label-sold': `, ${t('stateSold')}`,
    'data-label-gone': `, ${t('stateGone')}`,
  }
}
