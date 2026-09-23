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
  // Public URL of this deployment when it is hosted on a regular web domain
  // instead of IPFS + eth.limo (e.g. https://example.com/page). Absent = the
  // name's eth.limo URL. Drives the asset base path, og:url, the QR badge and
  // the footer; see README "Host it on your own domain".
  siteUrl?: string
  links: LinkItem[]
  // EAS-backed recommendations section; absent = hidden. See README.
  recommendations?: { chain?: string; schemaUid: string }
}

// The config is chosen at build time: scripts/load-config.ts merges the
// committed generic template (config.json) with the one gitignored
// config.<name>.json override selected by CONFIG=<name>, and vite.config.ts
// bakes the result in as __SITE_CONFIG__. Nothing else is bundled, so a
// checkout holding several deployment configs ships only the selected one.
export const CONFIG: SiteConfig = __SITE_CONFIG__

// Where this deployment lives: the configured web2 URL, or the name's eth.limo.
export const SITE_URL = CONFIG.siteUrl ?? `https://${CONFIG.ensName}.limo/`

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
