import { artTags, test } from './helpers/fixtures'

// SC-00 (KUNST-QA §4.3): Rauchtest der Aufnahme – Startseite laden, einmal bis unten scrollen. Video, 3 Frames.
test('SC-00 Startseite laden und bis unten scrollen', { tag: artTags('all') }, async ({ art }) => {
  await art.goto('/de')
  await art.frame('top')
  const bottom = await art.page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - innerHeight),
  )
  await art.scrollRun(bottom, 1500)
  await art.scrollFrame(Math.round(bottom / 2), 'middle')
  await art.scrollFrame(bottom, 'bottom')
})
