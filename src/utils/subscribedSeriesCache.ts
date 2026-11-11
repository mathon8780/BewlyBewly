import browser from 'webextension-polyfill'

import type { FeedPage, FeedSnapshot } from '~/composables/useWindowedFeed'
import type { SubscribedSeriesItem } from '~/utils/subscribedSeries'

const CACHE_KEY = 'subscribedSeriesSnapshot'
const FRESH_FOR = 5 * 60 * 1000
const RETAIN_FOR = 30 * 24 * 60 * 60 * 1000
const MAX_BYTES = 2 * 1024 * 1024

interface Snapshot {
  version: 1
  userId: string
  updatedAt: number
  items: SubscribedSeriesItem[]
}

function isItem(item: unknown): item is SubscribedSeriesItem {
  if (!item || typeof item !== 'object')
    return false
  const value = item as SubscribedSeriesItem
  return typeof value.uniqueId === 'string'
    && typeof value.airDate === 'string'
    && Number.isFinite(value.totalEpisodes)
    && Number.isFinite(value.releasedEpisodes)
    && !!value.video
    && Number.isFinite(value.video.id)
    && typeof value.video.title === 'string'
    && typeof value.video.cover === 'string'
    && typeof value.video.url === 'string'
}

/** Keep only the most recently used account's complete snapshot, with a fixed byte budget. */
export function createSubscribedSeriesCache(userId: () => string | undefined, now = Date.now) {
  async function readRecord(): Promise<Snapshot | undefined> {
    const raw = (await browser.storage.local.get(CACHE_KEY))[CACHE_KEY]
    if (typeof raw !== 'string' || raw.length > MAX_BYTES)
      return
    try {
      const value = JSON.parse(raw) as Snapshot
      if (value?.version !== 1 || typeof value.userId !== 'string'
        || !Number.isFinite(value.updatedAt) || !Array.isArray(value.items)
        || !value.items.every(isItem)) {
        return
      }
      return value
    }
    catch {
      return undefined
    }
  }

  return {
    async read(): Promise<FeedSnapshot<SubscribedSeriesItem> | undefined> {
      const account = userId()
      if (!account)
        return
      const record = await readRecord()
      if (!record || record.userId !== account)
        return
      const age = now() - record.updatedAt
      if (age < 0 || age > RETAIN_FOR)
        return
      return { page: { items: record.items, done: true }, stale: age >= FRESH_FOR }
    },
    async write(page: FeedPage<SubscribedSeriesItem>) {
      const account = userId()
      if (!account || !page.done || page.unauthorized)
        return
      const record: Snapshot = { version: 1, userId: account, updatedAt: now(), items: page.items }
      const raw = JSON.stringify(record)
      if (new TextEncoder().encode(raw).byteLength <= MAX_BYTES)
        await browser.storage.local.set({ [CACHE_KEY]: raw })
    },
    async remove() {
      const account = userId()
      const record = await readRecord()
      if (account && record?.userId === account)
        await browser.storage.local.remove(CACHE_KEY)
    },
  }
}
