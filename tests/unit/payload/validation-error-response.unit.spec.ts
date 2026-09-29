import { describe, expect, it } from 'vitest'

import { keepValidationErrorData } from '@/lib/payload/validationErrorResponse'

// P5.6: Feldfehler bleiben in der REST-Antwort erhalten, auch wenn Payloads `instanceof`-Prüfung fehlschlägt.

type Args = Parameters<typeof keepValidationErrorData>[0]

const validationError = () =>
  Object.assign(new Error('The following field is invalid: conformityDeclarations'), {
    name: 'ValidationError',
    data: {
      collection: 'products',
      errors: [{ path: 'conformityDeclarations', message: 'Konformitätserklärungen: …' }],
    },
  })

describe('keepValidationErrorData (P5.6)', () => {
  it('ergänzt data.errors, wenn die formatierte Antwort sie verloren hat', () => {
    const error = validationError()
    const out = keepValidationErrorData({
      error,
      result: { errors: [{ message: error.message }] },
    } as unknown as Args)
    expect(out).toEqual({
      response: {
        errors: [{ name: 'ValidationError', message: error.message, data: error.data }],
      },
    })
  })

  it('lässt andere Fehler und schon vollständige Antworten unverändert', () => {
    const other = new Error('boom')
    expect(
      keepValidationErrorData({
        error: other,
        result: { errors: [{ message: 'boom' }] },
      } as unknown as Args),
    ).toBeUndefined()
    const error = validationError()
    expect(
      keepValidationErrorData({
        error,
        result: { errors: [{ message: error.message, data: error.data }] },
      } as unknown as Args),
    ).toBeUndefined()
  })
})
