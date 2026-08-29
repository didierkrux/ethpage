// Integration test: resolves a real profile over the keyless public RPCs.
// Network-dependent by design (this is the code path the live site runs).
// Run: pnpm test:ens          (uses the configured ensName)
//      pnpm test:ens some.eth (any other name)
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchEnsProfile } from '../src/lib/ens'

// src/config.ts is Vite-only (import.meta.glob), so merge the config files
// with fs here, same semantics: template overridden by the optional
// gitignored personal config.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const readJson = (f: string) =>
  JSON.parse(readFileSync(join(SRC, f), 'utf8')) as { ensName?: string; rpcUrls?: string[] }
const cfg = {
  ...readJson('config.json'),
  ...(existsSync(join(SRC, 'config.custom.json')) ? readJson('config.custom.json') : {}),
}

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
