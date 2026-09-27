import { ScaffoldPage } from '@/components/layout/ScaffoldPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R21')

// R21 (KONZEPT §2.2) – Gerüst P2.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <ScaffoldPage params={params} routeId="R21" />
}
