// JSON-Dateien so schreiben, wie sie im Repo stehen (kleiner Diff beim Zurückspielen, U-89): von Prettier erfasste
// Dateien mit Prettier, ausgenommene (`content/` laut .prettierignore) mit JSON.stringify(…, null, 2).
import path from 'node:path'

import prettier from 'prettier'

export async function formatJson(root: string, file: string, value: unknown): Promise<string> {
  const plain = `${JSON.stringify(value, null, 2)}\n`
  const info = await prettier.getFileInfo(file, { ignorePath: path.join(root, '.prettierignore') })
  if (info.ignored) return plain
  const options = (await prettier.resolveConfig(file)) ?? {}
  return prettier.format(plain, { ...options, filepath: file })
}
