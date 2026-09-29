import 'server-only'

export {
  AdminFooter,
  adminFooterText,
  adminLink,
  CustomerFooter,
  customerFooterText,
} from './footer'
export type { CustomerFooterInput, MailBusiness } from './footer'
export { CidImage } from './CidImage'
export { EmailLayout, type EmailLayoutProps } from './EmailLayout'
export { COCO_CID, cocoVignette } from './images'
export { mailLinks, STATUS_TOKEN_PLACEHOLDER, type MailLinks } from './links'
export { renderMailHtml } from './render'
export { MAIL_WIDTH } from './styles'
