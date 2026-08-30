// EFP (Ethereum Follow Protocol, https://efp.app) — the public API, no key.
export const EFP_API = 'https://api.ethfollow.xyz/api/v1'

export interface EfpStats {
  followers: number
  following: number
}

// Follower/following counts for the profile header. null on any failure —
// the stats line simply doesn't render (same for 0/0 profiles).
export async function fetchEfpStats(addressOrName: string): Promise<EfpStats | null> {
  try {
    const res = await fetch(`${EFP_API}/users/${addressOrName}/stats`)
    if (!res.ok) return null
    const d = (await res.json()) as { followers_count?: number | string; following_count?: number | string }
    return { followers: Number(d.followers_count ?? 0), following: Number(d.following_count ?? 0) }
  } catch {
    return null
  }
}
