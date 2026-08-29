// Integration test: resolves a real profile over the keyless public RPCs.
// Network-dependent by design (this is the code path the live site runs).
// Run: pnpm test:ens          (uses the configured ensName)
//      pnpm test:ens some.eth (any other name)
import { strict as assert } from 'node:assert'
import { fetchEnsProfile } from '../src/lib/ens'
import { loadConfig } from './load-config'

const cfg = loadConfig()

const name = process.argv[2] ?? cfg.ensName!
const profile = await fetchEnsProfile(name, cfg.rpcUrls)
console.log(JSON.stringify(profile, null, 2))

assert.equal(profile.name, name)
assert.ok(profile.displayName.length > 0, 'displayName falls back to the ENS name')
assert.ok(Array.isArray(profile.socials))
for (const s of profile.socials) assert.ok(s.key && s.value)
// Regression guard: raw record values often point at bot-protected public
// gateways that 403 hotlinked browser requests; images must go through the
// ENS metadata service.
for (const img of [profile.avatar, profile.header]) {
  if (img) assert.ok(img.startsWith('https://metadata.ens.domains/'), `image served via metadata service: ${img}`)
}

console.log('test-ens: all assertions passed')
