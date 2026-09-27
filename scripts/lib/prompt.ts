// Interaktive Eingabe für CLI-Skripte; `hidden` zeigt die Eingabe nicht an (Passwörter).
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

export function promptLine(question: string, opts: { hidden?: boolean } = {}): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk: Buffer, _enc, cb) {
      if (!muted) process.stdout.write(chunk)
      cb()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      if (opts.hidden) process.stdout.write('\n')
      resolve(opts.hidden ? answer : answer.trim())
    })
    if (opts.hidden) muted = true
  })
}
