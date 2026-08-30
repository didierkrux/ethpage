// Node-side config loader shared by the scripts and vite.config.ts — the
// same merge src/config.ts does with import.meta.glob (which is Vite-only):
// the committed generic template overridden key-by-key by any gitignored
// config.<name>.json personal config, in filename order.
import { readdirSync, readFileSync } from 'node:fs'
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

// With several deployments in one checkout (e.g. a personal page and the
// public ethpage.eth viewer), CONFIG=<name> selects config.<name>.json.
// With exactly one override present it is used implicitly; with several and
// no CONFIG the build fails loudly instead of merging them by accident.
export function loadConfig(): FileConfig {
  const overrides = readdirSync(SRC)
    .filter(f => /^config\..+\.json$/.test(f) && f !== 'config.json')
    .sort()
  const selected = process.env.CONFIG
  if (selected) {
    const file = `config.${selected}.json`
    if (!overrides.includes(file)) {
      throw new Error(`CONFIG=${selected} but src/${file} does not exist (found: ${overrides.join(', ') || 'none'})`)
    }
    return { ...readJson('config.json'), ...readJson(file) }
  }
  if (overrides.length > 1) {
    throw new Error(
      `Several config overrides found (${overrides.join(', ')}). Pick one with CONFIG=<name>, e.g. CONFIG=${overrides[0].slice(7, -5)} pnpm dev`
    )
  }
  return overrides.reduce((acc, f) => ({ ...acc, ...readJson(f) }), { ...readJson('config.json') })
}
