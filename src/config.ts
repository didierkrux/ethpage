import base from './config.json'

export interface LinkItem {
  title: string
  url: string
  emoji?: string
  image?: string
}

export interface SiteConfig {
  ensName: string
  accent?: string
  repo?: string
  efp?: boolean
  og?: { title?: string; description?: string }
  rpcUrls?: string[]
  links: LinkItem[]
  // EAS-backed recommendations section; absent = hidden. See README.
  recommendations?: { chain?: string; schemaUid: string }
}

// config.json is the committed generic template; an optional gitignored
// config.custom.json (same schema) holds the owner's real config and wins
// key-by-key, so the repo and every fork stay a pristine template.
// import.meta.glob tolerates the file being absent (empty result). This
// module is Vite-only — node scripts fs-read and merge the two files
// themselves instead of importing it.
const customModules = import.meta.glob('./config.custom.json', { eager: true }) as Record<
  string,
  { default: Partial<SiteConfig> }
>
const custom = customModules['./config.custom.json']?.default ?? {}

export const CONFIG: SiteConfig = { ...(base as SiteConfig), ...custom }

// ?name=x.eth overrides the configured name so any name can be previewed
// against the same bundle.
const NAME_RE = /^[a-z0-9-.]+\.eth$/i

function resolveName(): string {
  if (typeof window !== 'undefined') {
    const fromQuery = new URLSearchParams(window.location.search).get('name')
    if (fromQuery && NAME_RE.test(fromQuery.trim())) return fromQuery.trim().toLowerCase()
  }
  return CONFIG.ensName
}

export const ENS_NAME = resolveName()
