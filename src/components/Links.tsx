import type { LinkItem } from '../config'
import { faviconUrl } from '../lib/favicon'

// Icon slot resolution: explicit image > emoji > the site's favicon (hidden
// via onError if the favicon service has nothing, leaving a plain button).
function LinkIcon({ link }: { link: LinkItem }) {
  if (link.image) {
    return <img src={link.image} alt="" className="absolute left-2 h-10 w-10 rounded-lg object-cover" />
  }
  if (link.emoji) {
    return <span className="absolute left-2 flex h-10 w-10 items-center justify-center text-2xl">{link.emoji}</span>
  }
  const favicon = faviconUrl(link.url)
  if (!favicon) return null
  return (
    <img
      src={favicon}
      alt=""
      loading="lazy"
      onError={e => {
        e.currentTarget.style.display = 'none'
      }}
      className="absolute left-3 h-8 w-8 rounded object-contain"
    />
  )
}

export function Links({ links }: { links: LinkItem[] }) {
  if (links.length === 0) return null
  return (
    <div className="mt-4 space-y-3">
      {links.map(link => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex min-h-14 items-center rounded-xl border border-neutral-200/70 bg-white/70 py-2 pl-14 pr-4 text-center font-medium text-accent shadow-sm backdrop-blur-sm transition duration-150 ease-out hover:scale-[1.03] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] motion-reduce:transform-none dark:border-white/10 dark:bg-white/5 sm:px-14"
        >
          <LinkIcon link={link} />
          <span className="w-full">{link.title}</span>
        </a>
      ))}
    </div>
  )
}
