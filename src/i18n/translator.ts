import { createTranslator } from 'next-intl'

import { APP_TIME_ZONE } from '@/lib/time'

import de from './messages/de.json'
import en from './messages/en.json'

// Übersetzer ohne Hook (P7, TBT): für Server-Komponenten mit `locale`-Prop, die auch in nicht hydriertem HTML
// (`StaticHtml`) stehen. Dort laufen sie außerhalb des React-Renderers, `useTranslations` (braucht `use()`) ginge nicht.
// Dieselben Nachrichten und dieselbe Zeitzone wie `src/i18n/request.ts` → gleiche Texte. Nur serverseitig importieren
// (zieht beide Nachrichtendateien).
const MESSAGES = { de, en } as const

export type Translate = (key: string, values?: Record<string, string | number | Date>) => string

export function translatorFor(locale: 'de' | 'en', namespace: string): Translate {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: namespace as never,
    timeZone: APP_TIME_ZONE,
  }) as unknown as Translate
}
