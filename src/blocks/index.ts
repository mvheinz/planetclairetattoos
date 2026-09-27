import type { Block } from 'payload'

import { AftercareSteps } from './AftercareSteps'
import { Callout } from './Callout'
import { CategoryTeaser } from './CategoryTeaser'
import { CommissionForm } from './CommissionForm'
import { ContactLinks } from './ContactLinks'
import { FaqList } from './FaqList'
import { FlashGrid } from './FlashGrid'
import { Hero } from './Hero'
import { ImageGallery } from './ImageGallery'
import { ImageText } from './ImageText'
import { OffersList } from './OffersList'
import { PriceInfo } from './PriceInfo'
import { ProcessSteps } from './ProcessSteps'
import { ProductTeaser } from './ProductTeaser'
import { RichTextBlock } from './RichText'
import { Station } from './Station'
import { TattooGalleryBlock } from './TattooGallery'

// Blöcke der Seiten (DATENMODELL §6.19).
export const PAGE_BLOCKS: Block[] = [
  Hero,
  Station,
  RichTextBlock,
  ImageText,
  ImageGallery,
  ProductTeaser,
  CategoryTeaser,
  FlashGrid,
  OffersList,
  TattooGalleryBlock,
  PriceInfo,
  ProcessSteps,
  AftercareSteps,
  FaqList,
  ContactLinks,
  CommissionForm,
  Callout,
]

export { STATION_ID_RE } from './Station'
