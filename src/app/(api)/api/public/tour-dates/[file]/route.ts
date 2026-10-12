import { tourIcsResponse } from '@/lib/tour/icsResponse'

// `GET /api/public/tour-dates/<id>.ics?locale=de|en` (V-60, ARCHITEKTUR §2.5): „In den Kalender“ für einen Markttermin
// auf dem Schaukasten „on Tour“. Logik in `src/lib/tour/icsResponse.ts`, Datei in `src/lib/tour/ics.ts`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params
  const locale = new URL(request.url).searchParams.get('locale')
  return tourIcsResponse(decodeURIComponent(file), locale, { now: new Date() })
}
