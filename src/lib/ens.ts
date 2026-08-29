import { createPublicClient, fallback, http, type Address, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { SOCIAL_KEYS } from './socials'

// Keyless public RPCs — nothing to sign up for. Requests come from each
// visitor's browser and multicall batching collapses a page load into 1-2
// eth_calls, so public per-IP rate limits are irrelevant at this scale.
// Override with "rpcUrls" in the config (passed in by the caller: this
// module deliberately doesn't import ../config, which is Vite-only, so the
// node-run scripts can use it too).
const DEFAULT_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://cloudflare-eth.com',
  'https://eth.llamarpc.com',
]

let cached: { urls: string[]; client: PublicClient } | null = null

function getClient(rpcUrls?: string[]): PublicClient {
  const urls = rpcUrls?.length ? rpcUrls : DEFAULT_RPCS
  if (!cached || cached.urls.join() !== urls.join()) {
    cached = {
      urls,
      client: createPublicClient({
        chain: mainnet,
        batch: { multicall: true },
        transport: fallback(urls.map(url => http(url))),
      }),
    }
  }
  return cached.client
}

export async function resolveEnsAddress(rawName: string, rpcUrls?: string[]): Promise<Address | null> {
  try {
    return await getClient(rpcUrls).getEnsAddress({ name: normalize(rawName) })
  } catch {
    return null
  }
}

export async function lookupEnsName(address: Address, rpcUrls?: string[]): Promise<string | null> {
  try {
    return await getClient(rpcUrls).getEnsName({ address })
  } catch {
    return null
  }
}

export interface EnsProfile {
  name: string
  displayName: string
  avatar: string | null
  header: string | null
  description: string | null
  url: string | null
  socials: { key: string; value: string }[]
}

const PROFILE_KEYS = ['name', 'avatar', 'header', 'description', 'url'] as const

// Avatar and header render through the ENS metadata service rather than the
// raw record value: records commonly point at public IPFS gateways (ipfs.io
// et al.) whose bot protection 403s hotlinked browser requests, and NFT-style
// references (eip155:...) aren't <img>-renderable at all. The metadata
// service resolves both server-side and caches. The records are still read —
// their presence decides whether to render at all.
const METADATA = 'https://metadata.ens.domains/mainnet'

export async function fetchEnsProfile(rawName: string, rpcUrls?: string[]): Promise<EnsProfile> {
  const client = getClient(rpcUrls)
  const name = normalize(rawName)
  const keys = [...PROFILE_KEYS, ...SOCIAL_KEYS]

  // getEnsText returns null for missing records; per-key catch demotes a
  // single flaky read to "record absent" instead of failing the whole page.
  const values = await Promise.all(keys.map(key => client.getEnsText({ name, key }).catch(() => null)))

  const record = new Map(keys.map((key, i) => [key as string, values[i]]))
  const text = (key: string) => {
    const v = record.get(key)?.trim()
    return v ? v : null
  }

  return {
    name,
    displayName: text('name') ?? name,
    avatar: text('avatar') ? `${METADATA}/avatar/${name}` : null,
    header: text('header') ? `${METADATA}/header/${name}` : null,
    description: text('description'),
    url: text('url'),
    socials: SOCIAL_KEYS.flatMap(key => {
      const value = text(key)
      return value ? [{ key, value }] : []
    }),
  }
}
