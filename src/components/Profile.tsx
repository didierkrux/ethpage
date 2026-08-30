import { useEffect, useState, type ComponentType } from 'react'
// Linkedin comes from lucide: simple-icons removed the LinkedIn mark for
// trademark reasons.
import { Mail, Globe, Linkedin } from 'lucide-react'
// Per-icon deep imports instead of the package root: the root pulls all
// ~3300 icons into Vite's dev pre-bundle (10MB+, chokes tunneled dev
// servers); these keep dev and prod equally lean.
import SiX from '@icons-pack/react-simple-icons/icons/SiX'
import SiInstagram from '@icons-pack/react-simple-icons/icons/SiInstagram'
import SiGithub from '@icons-pack/react-simple-icons/icons/SiGithub'
import SiYoutube from '@icons-pack/react-simple-icons/icons/SiYoutube'
import SiTelegram from '@icons-pack/react-simple-icons/icons/SiTelegram'
import SiFarcaster from '@icons-pack/react-simple-icons/icons/SiFarcaster'
import SiBluesky from '@icons-pack/react-simple-icons/icons/SiBluesky'
import SiLens from '@icons-pack/react-simple-icons/icons/SiLens'
import SiReddit from '@icons-pack/react-simple-icons/icons/SiReddit'
import SiDiscord from '@icons-pack/react-simple-icons/icons/SiDiscord'
import SiFacebook from '@icons-pack/react-simple-icons/icons/SiFacebook'
import type { EnsProfile } from '../lib/ens'
import { fetchEfpStats, type EfpStats as EfpStatsData } from '../lib/efp'
import { socialUrl, socialLabel } from '../lib/socials'
import { CONFIG } from '../config'

// EFP (Ethereum Follow Protocol) logo, inlined: not in any icon library.
// fill=currentColor so it follows the accent like the other icons.
function EfpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 35" fill="none" className={className}>
      <path fill="currentColor" d="M0 15.586 9.365 0l9.297 15.586-9.297 5.674z" />
      <path fill="currentColor" d="M9.365 22.969 0 17.295l9.365 13.193 9.297-13.193zM21.328 24.473h-2.666v3.965h-3.691v2.46h3.691V35h2.666v-4.102h3.623v-2.46h-3.623z" />
    </svg>
  )
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'com.twitter': SiX,
  'com.instagram': SiInstagram,
  'com.github': SiGithub,
  'com.youtube': SiYoutube,
  'org.telegram': SiTelegram,
  'xyz.farcaster': SiFarcaster,
  'app.bsky': SiBluesky,
  'xyz.lens': SiLens,
  'com.reddit': SiReddit,
  'com.discord': SiDiscord,
  'com.linkedin': Linkedin,
  'com.facebook': SiFacebook,
  email: Mail,
}

// Follower/following counts from EFP, linked to the profile there. Hidden
// for names with no EFP presence (0/0 or the stats call failing), and
// disabled together with the EFP icon via "efp": false in the config.
function EfpStats({ name }: { name: string }) {
  const [stats, setStats] = useState<EfpStatsData | null>(null)
  useEffect(() => {
    let stale = false
    setStats(null)
    fetchEfpStats(name).then(s => !stale && setStats(s))
    return () => {
      stale = true
    }
  }, [name])

  if (!stats || (stats.followers === 0 && stats.following === 0)) return null
  return (
    <a
      href={`https://efp.app/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 text-sm text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
    >
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{stats.following.toLocaleString()}</span>{' '}
      Following
      <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{stats.followers.toLocaleString()}</span>{' '}
      Followers
    </a>
  )
}

// "https://example.com/en/" -> "example.com": the pill shows a readable name,
// the full URL stays in the href.
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// The full-bleed pieces cancel the card's responsive padding (p-5 sm:p-8),
// so every negative margin/width here carries the matching sm: variant.
export const FULL_BLEED = '-mx-5 -mt-5 w-[calc(100%+2.5rem)] max-w-none sm:-mx-8 sm:-mt-8 sm:w-[calc(100%+4rem)]'

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className={`${FULL_BLEED} h-40 rounded-t-2xl bg-neutral-200 dark:bg-neutral-800`} />
      <div className="-mt-8 mx-auto h-16 w-16 rounded-full bg-neutral-300 ring-4 ring-white dark:bg-neutral-700 dark:ring-neutral-900 sm:-mt-10 sm:h-20 sm:w-20" />
      <div className="mx-auto mt-4 h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mx-auto mt-2 h-4 w-64 rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  )
}

// The display name with a dimmed ens name beneath it — or, when no
// display-name record exists, the ENS name itself with a dimmed ".eth"
// suffix.
function DisplayName({ profile }: { profile: EnsProfile }) {
  if (profile.displayName === profile.name) {
    return (
      <h1 className="mt-4 font-display text-2xl font-bold">
        {profile.name.replace(/\.eth$/i, '')}
        <span className="font-semibold text-neutral-400 dark:text-neutral-500">.eth</span>
      </h1>
    )
  }
  return (
    <>
      <h1 className="mt-4 font-display text-2xl font-bold">{profile.displayName}</h1>
      <p className="mt-0.5 text-sm text-neutral-400 dark:text-neutral-500">{profile.name}</p>
    </>
  )
}

export function Profile({ profile }: { profile: EnsProfile }) {
  // If the metadata service ever fails, fall back to the neutral placeholder
  // banner instead of a broken-image icon.
  const [headerFailed, setHeaderFailed] = useState(false)
  return (
    <div>
      {/* Full-bleed header: negative margins cancel the card's padding so the
          artwork runs edge-to-edge with matching rounded top corners. */}
      {profile.header && !headerFailed ? (
        <img
          src={profile.header}
          onError={() => setHeaderFailed(true)}
          alt=""
          className={`${FULL_BLEED} rounded-t-2xl object-cover aspect-[3/1]`}
        />
      ) : (
        <div className={`${FULL_BLEED} h-24 rounded-t-2xl bg-neutral-200 dark:bg-neutral-800`} />
      )}

      <div className="flex flex-col items-center text-center">
        {profile.avatar && (
          <img
            src={profile.avatar}
            onError={e => {
              e.currentTarget.style.display = 'none'
            }}
            alt={profile.displayName}
            className="-mt-8 h-16 w-16 rounded-full bg-white object-cover ring-4 ring-white dark:bg-neutral-900 dark:ring-neutral-900 sm:-mt-10 sm:h-20 sm:w-20"
          />
        )}
        <DisplayName profile={profile} />
        {profile.description && <p className="mt-1 text-neutral-600 dark:text-neutral-300">{profile.description}</p>}

        {profile.url && (
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-200/70 bg-white/60 px-4 py-2 text-sm font-medium text-accent transition duration-150 ease-out hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-white/5"
          >
            <Globe className="h-4 w-4" />
            {hostname(profile.url)}
          </a>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          {profile.socials.map(({ key, value }) => {
            const Icon = ICONS[key]
            const href = socialUrl(key, value)
            const label = socialLabel(key)
            if (!Icon || !href || !label) return null
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="rounded-full p-2 text-accent transition duration-150 ease-out hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10 sm:p-2.5"
              >
                <Icon className="h-5 w-5" />
              </a>
            )
          })}
          {/* EFP profile exists for every ENS name (no record needed), so the
              icon is on by default; "efp": false in the config hides it. */}
          {CONFIG.efp !== false && (
            <a
              href={`https://efp.app/${profile.name}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="EFP"
              className="rounded-full p-2 text-accent transition duration-150 ease-out hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10 sm:p-2.5"
            >
              <EfpIcon className="h-5 w-5" />
            </a>
          )}
        </div>

        {CONFIG.efp !== false && <EfpStats name={profile.name} />}
      </div>
    </div>
  )
}
