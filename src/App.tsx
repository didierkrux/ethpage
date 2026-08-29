import { useCallback, useEffect, useState } from 'react'
import { CONFIG, ENS_NAME } from './config'
import { fetchEnsProfile, type EnsProfile } from './lib/ens'
import { Profile, ProfileSkeleton } from './components/Profile'
import { Links } from './components/Links'
import { QrBadge } from './components/QrBadge'

type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

// GitHub repos get the one-click fork page; anything else links to the repo.
function forkHref(repo: string): string {
  try {
    if (new URL(repo).hostname === 'github.com') return `${repo.replace(/\/$/, '')}/fork`
  } catch {
    /* fall through */
  }
  return repo
}

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
      </div>
      <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-neutral-400">
        Served from IPFS. Profile data lives on ENS ({ENS_NAME}).
        {CONFIG.repo && (
          <>
            {' · '}
            <a
              href={forkHref(CONFIG.repo)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-600"
            >
              Fork this page
            </a>
          </>
        )}
      </p>
      <QrBadge />
    </main>
  )
}
