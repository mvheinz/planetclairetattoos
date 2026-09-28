import { describe, expect, it } from 'vitest'

import { COCO_POSE_TO_SPRITE, SPRITE_POSES, toSpritePose } from '@/leash/poses'
import { COCO_POSES } from '@/lib/enums'

// P2.15 CMS-Posen → Sprite-IDs (DESIGN §9.1, §10.3, DATENMODELL §4).

describe('leash/poses', () => {
  it('COCO_POSE_TO_SPRITE deckt alle COCO_POSES ab, eindeutig und wie festgelegt', () => {
    expect(Object.keys(COCO_POSE_TO_SPRITE).sort()).toEqual([...COCO_POSES].sort())
    expect(COCO_POSE_TO_SPRITE).toEqual({
      run: 'rennen',
      sniff: 'schnueffeln',
      sit: 'sitzen',
      sleep: 'schlafen',
      jump: 'springen',
      head_tilt: 'kopfschief',
    })
    expect(new Set(SPRITE_POSES).size).toBe(COCO_POSES.length)
  })

  it('toSpritePose nimmt CMS-Werte und Sprite-IDs an, sonst undefined', () => {
    expect(toSpritePose('head_tilt')).toBe('kopfschief')
    expect(toSpritePose('sitzen')).toBe('sitzen')
    expect(toSpritePose('fliegen')).toBeUndefined()
    expect(toSpritePose(null)).toBeUndefined()
  })
})
