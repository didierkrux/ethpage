import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { CONFIG } from '../config'

// Landing for viewer deployments (config.viewer = true, no ?name= given):
// instead of the configured profile, an input that opens any name's page via
// the same ?name= mechanism.
export function ViewerLanding() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    let name = value.trim().toLowerCase()
    if (!name) return
    if (!name.includes('.')) name = `${name}.eth`
    if (!/^[a-z0-9-.]+\.eth$/.test(name)) {
      setError('That does not look like a .eth name.')
      return
    }
    window.location.search = `?name=${name}`
  }

  return (
    <div className="py-10 text-center sm:py-14">
      <h1 className="font-display text-3xl font-bold">{CONFIG.og?.title || CONFIG.ensName}</h1>
      <p className="mx-auto mt-2 max-w-sm text-neutral-600 dark:text-neutral-300">
        Any ENS name as a page: profile, links, and onchain recommendations, straight from the records.
      </p>
      <form onSubmit={submit} className="mx-auto mt-6 flex max-w-sm items-center gap-2">
        <input
          value={value}
          onChange={e => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder="yourname.eth"
          aria-label="ENS name"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-center focus:outline-none focus:ring-2 focus:ring-accent dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
        <button
          type="submit"
          aria-label="View page"
          className="shrink-0 rounded-full bg-neutral-900 p-3.5 text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Search className="h-5 w-5" />
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
