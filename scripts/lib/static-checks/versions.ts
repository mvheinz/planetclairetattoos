import { runCheckVersions } from '../../check-versions'
import type { StaticCheck } from './types'

export const versionsCheck: StaticCheck = {
  name: 'versions',
  run: (root, now) => runCheckVersions(root, now),
}
