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
  // Enables the WalletConnect option in the wallet picker (mobile signing).
  // Free project id from cloud.reown.com; absent = injected wallets only.
  walletConnectProjectId?: string
  links: LinkItem[]
  // EAS-backed recommendations section; absent = hidden. See README.
  recommendations?: { chain?: string; schemaUid: string }
}

// config.json is the committed generic template; any gitignored
// config.<name>.json (same schema, e.g. config.yourname.json) holds the
// owner's real config and wins key-by-key, so the repo and every fork stay
// a pristine template. import.meta.glob tolerates no file being present
// (empty result); multiple overrides merge in filename order. This module
// is Vite-only — node scripts fs-read and merge the files themselves.
const customModules = import.meta.glob('./config.*.json', { eager: true }) as Record<
  string,
  { default: Partial<SiteConfig> }
>
const custom = Object.keys(customModules)
  .sort()
  .reduce<Partial<SiteConfig>>((acc, key) => ({ ...acc, ...customModules[key].default }), {})

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

// True when ?name= is previewing a different name than the configured one:
// name-driven data (profile, socials, recommendations) follows the preview,
// while owner-specific baked content (the links) is hidden.
export const IS_PREVIEW = ENS_NAME.toLowerCase() !== CONFIG.ensName.toLowerCase()
