// Minimale Typen für `potrace` (npm, GPL, nur devDependency – PLAN P8.14); genutzt von scripts/art/vectorize.ts.
declare module 'potrace' {
  export class Potrace {
    setParameters(params: Record<string, unknown>): void
    loadImage(input: Buffer, cb: (err: Error | null) => void): void
    getPathTag(): string
  }
}
