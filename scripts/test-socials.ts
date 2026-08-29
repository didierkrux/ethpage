// Pure assertions: ENS record -> profile URL mapping + favicon fallback URL.
// Run: pnpm test:socials
import { strict as assert } from 'node:assert'
import { SOCIAL_KEYS, socialUrl, socialLabel } from '../src/lib/socials'
import { faviconUrl } from '../src/lib/favicon'

assert.equal(socialUrl('com.twitter', 'example'), 'https://x.com/example')
assert.equal(socialUrl('com.twitter', '@example'), 'https://x.com/example', 'strips @ prefix')
assert.equal(socialUrl('com.instagram', 'example'), 'https://instagram.com/example')
assert.equal(socialUrl('com.github', 'example'), 'https://github.com/example')
assert.equal(socialUrl('org.telegram', 'example'), 'https://t.me/example')
assert.equal(socialUrl('xyz.farcaster', 'example'), 'https://farcaster.xyz/example', 'farcaster.xyz, not warpcast')
assert.equal(socialUrl('email', 'hi@example.com'), 'mailto:hi@example.com')
assert.equal(socialUrl('com.youtube', 'example'), 'https://youtube.com/@example')
assert.equal(
  socialUrl('com.youtube', 'https://www.youtube.com/c/Example/search?query=x'),
  'https://www.youtube.com/c/Example/search?query=x',
  'full URLs pass through untouched'
)
assert.equal(socialUrl('com.discord', '123456789012345678'), 'https://discord.com/users/123456789012345678')
assert.equal(socialUrl('com.linkedin', 'example'), 'https://www.linkedin.com/in/example')
assert.equal(socialLabel('com.discord'), 'Discord')
assert.equal(socialLabel('com.linkedin'), 'LinkedIn')
assert.equal(socialUrl('com.facebook', 'didier.krux'), 'https://www.facebook.com/didier.krux')
assert.equal(socialLabel('com.facebook'), 'Facebook')
assert.equal(socialUrl('app.bsky', 'example.bsky.social'), 'https://bsky.app/profile/example.bsky.social')
assert.equal(socialUrl('xyz.lens', 'example'), 'https://hey.xyz/u/example')
assert.equal(socialUrl('com.reddit', 'example'), 'https://reddit.com/user/example')
assert.equal(socialLabel('app.bsky'), 'Bluesky')
assert.equal(socialLabel('xyz.lens'), 'Lens')
assert.equal(socialLabel('com.reddit'), 'Reddit')
assert.equal(socialUrl('com.twitter', '  '), null, 'blank values yield null')
assert.equal(socialUrl('com.mystery', 'x'), null, 'unknown keys yield null')
assert.equal(socialLabel('com.twitter'), 'X')
assert.equal(socialLabel('com.mystery'), null)
assert.ok(SOCIAL_KEYS.includes('com.twitter') && SOCIAL_KEYS.includes('email'))

assert.equal(faviconUrl('https://app.poap.xyz/scan/x.eth'), 'https://icons.duckduckgo.com/ip3/app.poap.xyz.ico')
assert.equal(faviconUrl('https://www.example.com'), 'https://icons.duckduckgo.com/ip3/www.example.com.ico')
assert.equal(faviconUrl('not a url'), null, 'invalid URLs yield null')

console.log('test-socials: all assertions passed')
