import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createPublicClient, fallback, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { loadConfig } from './scripts/load-config'

const ROOT = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }

const config = loadConfig()
if (!config.ensName) throw new Error('ensName missing from src/config.json / src/config.custom.json')

const ENS_NAME = config.ensName
// ENS metadata service serves the name's avatar image: share previews and the
// static favicon work with zero hosted assets.
const AVATAR_URL = `https://metadata.ens.domains/mainnet/avatar/${ENS_NAME}`
// Same keyless defaults as src/lib/ens.ts (duplicated: importing the browser
// module into the node-side vite config isn't worth the coupling).
const RPCS = config.rpcUrls?.length
  ? config.rpcUrls
  : [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://cloudflare-eth.com',
      'https://eth.llamarpc.com',
    ]

function formatTitle(nickname: string | undefined): string {
  return nickname && nickname !== ENS_NAME ? `${nickname} (${ENS_NAME})` : ENS_NAME
}

// Bake the correct "Nickname (name.eth)" title into the static HTML so the
// tab and crawlers see it before any JS runs; the app re-resolves records at
// runtime and keeps the title fresh (App.tsx uses the same format).
let cachedTitle: Promise<string> | null = null
function buildTitle(): Promise<string> {
  cachedTitle ??= (async () => {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: fallback(RPCS.map(url => http(url))),
      })
      const nickname = (await client.getEnsText({ name: normalize(ENS_NAME), key: 'name' }))?.trim()
      return formatTitle(nickname || undefined)
    } catch {
      return formatTitle(undefined)
    }
  })()
  return cachedTitle
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Crawlers read share previews without running JS, so these are static: the
// one content that needs a re-pin to change.
function ensMeta(): Plugin {
  return {
    name: 'ens-meta',
    transformIndexHtml: async (html, ctx) => {
      // Only the main page gets the ENS title/OG treatment; the setup page
      // (eas-setup.html) keeps its own static title.
      if (!ctx.path.endsWith('/index.html') && ctx.path !== '/') return html
      const title = await buildTitle()
      const ogTitle = escapeAttr(config.og?.title?.trim() || title)
      const ogDescription = escapeAttr(config.og?.description?.trim() || `ENS profile for ${ENS_NAME}`)
      const meta = [
        `<meta name="description" content="${ogDescription}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${ogTitle}" />`,
        `<meta property="og:description" content="${ogDescription}" />`,
        `<meta property="og:url" content="https://${ENS_NAME}.limo/" />`,
        `<meta property="og:image" content="${AVATAR_URL}" />`,
        `<meta name="twitter:card" content="summary" />`,
        `<meta name="twitter:title" content="${ogTitle}" />`,
        `<meta name="twitter:description" content="${ogDescription}" />`,
        `<meta name="twitter:image" content="${AVATAR_URL}" />`,
        `<link rel="icon" href="${AVATAR_URL}" />`,
      ].join('\n    ')
      return html
        .replace(/<title>.*<\/title>/, `<title>${escapeAttr(title)}</title>`)
        .replace('</head>', `  ${meta}\n  </head>`)
    },
  }
}

// Stamp each build with its time so every pin has a unique CID: identical
// rebuilds otherwise produce the identical CID, which makes "which pin is
// this" ambiguous on the pinning service and prevents forcing a fresh
// contenthash.
function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    transformIndexHtml: html =>
      html.replace('</head>', `  <meta name="build" content="${new Date().toISOString()}" />\n  </head>`),
  }
}

// base './' makes all asset paths relative so the bundle works from any IPFS
// gateway path (/ipfs/<cid>/) as well as the eth.limo root.
export default defineConfig({
  base: './',
  // Surfaced in the footer so deployed pages/forks are identifiable.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), ensMeta(), buildStamp()],
  build: {
    rollupOptions: {
      input: {
        main: join(dirname(fileURLToPath(import.meta.url)), 'index.html'),
        // One-time owner tool: register the recommendations schema.
        setup: join(dirname(fileURLToPath(import.meta.url)), 'eas-setup.html'),
      },
    },
  },
})
