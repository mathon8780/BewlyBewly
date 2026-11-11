import { beforeEach, expect, it, vi } from 'vitest'

import type { SubscribedSeriesItem } from '~/utils/subscribedSeries'
import { createSubscribedSeriesCache } from '~/utils/subscribedSeriesCache'

const storage = vi.hoisted(() => ({ value: undefined as unknown }))
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: storage.value }),
        set: async (items: Record<string, unknown>) => { storage.value = Object.values(items)[0] },
        remove: async () => { storage.value = undefined },
      },
    },
  },
}))

const item: SubscribedSeriesItem = {
  uniqueId: '1',
  airDate: '2026-01-01',
  totalEpisodes: 12,
  releasedEpisodes: 12,
  posterCover: 'cover',
  video: { id: 1, title: 'Series', cover: 'cover', url: 'https://www.bilibili.com/bangumi/play/ss1', view: 1, danmaku: 1, desc: '', threePointV2: [] },
}
beforeEach(() => {
  storage.value = undefined
})

it('survives a new cache instance but never displays another account snapshot', async () => {
  await createSubscribedSeriesCache(() => 'first', () => 1000).write({ items: [item], done: true })
  expect((await createSubscribedSeriesCache(() => 'first', () => 2000).read())?.page.items).toEqual([item])
  expect(await createSubscribedSeriesCache(() => 'second', () => 2000).read()).toBeUndefined()
  expect(await createSubscribedSeriesCache(() => undefined, () => 2000).read()).toBeUndefined()
})

it('marks five-minute snapshots stale and ignores expired or malformed records', async () => {
  await createSubscribedSeriesCache(() => 'first', () => 1000).write({ items: [], done: true })
  expect((await createSubscribedSeriesCache(() => 'first', () => 2000).read())?.stale).toBe(false)
  expect((await createSubscribedSeriesCache(() => 'first', () => 301000).read())?.stale).toBe(true)
  expect(await createSubscribedSeriesCache(() => 'first', () => 31 * 86400000).read()).toBeUndefined()
  storage.value = '{broken'
  expect(await createSubscribedSeriesCache(() => 'first').read()).toBeUndefined()
  storage.value = JSON.stringify({ version: 1, userId: 'first', updatedAt: 1000, items: [null] })
  expect(await createSubscribedSeriesCache(() => 'first', () => 2000).read()).toBeUndefined()
})

it('never persists partial or unauthorized lists and enforces its byte budget', async () => {
  const cache = createSubscribedSeriesCache(() => 'first')
  await cache.write({ items: [item], done: false })
  expect(storage.value).toBeUndefined()
  await cache.write({ items: [], done: true, unauthorized: true })
  expect(storage.value).toBeUndefined()
  await cache.write({ items: [{ ...item, video: { ...item.video, title: 'x'.repeat(2 * 1024 * 1024) } }], done: true })
  expect(storage.value).toBeUndefined()
})
