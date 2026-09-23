# ethpage

Static Vite + React SPA: an ENS-driven profile/links page pinned to IPFS,
served at `https://<ensName>.eth.limo/`. Designed to be forked; this checkout
deploys the owner's name via a gitignored `src/config.<name>.json` override.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm preview` / `pnpm type-check`
- `pnpm test:socials` — pure assertions (socials map + favicon helper)
- `pnpm test:ens [name.eth]` — mainnet integration test (network-dependent)
- `pnpm test:eas` — EFP gate + EAS recommendations read path (network)
- `pnpm deploy:pin` — needs `PINATA_JWT`; deploying is the owner's call, never
  run it unprompted

## Architecture

- Baked data comes from `src/config.json` (committed generic template)
  overridden by a `src/config.<name>.json` (gitignored deployment config).
  With several overrides, `CONFIG=<name>` selects one (dev, build, deploy,
  tests); the build errors rather than guessing. Editing configs requires
  rebuild + re-pin. The merge lives in `scripts/load-config.ts`
  (used by `vite.config.ts` and `scripts/*.ts`); `vite.config.ts` bakes the
  selected result into the bundle as `__SITE_CONFIG__`, which `src/config.ts`
  exports as `CONFIG`, so only one deployment's config ever ships.
- `siteUrl` in a config hosts a build on a regular web URL instead of
  eth.limo: `vite.config.ts` derives the absolute asset base from its path
  and `og:url` from it, `SITE_URL` in `src/config.ts` feeds the QR badge and
  the footer. Deploying is copying `dist/` to that path; no pin, no contenthash.
- Everything else (avatar, header, bio, url, socials) resolves live from ENS
  records in the browser: `src/lib/ens.ts`, keyless public RPCs with viem
  `fallback` + multicall batching, `rpcUrls` passed in by callers. No API
  keys anywhere.
- Avatar/header images render via the ENS metadata service
  (`metadata.ens.domains`), never the raw record URL — public IPFS gateways
  (ipfs.io) 403 hotlinked browser requests behind bot protection.
- `src/lib/socials.ts` maps ENSIP-5 keys → URLs; social icons are static
  imports from `@icons-pack/react-simple-icons` in `Profile.tsx`.
- Link button icons: `image` > `emoji` > DuckDuckGo favicon fallback
  (`src/lib/favicon.ts`), hidden on error.
- `vite.config.ts` bakes `<title>`, OG tags, and favicon (metadata-service
  avatar URL) into `index.html` at build; `base: './'` keeps the bundle
  gateway-path-safe. `?name=x.eth` previews any name at runtime.
- Optional Recommendations section (`src/lib/eas.ts`,
  `components/Recommendations.tsx`): EAS attestations read from the easscan
  GraphQL indexer, published only when the receiver follows the attester on
  EFP (`buttonStateBatch`, NOT `followerState` — that one lags fresh
  follows). Writes are viem-only against the EAS contract; never add the
  eas-sdk (drags in ethers). Wallet plumbing is `src/lib/wallets.ts`:
  EIP-6963 discovery + picker, localStorage-remembered choice, silent
  auto-reconnect; WalletConnect is opt-in via `walletConnectProjectId` in
  the config and lazy-loaded only when picked.

## Constraints

- Keep it minimal and forkable: no backend, no analytics, no env vars beyond
  `PINATA_JWT` and the optional `CONFIG=<name>` deployment selector, no new
  config surface without need.
- Personal values (the owner's ENS name, links, colors) live ONLY in a
  gitignored `src/config.<name>.json` override — committed files and docs
  stay generic.
- Spec + decision log: `docs/superpowers/specs/2026-08-29-ens-page-design.md`
  (local working docs, gitignored — absent in fresh clones).
