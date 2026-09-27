import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

// Services mit mehreren Schreibvorgängen laufen in einer Transaktion (DATENMODELL §1.5): Gibt es in `req` schon eine,
// wird sie mitbenutzt (der Aufrufer committet); sonst startet der Helfer eine und committet bzw. verwirft sie.
export async function inTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const owns = await initTransaction(req)
  try {
    const result = await fn()
    if (owns) await commitTransaction(req)
    return result
  } catch (err) {
    if (owns) await killTransaction(req)
    throw err
  }
}
