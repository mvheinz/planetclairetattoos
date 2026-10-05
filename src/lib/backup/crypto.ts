import 'server-only'

import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { createGunzip, createGzip } from 'node:zlib'

import { Decrypter, Encrypter } from 'age-encryption'

// Verschlüsselung vor dem Upload (ARCHITEKTUR §10.1 BK-2): gzip (Stufe 6) → age (X25519) als Strom. Der private
// Schlüssel (`AGE-SECRET-KEY-1…`) kommt nur aus einer Datei (`--identity`), nie aus einer Umgebungsvariable.

export const AGE_MAGIC = 'age-encryption.org/v1'

const toWeb = (r: Readable) => Readable.toWeb(r) as unknown as ReadableStream<Uint8Array>
const fromWeb = (w: ReadableStream<Uint8Array>) =>
  Readable.fromWeb(w as unknown as Parameters<typeof Readable.fromWeb>[0])

/** Klartext → gzip → age. */
export async function encryptStream(plain: Readable, recipient: string): Promise<Readable> {
  if (!/^age1[0-9a-z]+$/.test(recipient)) {
    throw new Error('BACKUP_AGE_RECIPIENT ist kein öffentlicher age-Schlüssel (age1…).')
  }
  const gz = plain.pipe(createGzip({ level: 6 }))
  plain.on('error', (e) => gz.destroy(e))
  const enc = new Encrypter()
  enc.addRecipient(recipient)
  return fromWeb(await enc.encrypt(toWeb(gz)))
}

/** age → gunzip → Klartext. Ein Fehler der Entschlüsselung (falscher Schlüssel, beschädigt) beendet den Strom mit Fehler. */
export async function decryptStream(cipher: Readable, identity: string): Promise<Readable> {
  const dec = new Decrypter()
  dec.addIdentity(identity)
  const plainGz = fromWeb(await dec.decrypt(toWeb(cipher)))
  const gunzip = createGunzip()
  plainGz.on('error', (e) => gunzip.destroy(e))
  return plainGz.pipe(gunzip)
}

/** Aus dem Inhalt einer Schlüsseldatei die `AGE-SECRET-KEY-1…`-Zeile (Kommentare `#` werden ignoriert). */
export function parseIdentityFile(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('AGE-SECRET-KEY-1'))
  if (!line) throw new Error('Die Schlüsseldatei enthält keine Zeile AGE-SECRET-KEY-1…')
  return line
}

/** Durchreicher, der SHA-256 und Größe der durchlaufenden Bytes mitführt. */
export function hashingPassThrough(maxBytes = Infinity): {
  stream: Transform
  result: () => { sha256: string; sizeBytes: number }
} {
  const hash = createHash('sha256')
  let size = 0
  const stream = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk)
      size += chunk.length
      if (size > maxBytes)
        return cb(new Error(`Backup größer als ${Math.round(maxBytes / 1048576)} MB (A12)`))
      cb(null, chunk)
    },
  })
  return { stream, result: () => ({ sha256: hash.copy().digest('hex'), sizeBytes: size }) }
}
