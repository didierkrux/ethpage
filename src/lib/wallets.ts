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
  // null for WalletConnect: its provider is created lazily on activation.
  provider: EIP1193Provider | null
}

export const WALLETCONNECT_RDNS = 'walletconnect'

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

// WalletConnect (opt-in via walletConnectProjectId in the config): loaded
// lazily so the main bundle carries none of its weight until someone picks
// it. The provider it yields is EIP-1193 like everything else here.
let wcProvider: EIP1193Provider | null = null

async function initWalletConnect(projectId: string, requiredChainId = 1): Promise<EIP1193Provider> {
  if (wcProvider) return wcProvider
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  wcProvider = (await EthereumProvider.init({
    projectId,
    // The chain the app signs on must be REQUIRED: optional chains are
    // frequently dropped from the session by wallets, and a session without
    // the signing chain can't send the transaction (eas.ts verifies this
    // before signing). The rest stay optional (see CHAINS in eas.ts).
    chains: [requiredChainId],
    optionalChains: [1, 8453, 10, 42161, 11155111],
    showQrModal: true,
    metadata: {
      name: document.title || 'ens-page',
      description: 'ENS profile page',
      url: window.location.origin,
      icons: [],
    },
  })) as unknown as EIP1193Provider
  return wcProvider
}

export function discoveredWallets(wcProjectId?: string): DiscoveredWallet[] {
  if (typeof window === 'undefined') return []
  window.dispatchEvent(new Event('eip6963:requestProvider')) // catch late-loading extensions
  const wallets: DiscoveredWallet[] =
    announced.length > 0
      ? [...announced]
      : window.ethereum
        ? [{ uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected', provider: window.ethereum }]
        : []
  if (wcProjectId) {
    wallets.push({ uuid: WALLETCONNECT_RDNS, name: 'WalletConnect', icon: '', rdns: WALLETCONNECT_RDNS, provider: null })
  }
  return wallets
}

export async function activateWallet(
  wallet: DiscoveredWallet,
  wcProjectId?: string,
  wcChainId?: number
): Promise<void> {
  let provider = wallet.provider
  if (!provider) {
    if (wallet.rdns !== WALLETCONNECT_RDNS || !wcProjectId) throw new Error('Wallet unavailable.')
    provider = await initWalletConnect(wcProjectId, wcChainId)
  }
  const changed = active !== provider
  active = provider
  try {
    localStorage.setItem(STORAGE_KEY, wallet.rdns)
  } catch {
    /* storage unavailable (private mode) — selection just won't persist */
  }
  if (changed) notifyChange()
}

// Auto-reconnect for WalletConnect: injected wallets restore via announce +
// storedRdns, but a WC session lives inside the (lazily loaded) provider, so
// it needs an explicit async init on page load. No-op otherwise.
export async function restoreRememberedWallet(wcProjectId?: string, wcChainId?: number): Promise<void> {
  if (!wcProjectId || active || storedRdns() !== WALLETCONNECT_RDNS) return
  try {
    active = await initWalletConnect(wcProjectId, wcChainId)
    notifyChange()
  } catch {
    /* relay unreachable: fall back to whatever activeProvider() finds */
  }
}

// Explicit disconnect: for WalletConnect this ends the session (otherwise it
// lingers in localStorage and gets restored — including sessions whose chain
// approvals turned out unusable); either way the remembered choice clears.
export async function disconnectWallet(): Promise<void> {
  if (active && active === wcProvider) {
    try {
      await (active as unknown as { disconnect: () => Promise<void> }).disconnect()
    } catch {
      /* session may already be dead on the relay side */
    }
    wcProvider = null
  }
  active = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
  notifyChange()
}

export function activeProvider(): EIP1193Provider | null {
  if (active) return active
  const remembered = announced.find(w => w.rdns === storedRdns())
  if (remembered) return (active = remembered.provider)
  if (typeof window === 'undefined') return null
  return window.ethereum ?? announced[0]?.provider ?? null
}

// True when the given provider is the WalletConnect one: its requests are
// relayed to a remote wallet, so callers must avoid methods that would
// re-prompt the phone (eth_requestAccounts, wallet_switchEthereumChain).
export function isWalletConnect(provider: EIP1193Provider | null): boolean {
  return provider !== null && provider === wcProvider
}

export async function connectWallet(): Promise<Address> {
  const provider = activeProvider()
  if (!provider) throw new Error('No wallet detected. Open this page in a browser with an Ethereum wallet.')
  if (isWalletConnect(provider)) {
    // connect() opens the QR modal only when no session exists; with a
    // session, eth_accounts is answered locally. eth_requestAccounts would
    // be relayed to the phone as a fresh approval prompt, so never send it.
    const wc = provider as unknown as { session?: unknown; connect: () => Promise<void> }
    if (!wc.session) await wc.connect()
    const accounts = (await provider.request({ method: 'eth_accounts' })) as Address[]
    if (!accounts?.[0]) throw new Error('Wallet connection was rejected.')
    return accounts[0]
  }
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
