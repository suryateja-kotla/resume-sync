import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/axios'

/**
 * Fetch-once-and-remember for dashboard sections.
 *
 * The HR dashboard swaps sections by unmounting one component and mounting
 * another, so a plain `useEffect(fetch, [])` refetches everything each time
 * you navigate back. Against Firestore's compatibility layer — where a single
 * round trip costs ~330ms and a section needs several — that meant a 2-5s
 * spinner on every visit to a screen you had already loaded.
 *
 * The cache is module-level rather than component state precisely so it
 * survives unmount. Behaviour is stale-while-revalidate:
 *
 *   first visit   → spinner, fetch, store
 *   return visit  → cached data renders instantly, and if it is older than
 *                   `staleMs` a refresh runs in the background and updates
 *                   in place — no spinner, no flicker
 *
 * That keeps navigation instant without ever showing data that silently
 * stopped being refreshed.
 */

interface Entry<T> {
  data: T
  fetchedAt: number
}

const cache = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/** Drop cached entries. Call after a mutation so the next read is fresh.
 *  With no argument, clears everything (e.g. on sign-out). */
export function invalidate(keyPrefix?: string) {
  if (!keyPrefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key)
  }
}

interface Options {
  /** How old cached data may be before a background refresh runs. */
  staleMs?: number
  /** Skip fetching entirely (e.g. a tab the user cannot see). */
  enabled?: boolean
}

export function useCachedResource<T>(
  key: string,
  url: string,
  { staleMs = 60_000, enabled = true }: Options = {}
) {
  const cached = cache.get(key) as Entry<T> | undefined

  const [data, setData] = useState<T | undefined>(cached?.data)
  // Only the very first load blocks on a spinner. A background refresh must
  // not flip this, or returning to a stale section flickers.
  const [loading, setLoading] = useState(!cached && enabled)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const load = useCallback(async (background: boolean) => {
    if (!background) setLoading(true)
    setError(false)
    try {
      // Deduplicate concurrent callers — two components mounting at once
      // should not each fire the same request.
      let promise = inflight.get(key)
      if (!promise) {
        promise = api.get(url).then(res => res.data)
        inflight.set(key, promise)
      }
      const payload = (await promise) as T
      cache.set(key, { data: payload, fetchedAt: Date.now() })
      if (mounted.current) setData(payload)
    } catch {
      if (mounted.current && !background) setError(true)
    } finally {
      inflight.delete(key)
      if (mounted.current && !background) setLoading(false)
    }
  }, [key, url])

  useEffect(() => {
    if (!enabled) return
    const entry = cache.get(key) as Entry<T> | undefined
    if (!entry) {
      load(false)
    } else {
      setData(entry.data)
      if (Date.now() - entry.fetchedAt > staleMs) load(true)
    }
  }, [key, enabled, staleMs, load])

  /** Force a fresh fetch, showing the spinner. For explicit "Refresh" buttons. */
  const refresh = useCallback(() => {
    cache.delete(key)
    return load(false)
  }, [key, load])

  return { data, loading, error, refresh }
}
