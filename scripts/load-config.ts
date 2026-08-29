// Node-side config loader shared by the scripts and vite.config.ts — the
// same merge src/config.ts does with import.meta.glob (which is Vite-only):
// the committed generic template overridden key-by-key by the optional
// gitignored personal config.
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface FileConfig {
  ensName?: string
  accent?: string
  repo?: string
  efp?: boolean
  og?: { title?: string; description?: string }
  rpcUrls?: string[]
  recommendations?: { chain?: string; schemaUid: string }
  links?: { title: string; url: string; emoji?: string; image?: string }[]
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const readJson = (f: string) => JSON.parse(readFileSync(join(SRC, f), 'utf8')) as FileConfig

export function loadConfig(): FileConfig {
  return {
    ...readJson('config.json'),
    ...(existsSync(join(SRC, 'config.custom.json')) ? readJson('config.custom.json') : {}),
  }
}
