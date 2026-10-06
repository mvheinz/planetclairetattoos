import { describe, expect, it } from 'vitest'

import { flakyTests } from '../../../scripts/ci/flaky-check'

describe('Flaky-Wächter (P10.2)', () => {
  it('findet nur Tests mit Status flaky, auch in verschachtelten Suiten', () => {
    const report = {
      suites: [
        {
          file: 'a.e2e.spec.ts',
          specs: [{ title: 'grün', tests: [{ status: 'expected', projectName: 'desktop' }] }],
          suites: [
            {
              specs: [
                { title: 'wackelt', tests: [{ status: 'flaky', projectName: 'pixel-7' }] },
                { title: 'rot', tests: [{ status: 'unexpected' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(flakyTests(report)).toEqual(['a.e2e.spec.ts › wackelt [pixel-7]'])
    expect(flakyTests({})).toEqual([])
  })
})
