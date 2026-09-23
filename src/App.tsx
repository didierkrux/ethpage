import { useCallback, useEffect, useState } from 'react'
import { GitFork, Search } from 'lucide-react'
import { CONFIG, ENS_NAME, IS_PREVIEW, NAME_FROM_QUERY } from './config'
import { ViewerLanding } from './components/ViewerLanding'
import { fetchEnsProfile, type EnsProfile } from './lib/ens'
import { Profile, ProfileSkeleton } from './components/Profile'
import { Links } from './components/Links'
import { Recommendations } from './components/Recommendations'
import { QrBadge } from './components/QrBadge'
import type { Loadable } from './types'

// The page's signature: the profile's own header art, blurred into a
// full-viewport ambience behind the glass card — every name gets an
// atmosphere derived from its on-chain identity. Falls back to a soft
// accent-tinted wash when the name has no header record.
function Backdrop({ header }: { header: string | null }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
      {header ? (
        <img
          src={header}
          alt=""
          onLoad={() => setLoaded(true)}
          className={`h-full w-full scale-125 object-cover blur-3xl saturate-[1.2] transition-opacity duration-700 motion-reduce:transition-none ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent)' }}
        />
      )}
      <div className="absolute inset-0 bg-neutral-100/75 dark:bg-neutral-950/70" />
    </div>
  )
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

  // Viewer deployments land on a name input when no ?name= is given. The
  // profile still loads: the landing wears the viewer name's own records
  // (header art as backdrop, avatar above the wordmark).
  const isLanding = CONFIG.viewer === true && !NAME_FROM_QUERY

  useEffect(() => {
    document.title = ENS_NAME // until the name record loads
    loadProfile()
  }, [loadProfile])

  return (
    <main className="min-h-screen px-4 py-4 font-sans sm:py-6">
      <Backdrop header={profile.status === 'ready' ? profile.data.header : null} />
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white/80 p-5 shadow-xl shadow-neutral-900/5 ring-1 ring-white/60 backdrop-blur-xl dark:bg-neutral-900/75 dark:shadow-black/20 dark:ring-white/10 sm:p-8">
        {isLanding && (
          <ViewerLanding
            avatar={profile.status === 'ready' ? profile.data.avatar : null}
            header={profile.status === 'ready' ? profile.data.header : null}
          />
        )}
        {!isLanding && profile.status === 'loading' && <ProfileSkeleton />}
        {!isLanding && profile.status === 'error' && (
          <div className="py-12 text-center">
            <p className="text-neutral-600 dark:text-neutral-300">Could not load the {ENS_NAME} profile.</p>
            <button
              onClick={loadProfile}
              className="mt-4 rounded-full bg-neutral-900 px-6 py-2 font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Retry
            </button>
          </div>
        )}
        {!isLanding && profile.status === 'ready' && <Profile profile={profile.data} />}

        {/* The links are the page owner's, not the previewed name's. */}
        {!IS_PREVIEW && <Links links={CONFIG.links} />}

        {!isLanding && CONFIG.recommendations?.schemaUid && <Recommendations />}
      </div>
      <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-neutral-400 dark:text-neutral-400">
        {CONFIG.siteUrl ? `Hosted at ${new URL(CONFIG.siteUrl).host}` : 'Served from IPFS'} <span className="mx-1 text-neutral-300 dark:text-neutral-600">·</span> profile data lives on{' '}
        <a
          href={`https://app.ens.domains/${ENS_NAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          {ENS_NAME}
        </a>{' '}
        <span className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
        <span title={document.querySelector<HTMLMetaElement>('meta[name="build"]')?.content ?? undefined}>
          v{__APP_VERSION__}
        </span>
      </p>
      {(CONFIG.repo || CONFIG.viewerUrl) && (
        <p className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-center">
          {/* Instant path: view/share your page on the public viewer. Hidden
              only on the viewer landing itself, where the input IS this CTA;
              on previews it leads back to the name input. */}
          {CONFIG.viewerUrl && !isLanding && (
            <a
              href={CONFIG.viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/70 bg-white/70 px-4 py-2 text-sm font-medium text-accent shadow-sm backdrop-blur transition hover:border-accent dark:border-white/10 dark:bg-white/5"
            >
              <Search className="h-4 w-4" />
              View your ENS page
            </a>
          )}
          {CONFIG.repo && (
            <a
              href={CONFIG.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/70 bg-white/70 px-4 py-2 text-sm font-medium text-accent shadow-sm backdrop-blur transition hover:border-accent dark:border-white/10 dark:bg-white/5"
            >
              <GitFork className="h-4 w-4" />
              Create your own ENS page
            </a>
          )}
        </p>
      )}
      <QrBadge />
    </main>
  )
}
