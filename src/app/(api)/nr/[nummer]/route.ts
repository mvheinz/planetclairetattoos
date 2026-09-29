import { resolveShortLink } from '../resolve'

// R31 `/nr/[nummer]` (KONZEPT §2.4, ARCHITEKTUR §2.3): Kurzlink auf die Produktseite (Logik in `../resolve.ts`).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nummer: string }> },
): Promise<Response> {
  const { nummer } = await params
  return resolveShortLink(request, decodeURIComponent(nummer))
}
