// Automatic icon for link buttons that set neither emoji nor image: the
// target site's favicon via DuckDuckGo's icon service (privacy-friendly).
// Links.tsx hides the <img> onError, so a missing favicon degrades to a
// plain text button.
export function faviconUrl(url: string): string | null {
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`
  } catch {
    return null
  }
}
