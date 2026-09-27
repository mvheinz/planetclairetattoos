// Gemeinsame Feldbausteine (DATENMODELL §5).
export { addressFields, validatePostalCode, type AddressOptions } from './address'
export { internalLinkFields } from './internalLink'
export { EURO_INPUT_COMPONENT, moneyField, validateCents } from './money'
export { privacyFields, validateLegalHoldReason } from './privacy'
export { SEED_KEY_REGEX, seedField, validateSeedKey } from './seed'
export { sortOrderField, validateSortOrder } from './sortOrder'
export { basicRichTextEditor, legalRichTextEditor } from './richText'
export {
  LEGAL_TEXT_VERSION_KEYS,
  LEGAL_TEXT_VERSION_TYPES,
  legalTextVersionsField,
  type LegalTextVersionKey,
} from './legalTextVersions'
