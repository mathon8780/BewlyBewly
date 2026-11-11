import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SeriesSettings from '~/components/Settings/BewlyPages/SubscribedSeries/SubscribedSeries.vue'
import type { FeedPage, FeedSnapshot } from '~/composables/useWindowedFeed'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import { settings } from '~/logic'
import { originalSettings, parseSettings } from '~/logic/settings'

vi.mock('~/logic', async () => {
  const { ref } = await import('vue')
  const { originalSettings } = await import('~/logic/settings')
  return { settings: ref(structuredClone(originalSettings)) }
})
vi.mock('~/utils/dataFormatter', () => ({ numFormatter: String }))
vi.mock('~/components/ALink.vue', () => ({ default: { template: '<a><slot /></a>' } }))

const actions = { handleReachBottom: ref(), handlePageRefresh: ref(), handleBackToTop: vi.fn(), haveScrollbar: async () => true }
vi.mock('~/composables/useAppProvider', () => ({ useBewlyApp: () => actions }))
let app: App | undefined
beforeEach(() => {
  settings.value = structuredClone(originalSettings)
})
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.replaceChildren()
})

async function settle() {
  for (let i = 0; i < 8; i++) await nextTick()
}

it('edits independent style settings using one expanded preview and resets only the current style', async () => {
  app = createApp(SeriesSettings).use(createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false }))
  app.mount(document.body.appendChild(document.createElement('div')))
  expect(document.querySelectorAll('.series-card')).toHaveLength(1)
  expect(document.querySelector('.layout-overlay.is-preview')).not.toBeNull()
  expect(document.querySelector('.details-toggle')).toBeNull()
  const checkbox = document.querySelector<HTMLInputElement>('.controls input')!
  checkbox.click()
  await settle()
  expect(settings.value.seriesStyles.overlay.showPlays).toBe(false)
  expect(document.querySelectorAll('.series-details dt')).toHaveLength(3)
  document.querySelector<HTMLInputElement>('input[value="poster"]')!.click()
  await settle()
  expect(document.querySelector('.layout-poster')).not.toBeNull()
  expect(document.querySelectorAll('.series-details dt')).toHaveLength(4)
  document.querySelector<HTMLButtonElement>('.editor-heading button')!.click()
  expect(settings.value.seriesStyles.overlay.showPlays).toBe(false)
  document.querySelector<HTMLInputElement>('input[value="overlay"]')!.click()
  await settle()
  expect(document.querySelector<HTMLInputElement>('.controls input')!.checked).toBe(false)
  document.querySelectorAll<HTMLInputElement>('.controls input').forEach((input) => {
    if (input.checked)
      input.click()
  })
  await settle()
  expect(document.querySelector('.series-details')).toBeNull()
})

it('validates style imports and preserves independent defaults', () => {
  const defaults = parseSettings({})
  defaults.seriesStyles.poster.showPlays = false
  expect(defaults.seriesStyles.overlay.showPlays).toBe(true)
  expect(() => parseSettings({ seriesStyle: 'unknown' })).toThrow('seriesStyle')
  expect(() => parseSettings({ seriesStyles: null })).toThrow('seriesStyles')
  const invalid = structuredClone(defaults.seriesStyles)
  Object.assign(invalid.below, { coverFit: 'stretch' })
  expect(() => parseSettings({ seriesStyles: invalid })).toThrow('coverFit')
  expect(parseSettings(JSON.parse(JSON.stringify(defaults))).seriesStyles.poster.showPlays).toBe(false)
})

it('retains cached feed results, refreshes explicitly and invalidates them for a different account', async () => {
  const visible = ref(true)
  let user = 'first'
  const load = vi.fn(async () => ({ items: [{ id: user }], done: true }))
  const feed = defineComponent({
    name: 'CachedFeed',
    setup() {
      const { items } = useWindowedFeed({
        key: item => item.id,
        loadPage: load,
        resetCursor: vi.fn(),
        cacheIdentity: () => user,
        beforeLoading: vi.fn(),
        afterLoading: vi.fn(),
      })
      return () => h('p', items.value.map(item => item.id).join(','))
    },
  })
  app = createApp({ render: () => h(KeepAlive, { include: 'CachedFeed' }, { default: () => visible.value ? h(feed) : h('div') }) })
  app.mount(document.body.appendChild(document.createElement('div')))
  await settle()
  expect(load).toHaveBeenCalledTimes(1)
  visible.value = false
  await settle()
  visible.value = true
  await settle()
  expect(load).toHaveBeenCalledTimes(1)
  expect(document.querySelector('p')!.textContent).toBe('first')
  await actions.handlePageRefresh.value()
  expect(load).toHaveBeenCalledTimes(2)
  visible.value = false
  await settle()
  user = 'second'
  visible.value = true
  await settle()
  expect(load).toHaveBeenCalledTimes(3)
  expect(document.querySelector('p')!.textContent).toBe('second')
})

function mountSnapshotFeed(
  stale: boolean | undefined,
  load: (current: () => boolean, publish?: (page: FeedPage<{ id: string }>) => void) => Promise<FeedPage<{ id: string }>>,
) {
  const page = { items: [{ id: 'saved' }], done: true }
  const snapshot = {
    read: vi.fn(async (): Promise<FeedSnapshot<{ id: string }> | undefined> => stale === undefined ? undefined : { page, stale }),
    write: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  let feed!: ReturnType<typeof useWindowedFeed<{ id: string }>>
  app = createApp({
    setup() {
      feed = useWindowedFeed({
        key: item => item.id,
        loadPage: load,
        resetCursor: vi.fn(),
        beforeLoading: vi.fn(),
        afterLoading: vi.fn(),
        snapshot,
      })
      return () => h('p', feed.items.value.map(item => item.id).join(','))
    },
  })
  app.mount(document.body.appendChild(document.createElement('div')))
  return { feed, snapshot }
}

it('restores fresh snapshots without a request and bypasses them on manual refresh', async () => {
  const load = vi.fn(async () => ({ items: [{ id: 'new' }], done: true }))
  const { feed, snapshot } = mountSnapshotFeed(false, load)
  await settle()
  expect(feed.items.value).toEqual([{ id: 'saved' }])
  expect(load).not.toHaveBeenCalled()
  expect(feed.isLoading.value).toBe(false)
  await feed.reset()
  expect(load).toHaveBeenCalledTimes(1)
  expect(feed.items.value).toEqual([{ id: 'new' }])
  expect(snapshot.write).toHaveBeenCalledOnce()
})

it('renders cold-start batches before completion and only persists the final sorted snapshot', async () => {
  let publish!: (page: FeedPage<{ id: string }>) => void
  let finish!: (page: FeedPage<{ id: string }>) => void
  const { feed, snapshot } = mountSnapshotFeed(undefined, (_, update) => {
    publish = update!
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  await settle()
  publish({ items: [{ id: 'older' }], done: false })
  await settle()
  expect(document.querySelector('p')!.textContent).toBe('older')
  expect(feed.isLoading.value).toBe(true)
  expect(feed.noMoreContent.value).toBe(false)
  expect(snapshot.write).not.toHaveBeenCalled()
  publish({ items: [{ id: 'newer' }, { id: 'older' }], done: false })
  await settle()
  expect(document.querySelector('p')!.textContent).toBe('newer,older')
  finish({ items: [{ id: 'newer' }, { id: 'older' }], done: true })
  await settle()
  expect(feed.isLoading.value).toBe(false)
  expect(feed.noMoreContent.value).toBe(true)
  expect(snapshot.write).toHaveBeenCalledExactlyOnceWith({ items: [{ id: 'newer' }, { id: 'older' }], done: true })
})

it('keeps a complete stale snapshot visible while new partial batches arrive', async () => {
  let publish!: (page: FeedPage<{ id: string }>) => void
  let finish!: (page: FeedPage<{ id: string }>) => void
  const { feed, snapshot } = mountSnapshotFeed(true, (_, update) => {
    publish = update!
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  await settle()
  publish({ items: [{ id: 'partial' }], done: false })
  await settle()
  expect(document.querySelector('p')!.textContent).toBe('saved')
  expect(feed.showingSnapshot.value).toBe(true)
  expect(snapshot.write).not.toHaveBeenCalled()
  finish({ items: [{ id: 'complete' }], done: true })
  await settle()
  expect(document.querySelector('p')!.textContent).toBe('complete')
  expect(snapshot.write).toHaveBeenCalledOnce()
})

it('retains cold-start batches on failure and permits retry without caching incomplete results', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const load = vi.fn(async (_: () => boolean, publish?: (page: FeedPage<{ id: string }>) => void): Promise<FeedPage<{ id: string }>> => {
    publish?.({ items: [{ id: 'partial' }], done: false })
    throw new Error('offline')
  })
  try {
    const { feed, snapshot } = mountSnapshotFeed(undefined, load)
    await settle()
    expect(feed.items.value).toEqual([{ id: 'partial' }])
    expect(feed.loadFailed.value).toBe(true)
    expect(feed.isLoading.value).toBe(false)
    expect(snapshot.write).not.toHaveBeenCalled()
    load.mockImplementationOnce(async () => ({ items: [{ id: 'complete' }], done: true }))
    await feed.load()
    expect(feed.items.value).toEqual([{ id: 'complete' }])
    expect(snapshot.write).toHaveBeenCalledOnce()
  }
  finally {
    error.mockRestore()
  }
})

it('renders stale snapshots before the network finishes and replaces the complete list atomically', async () => {
  let resolve!: (page: FeedPage<{ id: string }>) => void
  const { feed, snapshot } = mountSnapshotFeed(true, () => new Promise((done) => {
    resolve = done
  }))
  await settle()
  expect(document.querySelector('p')!.textContent).toBe('saved')
  expect(feed.showingSnapshot.value).toBe(true)
  expect(feed.isLoading.value).toBe(true)
  resolve({ items: [{ id: 'new' }], done: true })
  await settle()
  expect(feed.items.value).toEqual([{ id: 'new' }])
  expect(feed.showingSnapshot.value).toBe(false)
  expect(snapshot.write).toHaveBeenCalledOnce()
})

it('keeps stale data on network failure, allows retry, and clears it on an authorization failure', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const load = vi.fn<() => Promise<FeedPage<{ id: string }>>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [], done: true, unauthorized: true })
  try {
    const { feed, snapshot } = mountSnapshotFeed(true, load)
    await settle()
    expect(feed.items.value).toEqual([{ id: 'saved' }])
    expect(feed.loadFailed.value).toBe(true)
    expect(snapshot.write).not.toHaveBeenCalled()
    await feed.load()
    expect(feed.items.value).toEqual([])
    expect(feed.needToLoginFirst.value).toBe(true)
    expect(snapshot.remove).toHaveBeenCalledOnce()
  }
  finally {
    error.mockRestore()
  }
})

it('ignores an obsolete background refresh after a newer explicit refresh', async () => {
  let finishOld!: (page: FeedPage<{ id: string }>) => void
  let publishOld!: (page: FeedPage<{ id: string }>) => void
  const load = vi.fn<Parameters<typeof mountSnapshotFeed>[1]>()
    .mockImplementationOnce((_, publish) => {
      publishOld = publish!
      return new Promise((resolve) => {
        finishOld = resolve
      })
    })
    .mockResolvedValueOnce({ items: [{ id: 'latest' }], done: true })
  const { feed, snapshot } = mountSnapshotFeed(true, load)
  await settle()
  await feed.reset()
  publishOld({ items: [{ id: 'obsolete-partial' }], done: false })
  await settle()
  expect(feed.items.value).toEqual([{ id: 'latest' }])
  finishOld({ items: [{ id: 'obsolete' }], done: true })
  await settle()
  expect(feed.items.value).toEqual([{ id: 'latest' }])
  expect(snapshot.write).toHaveBeenCalledOnce()
})
