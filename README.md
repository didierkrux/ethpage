# ens-page

A minimal link-in-bio profile page for your ENS name, served from IPFS at
`https://yourname.eth.limo/`. Avatar, header image, display name, bio, website
and social icons resolve **live from your ENS records** — edit them at
[app.ens.domains](https://app.ens.domains) and the page updates with no
redeploy. Only the link buttons (and share-preview tags) are baked in at build
time. No backend, no analytics, no API keys.

## Fork it

1. Fork this repo (or click "Fork this page" on a deployed one).
2. Edit `src/config.json`:

   ```json
   {
     "ensName": "yourname.eth",
     "links": [
       { "title": "My Website", "url": "https://example.com", "emoji": "🌐" },
       { "title": "POAP Badges", "url": "https://poap.in/address/yourname.eth" }
     ]
   }
   ```

   | Field | Required | Purpose |
   | --- | --- | --- |
   | `ensName` | yes | The ENS name whose records drive the page |
   | `links[]` | yes | Link buttons: `title` + `url`, optional `emoji` or `image` |
   | `accent` | no | Accent color (link text/hover), default `#171717` |
   | `repo` | no | Shows a "Fork this page" footer link; omit to hide it |
   | `efp` | no | [EFP](https://efp.app) icon in the social row, on by default; `false` hides it |
   | `og` | no | `title`/`description` for share previews, defaults derive from `ensName` |
   | `rpcUrls` | no | Your own Ethereum RPC endpoints; defaults are keyless public ones |

   Link button icons resolve as `image` > `emoji` > the site's favicon
   (automatic, via DuckDuckGo's icon service). `image` accepts any URL —
   e.g. `https://cdn.simpleicons.org/x` for monochrome brand icons. Favicons
   and such URLs are fetched by the visitor's browser at load time.

   Alternatively, put your config in `src/config.custom.json` (same schema,
   gitignored, overrides `config.json` key by key) to keep your repo a clean
   template for the next person.

3. Set your ENS records (all optional, shown when present): `avatar`,
   `header`, `description`, `url`, `name` (display name), and socials
   `com.twitter`, `com.instagram`, `com.github`, `com.youtube`,
   `org.telegram`, `xyz.farcaster`, `app.bsky`, `xyz.lens`, `com.reddit`,
   `com.discord`, `com.linkedin`, `com.facebook`, `email`.
   Avatar and header render through
   the [ENS metadata service](https://metadata.ens.domains), so NFT and
   `ipfs://` record values work too.
4. Preview locally: `pnpm install && pnpm dev` — you can check any name with
   `http://localhost:5173/?name=any.eth`.
5. Deploy: `pnpm deploy:pin` with a `PINATA_JWT` — copy `.env.example` to
   `.env` (gitignored) and fill it in, or pass it inline. Free key from
   [app.pinata.cloud/developers/api-keys](https://app.pinata.cloud/developers/api-keys),
   scopes: `pinFileToIPFS`, plus `pinList` + `unpin` for automatic pruning of
   old pins. Then set the printed `ipfs://<CID>` as the Content Hash record
   at app.ens.domains and open `https://yourname.eth.limo/`.

Re-run step 5 whenever you change the config. ENS record edits never need it.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm build` | Type-check + production build to `dist/` |
| `pnpm test:socials` | Pure checks of the socials/favicon mapping |
| `pnpm test:ens` | Resolves the configured name over public RPCs (network) |
| `pnpm deploy:pin` | Build + pin `dist/` to Pinata + print the CID |
