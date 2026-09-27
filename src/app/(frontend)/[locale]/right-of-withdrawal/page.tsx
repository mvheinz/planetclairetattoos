import { ScaffoldPage } from '@/components/layout/ScaffoldPage'

// R24 (KONZEPT §2.2) – Gerüst P2.
export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <ScaffoldPage params={params} routeId="R24" />
}
