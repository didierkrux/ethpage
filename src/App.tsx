import { useCallback, useEffect, useState } from 'react'
import { GitFork } from 'lucide-react'
import { CONFIG, ENS_NAME } from './config'
import { fetchEnsProfile, type EnsProfile } from './lib/ens'
import { Profile, ProfileSkeleton } from './components/Profile'
import { Links } from './components/Links'
import { Recommendations } from './components/Recommendations'
import { QrBadge } from './components/QrBadge'
import type { Loadable } from './types'

export default function App() {
  const [profile, setProfile] = useState<Loadable<EnsProfile>>({ status: 'loading' })

  const loadProfile = useCallback(() => {
    setProfile({ status: 'loading' })
    fetchEnsProfile(ENS_NAME, CONFIG.rpcUrls)
      .then(data => {
        setProfile({ status: 'ready', data })
        // Tab title and favicon follow the ENS records, like the rest of the
        // page: record edits, no redeploy. Same "Nickname (name.eth)" format
        // as the build-time baked title.
        document.title = data.displayName !== ENS_NAME ? `${data.displayName} (${ENS_NAME})` : ENS_NAME
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (icon && data.avatar) icon.href = data.avatar
      })
      .catch(() => setProfile({ status: 'error' }))
  }, [])

  useEffect(() => {
    document.title = ENS_NAME // until the name record loads
    loadProfile()
  }, [loadProfile])

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-4 font-sans text-neutral-900 sm:py-6">
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        {profile.status === 'loading' && <ProfileSkeleton />}
        {profile.status === 'error' && (
          <div className="py-12 text-center">
            <p className="text-neutral-600">Could not load the {ENS_NAME} profile.</p>
            <button
              onClick={loadProfile}
              className="mt-4 rounded-full bg-neutral-900 px-6 py-2 font-medium text-white transition hover:bg-neutral-700"
            >
              Retry
            </button>
          </div>
        )}
        {profile.status === 'ready' && <Profile profile={profile.data} />}

        <Links links={CONFIG.links} />

        {CONFIG.recommendations?.schemaUid && <Recommendations />}
      </div>
      <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-neutral-400">
        Served from IPFS. Profile data lives on ENS (
        <a
          href={`https://app.ens.domains/${ENS_NAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-600"
        >
          {ENS_NAME}
        </a>
        ).{' '}
        <span title={document.querySelector<HTMLMetaElement>('meta[name="build"]')?.content ?? undefined}>
          v{__APP_VERSION__}
        </span>
      </p>
      {CONFIG.repo && (
        <p className="mx-auto mt-3 max-w-2xl text-center">
          <a
            href={CONFIG.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-accent shadow-sm transition hover:border-accent"
          >
            <GitFork className="h-4 w-4" />
            Create your own ENS page
          </a>
        </p>
      )}
      <QrBadge />
    </main>
  )
}
