import type { Address, EIP1193Provider } from 'viem'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

// EIP-6963 multi-injected-provider discovery: each wallet extension
// (MetaMask, Rabby, Coinbase, ...) announces itself with a name and icon, so
// the user can pick one instead of getting whatever grabbed window.ethereum.
// window.ethereum remains the fallback for single-wallet browsers. The
// chosen wallet's rdns is remembered in localStorage so auto-reconnect picks
// the same one next visit.
export interface DiscoveredWallet {
  uuid: string
  name: string
  icon: string
  rdns: string
  provider: EIP1193Provider
}

interface AnnounceEvent extends Event {
  detail: { info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }
}

const announced: DiscoveredWallet[] = []
let active: EIP1193Provider | null = null
const STORAGE_KEY = 'ens-page:wallet-rdns'

// Fired when the effective provider may have changed: an explicit pick, or
// the remembered wallet announcing itself after page load (extensions inject
// asynchronously). Consumers re-subscribe their event listeners and re-read
// the connected account, so nothing stays bound to a stale provider.
const changeListeners = new Set<() => void>()

function notifyChange() {
  for (const cb of [...changeListeners]) cb()
}

export function onWalletChange(cb: () => void): () => void {
  changeListeners.add(cb)
  return () => changeListeners.delete(cb)
}

function storedRdns(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', e => {
    const { info, provider } = (e as AnnounceEvent).detail
    if (!announced.some(w => w.rdns === info.rdns)) {
      announced.push({ ...info, provider })
      // The wallet the user chose last time just showed up: switch to it.
      if (!active && info.rdns === storedRdns()) notifyChange()
    }
  })
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

export function discoveredWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined') return []
  window.dispatchEvent(new Event('eip6963:requestProvider')) // catch late-loading extensions
  if (announced.length > 0) return [...announced]
  return window.ethereum
    ? [{ uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected', provider: window.ethereum }]
    : []
}

export function selectWallet(wallet: DiscoveredWallet): void {
  const changed = active !== wallet.provider
  active = wallet.provider
  try {
    localStorage.setItem(STORAGE_KEY, wallet.rdns)
  } catch {
    /* storage unavailable (private mode) — selection just won't persist */
  }
  if (changed) notifyChange()
}

export function activeProvider(): EIP1193Provider | null {
  if (active) return active
  const remembered = announced.find(w => w.rdns === storedRdns())
  if (remembered) return (active = remembered.provider)
  if (typeof window === 'undefined') return null
  return window.ethereum ?? announced[0]?.provider ?? null
}

export async function connectWallet(): Promise<Address> {
  const provider = activeProvider()
  if (!provider) throw new Error('No wallet detected — open this page in a browser with an Ethereum wallet.')
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as Address[]
  if (!accounts?.[0]) throw new Error('Wallet connection was rejected.')
  return accounts[0]
}

// Silent auto-reconnect: eth_accounts never prompts, it only returns an
// account the wallet has already authorized for this origin.
export async function getConnectedAccount(): Promise<Address | null> {
  try {
    const provider = activeProvider()
    if (!provider) return null
    const accounts = (await provider.request({ method: 'eth_accounts' })) as Address[]
    return accounts?.[0] ?? null
  } catch {
    return null
  }
}

export function onAccountsChanged(cb: (account: Address | null) => void): () => void {
  const provider = activeProvider()
  if (!provider) return () => {}
  const handler = (accounts: readonly `0x${string}`[]) => cb(accounts?.[0] ?? null)
  try {
    provider.on('accountsChanged', handler)
    return () => provider.removeListener('accountsChanged', handler)
  } catch {
    return () => {}
  }
}
