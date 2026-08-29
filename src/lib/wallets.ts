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

if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', e => {
    const { info, provider } = (e as AnnounceEvent).detail
    if (!announced.some(w => w.rdns === info.rdns)) announced.push({ ...info, provider })
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
  active = wallet.provider
  try {
    localStorage.setItem(STORAGE_KEY, wallet.rdns)
  } catch {
    /* storage unavailable (private mode) — selection just won't persist */
  }
}

export function activeProvider(): EIP1193Provider | null {
  if (active) return active
  try {
    const rdns = localStorage.getItem(STORAGE_KEY)
    const remembered = announced.find(w => w.rdns === rdns)
    if (remembered) return (active = remembered.provider)
  } catch {
    /* storage unavailable */
  }
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
