import { useCallback, useEffect, useState } from 'react'
import type { Hex } from 'viem'
import {
  EAS_CHAIN_NAMES,
  RECOMMENDATION_SCHEMA,
  chainInfo,
  computeSchemaUid,
  isSchemaRegistered,
  registerRecommendationSchema,
} from '../lib/eas'

// One-time owner tool (served at /eas-setup.html): registers the shared
// recommendation schema on the chosen chain — or, once anyone has registered
// it there, just hands out the UID and config snippet. The UID is
// deterministic, so it's shown before the transaction even runs.
type Status =
  | { kind: 'checking' }
  | { kind: 'registered' }
  | { kind: 'unregistered' }
  | { kind: 'error'; message: string }

export function EasSetup() {
  const [chainName, setChainName] = useState('base')
  const [status, setStatus] = useState<Status>({ kind: 'checking' })
  const [tx, setTx] = useState<Hex | null>(null)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const uid = computeSchemaUid(RECOMMENDATION_SCHEMA)
  const { chain, easscan } = chainInfo({ chain: chainName, schemaUid: uid })
  const snippet = `"recommendations": { "chain": "${chainName}", "schemaUid": "${uid}" }`

  const check = useCallback(() => {
    setStatus({ kind: 'checking' })
    setTx(null)
    isSchemaRegistered(chainName, uid)
      .then(found => setStatus({ kind: found ? 'registered' : 'unregistered' }))
      .catch(e => setStatus({ kind: 'error', message: (e as Error).message }))
  }, [chainName, uid])

  useEffect(check, [check])

  const register = () => {
    setSending(true)
    registerRecommendationSchema(chainName)
      .then(hash => {
        setTx(hash)
        // The indexer usually catches up within seconds; poll a few times.
        const poll = (attempt: number) => {
          isSchemaRegistered(chainName, uid)
            .then(found => {
              if (found) setStatus({ kind: 'registered' })
              else if (attempt < 15) setTimeout(() => poll(attempt + 1), 4000)
            })
            .catch(() => attempt < 15 && setTimeout(() => poll(attempt + 1), 4000))
        }
        poll(0)
      })
      .catch(e => setStatus({ kind: 'error', message: (e as Error).message.split('\n')[0] }))
      .finally(() => setSending(false))
  }

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 font-sans text-neutral-900">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-xl font-bold">Recommendations schema setup</h1>
        <p className="mt-2 text-sm text-neutral-600">
          One-time step to enable the Recommendations section: the{' '}
          <a href="https://attest.org" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            EAS
          </a>{' '}
          schema below must be registered on your chain. If someone already registered it there, you only need the
          config snippet.
        </p>

        <label className="mt-5 block text-sm font-medium">
          Chain
          <select
            value={chainName}
            onChange={e => setChainName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {EAS_CHAIN_NAMES.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 rounded-lg bg-neutral-50 p-3 font-mono text-xs">
          <div className="text-neutral-500">schema (revocable, no resolver)</div>
          <div className="mt-1 break-all">{RECOMMENDATION_SCHEMA}</div>
          <div className="mt-2 text-neutral-500">deterministic UID</div>
          <div className="mt-1 break-all">{uid}</div>
        </div>

        <div className="mt-4 text-sm">
          {status.kind === 'checking' && <p className="text-neutral-500">Checking {chain.name}…</p>}
          {status.kind === 'error' && (
            <p className="text-red-600">
              {status.message}{' '}
              <button onClick={check} className="underline">
                retry
              </button>
            </p>
          )}
          {status.kind === 'registered' && (
            <p className="font-medium text-green-700">
              ✓ Registered on {chain.name} —{' '}
              <a
                href={`${easscan}/schema/view/${uid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                view on EASScan
              </a>
            </p>
          )}
          {status.kind === 'unregistered' && (
            <div>
              <p className="text-neutral-600">Not registered on {chain.name} yet.</p>
              <button
                onClick={register}
                disabled={sending}
                className="mt-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {sending ? 'Confirm in wallet…' : `Register on ${chain.name} (gas ≈ cents)`}
              </button>
              {tx && (
                <p className="mt-2 text-neutral-500">
                  Transaction sent — waiting for the indexer…{' '}
                  <a
                    href={`${chain.blockExplorers?.default.url}/tx/${tx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    view
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium">Then add to src/config.json (or config.custom.json):</div>
          <div className="mt-1 flex items-start gap-2">
            <code className="block flex-1 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
              {snippet}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600 hover:border-accent"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-400">…then rebuild and re-pin. This page ships with every fork.</p>
        </div>
      </div>
    </main>
  )
}
