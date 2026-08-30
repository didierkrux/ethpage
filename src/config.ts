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
  // Viewer deployments (e.g. ethpage.eth): with no ?name= in the URL, show
  // a name-input landing instead of the configured profile.
  viewer?: boolean
  // Public viewer to send visitors to for an instant page of their own
  // (footer pill; hidden on viewer deployments themselves).
  viewerUrl?: string
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
// CONFIG=<name> at build time selects one override (vite.config bakes it in
// as __CONFIG_NAME__ and its loader errors when several overrides exist with
// no selection, so the merge-all branch only ever sees zero or one file).
const keys = Object.keys(customModules)
  .sort()
  .filter(key => !__CONFIG_NAME__ || key === `./config.${__CONFIG_NAME__}.json`)
const custom = keys.reduce<Partial<SiteConfig>>((acc, key) => ({ ...acc, ...customModules[key].default }), {})

export const CONFIG: SiteConfig = { ...(base as SiteConfig), ...custom }

// ?name=x.eth overrides the configured name so any name can be previewed
// against the same bundle.
const NAME_RE = /^[a-z0-9-.]+\.eth$/i

function nameFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  const fromQuery = new URLSearchParams(window.location.search).get('name')
  return fromQuery && NAME_RE.test(fromQuery.trim()) ? fromQuery.trim().toLowerCase() : null
}

export const NAME_FROM_QUERY = nameFromQuery()
export const ENS_NAME = NAME_FROM_QUERY ?? CONFIG.ensName

// True when ?name= is previewing a different name than the configured one:
// name-driven data (profile, socials, recommendations) follows the preview,
// while owner-specific baked content (the links) is hidden.
export const IS_PREVIEW = ENS_NAME.toLowerCase() !== CONFIG.ensName.toLowerCase()
