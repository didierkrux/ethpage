// Integration test for the recommendations plumbing (network-dependent):
// 1. EFP gate: self-consistency check — the first account the configured
//    name follows must register as followed via followerState.
// 2. EAS read path: when config declares `recommendations`, fetches and
//    prints them (decoding + gating run for real).
// Run: pnpm test:eas
import { strict as assert } from 'node:assert'
import type { Address } from 'viem'
import { resolveEnsAddress } from '../src/lib/ens'
import { RECOMMENDATION_SCHEMA, computeSchemaUid, efpFollowStates, fetchRecommendations } from '../src/lib/eas'
import { EFP_API, fetchEfpStats } from '../src/lib/efp'
import { loadConfig } from './load-config'

// Pure regression check: UID derivation must match how the SchemaRegistry
// derives UIDs (verified against a real registered schema on Base).
assert.equal(
  computeSchemaUid('bool isEndorsement,string name,string domain,string context'),
  '0xa76299ae6a66b66ff48344f36c0fa657a0a9eeb6721248311df9cf25748e4405',
  'schema UID computation matches the registry'
)
console.log(`recommendation schema UID: ${computeSchemaUid(RECOMMENDATION_SCHEMA)}`)

const cfg = loadConfig()
const name = cfg.ensName!
const receiver = await resolveEnsAddress(name, cfg.rpcUrls)
assert.ok(receiver, `${name} resolves to an address`)
console.log(`${name} -> ${receiver}`)

const stats = await fetchEfpStats(name)
assert.ok(stats && stats.followers >= 0 && stats.following >= 0, 'EFP stats resolve')
console.log(`EFP stats: ${stats!.followers} followers, ${stats!.following} following`)

// EFP self-consistency: someone the receiver follows must gate as public,
// and a throwaway address must not.
const following = (await (await fetch(`${EFP_API}/users/${receiver}/following?limit=1`)).json()) as {
  following?: { address: Address }[]
}
const followed = following.following?.[0]?.address
if (followed) {
  const states = await efpFollowStates(receiver, [followed, '0x0000000000000000000000000000000000000001'])
  assert.deepEqual(states, [true, false], 'EFP gate: followed=public, stranger=hidden')
  console.log(`EFP gate ok: ${name} follows ${followed}, stranger correctly hidden`)
} else {
  console.log(`EFP gate untested: ${name} follows nobody on EFP`)
}

if (cfg.recommendations?.schemaUid) {
  const recs = await fetchRecommendations(cfg.recommendations, receiver, cfg.rpcUrls)
  console.log(JSON.stringify(recs, null, 2))
  for (const r of recs) {
    assert.ok(r.uid && r.attester && r.recommendation)
    assert.ok(typeof r.isPublic === 'boolean')
  }
  console.log(`fetched ${recs.length} recommendation(s), ${recs.filter(r => r.isPublic).length} public`)
} else {
  console.log('recommendations not configured — EAS read path untested (set recommendations.schemaUid)')
}

console.log('test-eas: all assertions passed')
