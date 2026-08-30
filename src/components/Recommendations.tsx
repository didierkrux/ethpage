import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck } from 'lucide-react'
import type { Address, Hex } from 'viem'
import { CONFIG, ENS_NAME } from '../config'
import { lookupEnsName, resolveEnsAddress } from '../lib/ens'
import { chainInfo, fetchRecommendations, submitRecommendation, type Recommendation } from '../lib/eas'
// Deep import: the package root would drag all icons into the dev prebundle.
import SiWalletconnect from '@icons-pack/react-simple-icons/icons/SiWalletconnect'
import {
  WALLETCONNECT_RDNS,
  activateWallet,
  connectWallet,
  disconnectWallet,
  discoveredWallets,
  getConnectedAccount,
  onAccountsChanged,
  onWalletChange,
  restoreRememberedWallet,
  type DiscoveredWallet,
} from '../lib/wallets'
import { blockieDataUri } from '../lib/blockies'
import type { Loadable } from '../types'

// ENS avatar when the attester has a name, otherwise (or when the avatar
// image fails) the address's blockie identicon.
function AttesterAvatar({ attester, attesterName }: { attester: Address; attesterName: string | null }) {
  const blockie = blockieDataUri(attester)
  return (
    <img
      src={attesterName ? `https://metadata.ens.domains/mainnet/avatar/${attesterName}` : blockie}
      alt=""
      onError={e => {
        if (e.currentTarget.src !== blockie) e.currentTarget.src = blockie
      }}
      className="h-8 w-8 shrink-0 rounded-full bg-neutral-200 object-cover dark:bg-white/10"
    />
  )
}

// Only rendered when the config declares it (App gates on schemaUid).
const cfg = CONFIG.recommendations!
const wcId = CONFIG.walletConnectProjectId

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function monthYear(time: number): string {
  return new Date(time * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function Recommendations() {
  const [state, setState] = useState<Loadable<{ receiver: Address; recs: Recommendation[] }>>({ status: 'loading' })
  const [viewer, setViewer] = useState<Address | null>(null)
  const [viewerName, setViewerName] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTx, setSentTx] = useState<Hex | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Minimal EIP-6963 wallet picker: shown when several wallets are injected.
  const [picker, setPicker] = useState<DiscoveredWallet[] | null>(null)
  const [submitAfterConnect, setSubmitAfterConnect] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const receiver = await resolveEnsAddress(ENS_NAME, CONFIG.rpcUrls)
        if (!receiver) throw new Error('name has no address')
        const recs = await fetchRecommendations(cfg, receiver, CONFIG.rpcUrls)
        setState({ status: 'ready', data: { receiver, recs } })
      } catch {
        // The section hides on indexer/RPC failure rather than breaking the page.
        setState({ status: 'error' })
      }
    })()
  }, [])

  // Auto-reconnect (silent) + follow wallet account switches. onWalletChange
  // re-binds everything when the effective provider changes (a pick in the
  // EIP-6963 picker, or the remembered wallet announcing late), so account
  // events never keep flowing from a stale provider.
  useEffect(() => {
    let unsubAccounts = onAccountsChanged(setViewer)
    const sync = () => getConnectedAccount().then(a => a && setViewer(a))
    const unsubWallet = onWalletChange(() => {
      unsubAccounts()
      unsubAccounts = onAccountsChanged(setViewer)
      sync()
    })
    // Restores a remembered WalletConnect session (fires onWalletChange).
    restoreRememberedWallet(wcId, chainInfo(cfg).chain.id)
    sync()
    return () => {
      unsubAccounts()
      unsubWallet()
    }
  }, [])

  useEffect(() => {
    setViewerName(null)
    if (viewer) lookupEnsName(viewer, CONFIG.rpcUrls).then(setViewerName)
  }, [viewer])

  const connect = useCallback(() => {
    setError(null)
    const wallets = discoveredWallets(wcId)
    if (wallets.length > 1) {
      setPicker(wallets)
      return
    }
    const activate = wallets[0] ? activateWallet(wallets[0], wcId, chainInfo(cfg).chain.id) : Promise.resolve()
    activate
      .then(connectWallet)
      .then(setViewer)
      .catch(e => setError((e as Error).message))
  }, [])

  if (state.status !== 'ready') return null
  const { receiver, recs } = state.data
  const { easscan, chain } = chainInfo(cfg)

  const doSubmit = () => {
    setSending(true)
    setError(null)
    // Watchdog: some wallets never answer a rejected WalletConnect request,
    // which would otherwise leave this promise (and the button) hanging
    // forever. 90s is generous for a legitimate confirm.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'No response from the wallet. If you rejected the request there, just try again. If you approved it late, check EASScan before resending.'
            )
          ),
        90_000
      )
    )
    Promise.race([submitRecommendation(cfg, { recipient: receiver, relationship, recommendation: text }), timeout])
      .then(hash => {
        setSentTx(hash)
        setFormOpen(false)
        setRelationship('')
        setText('')
        // Signing connected the wallet; reflect it so EFP links can point at
        // the author's actual profile.
        getConnectedAccount().then(a => a && setViewer(a))
      })
      .catch(e => {
        console.error('recommendation submit failed:', e)
        setError((e as Error).message.split('\n')[0])
      })
      .finally(() => setSending(false))
  }

  const pick = (wallet: DiscoveredWallet) => {
    setPicker(null)
    activateWallet(wallet, wcId, chainInfo(cfg).chain.id)
      .then(connectWallet)
      .then(v => {
        setViewer(v)
        if (submitAfterConnect) {
          setSubmitAfterConnect(false)
          doSubmit()
        }
      })
      .catch(e => {
        setSubmitAfterConnect(false)
        setError((e as Error).message)
      })
  }

  const isOwner = !!viewer && viewer.toLowerCase() === receiver.toLowerCase()
  // Owner sees everything; a connected author also sees their own pending
  // recommendation (with a "not approved yet" note); everyone else sees only
  // the EFP-approved ones.
  const shown = isOwner
    ? recs
    : recs.filter(r => r.isPublic || (viewer && r.attester.toLowerCase() === viewer.toLowerCase()))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    // Several wallet options and none chosen yet: pick first, then sign.
    if (!viewer && discoveredWallets(wcId).length > 1) {
      setPicker(discoveredWallets(wcId))
      setSubmitAfterConnect(true)
      return
    }
    doSubmit()
  }

  return (
    <section className="mt-8">
      <h2 className="text-center font-display text-lg font-bold">Onchain recommendations</h2>
      <p className="mt-1 text-center text-xs text-neutral-400 dark:text-neutral-500">
        Wallet-signed EAS attestations, published once {ENS_NAME} follows the author on EFP
      </p>

      {shown.length > 0 && (
        <div className="mt-4 space-y-3">
          {shown.map(r => (
            <figure
              key={r.uid}
              className="relative rounded-xl border border-neutral-200/70 bg-white/70 p-4 pl-5 text-left shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -top-0.5 left-2 select-none font-display text-5xl leading-none text-accent/20"
              >
                “
              </span>
              <blockquote className="whitespace-pre-line pl-5 text-neutral-800 dark:text-neutral-200">
                {r.recommendation}
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2.5 pl-5">
                <AttesterAvatar attester={r.attester} attesterName={r.attesterName} />
                <span className="min-w-0 text-sm">
                  <a
                    href={`${easscan}/attestation/view/${r.uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View the attestation on EASScan"
                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    {r.attesterName ?? shortAddress(r.attester)}
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  </a>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {r.relationship && <>{r.relationship} · </>}
                    {monthYear(r.time)}
                  </span>
                </span>
              </figcaption>
              {!r.isPublic && (
                <p className="mt-2 pl-5 text-xs text-amber-600 dark:text-amber-400">
                  {isOwner ? (
                    <>
                      Only visible to you.{' '}
                      <a
                        href={`https://efp.app/${r.attester}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        follow them on EFP
                      </a>{' '}
                      to publish it.
                    </>
                  ) : (
                    <>
                      Pending approval: visible only to you and {ENS_NAME}. It goes public once {ENS_NAME} follows
                      your wallet on{' '}
                      <a
                        href={`https://efp.app/${r.attester}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        EFP
                      </a>
                      .
                    </>
                  )}
                </p>
              )}
            </figure>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No public recommendations yet. Be the first.
        </p>
      )}

      {sentTx ? (
        <p className="mt-3 text-center text-sm text-neutral-600 dark:text-neutral-300">
          Recommendation submitted! It appears once indexed, and publicly once {ENS_NAME} follows you on{' '}
          <a
            href={viewer ? `https://efp.app/${viewer}` : 'https://efp.app'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            EFP
          </a>
          .{' '}
          <a
            href={`${chain.blockExplorers?.default.url}/tx/${sentTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            View transaction
          </a>
        </p>
      ) : formOpen ? (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-neutral-200/70 bg-neutral-50/70 p-4 text-left backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
          <input
            value={relationship}
            onChange={e => setRelationship(e.target.value)}
            placeholder="How do you know them? (optional)"
            aria-label="How do you know them"
            maxLength={80}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Your recommendation for ${ENS_NAME}…`}
            aria-label={`Your recommendation for ${ENS_NAME}`}
            required
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {sending ? 'Confirm in wallet…' : 'Sign attestation'}
            </button>
            <button
              type="button"
              onClick={() => {
                // Always an escape hatch, even if a wallet request hangs:
                // closing the form also clears the in-flight state.
                setFormOpen(false)
                setSending(false)
                setError(null)
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Signs an onchain EAS attestation on {chain.name} (gas ≈ cents). It becomes publicly visible once{' '}
            {ENS_NAME} follows you on{' '}
            <a
              href={viewer ? `https://efp.app/${viewer}` : 'https://efp.app'}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              EFP
            </a>
            .
          </p>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            onClick={() => {
              setError(null)
              setFormOpen(true)
            }}
            className="rounded-full bg-neutral-900 px-5 py-2 font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Recommend {ENS_NAME}
          </button>
          {viewer ? (
            <button
              onClick={() => disconnectWallet().then(() => setViewer(null))}
              title="Disconnect"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/70 bg-white/60 px-4 py-2 text-neutral-600 transition hover:border-accent dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
            >
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {viewerName ?? shortAddress(viewer)}
            </button>
          ) : (
            <button
              onClick={connect}
              title="Connect to see pending recommendations (page owner or author)"
              className="rounded-full border border-neutral-200/70 bg-white/60 px-4 py-2 font-medium text-accent transition hover:border-accent dark:border-white/10 dark:bg-white/5"
            >
              Connect wallet
            </button>
          )}
          <a
            href={`${easscan}/address/${receiver}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            View all on EASScan
          </a>
        </div>
      )}

      {picker && (
        <div className="mx-auto mt-3 max-w-xs rounded-xl border border-neutral-200/70 bg-white/90 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/90">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Choose a wallet</span>
            <button
              onClick={() => {
                setPicker(null)
                setSubmitAfterConnect(false)
              }}
              aria-label="Close"
              className="px-1 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 grid gap-2">
            {picker.map(w => (
              <button
                key={w.uuid}
                onClick={() => pick(w)}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm transition hover:border-accent dark:border-white/10"
              >
                {w.rdns === WALLETCONNECT_RDNS ? (
                  <SiWalletconnect className="h-5 w-5 shrink-0 text-[#3B99FC]" />
                ) : w.icon ? (
                  <img src={w.icon} alt="" className="h-5 w-5 rounded" />
                ) : (
                  <span className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                )}
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
