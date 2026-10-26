import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import API_MOMENT from '~/background/messageListeners/api/moment'
import { setupStorageMessages } from '~/background/messageListeners/storage'
import { apiListenerFactory } from '~/background/utils'
import { useStorageLocal } from '~/composables/useStorageLocal'
import { parseSettings } from '~/logic/settings'
import { boundedBackfill } from '~/utils/boundedPagination'
import { compileFilterKeywords } from '~/utils/filterRules'
import { createInflightRequests } from '~/utils/inflightRequest'
import { isVerticalVideo, parseBilibiliUri } from '~/utils/uriParse'

const extension = vi.hoisted(() => {
  const values: Record<string, string> = {}
  const messages: ((message: unknown) => Promise<void> | undefined)[] = []
  const changes: ((update: Record<string, { newValue?: string }>, area: string) => void)[] = []
  const local = {
    get: async (key: string) => ({ [key]: values[key] }),
    set: async (items: Record<string, string>) => {
      Object.assign(values, items)
      const update = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { newValue }]))
      changes.forEach(listener => listener(update, 'local'))
    },
    remove: async (key: string) => {
      delete values[key]
      changes.forEach(listener => listener({ [key]: {} }, 'local'))
    },
  }
  return {
    values,
    messages,
    changes,
    browser: {
      storage: { local, onChanged: { addListener: (listener: (typeof changes)[number]) => changes.push(listener) } },
      runtime: {
        onMessage: { addListener: (listener: (typeof messages)[number]) => messages.push(listener) },
        sendMessage: async (message: unknown) => {
          await Promise.all(messages.map(listener => listener(message)))
        },
      },
    },
  }
})
vi.mock('webextension-polyfill', () => ({ default: extension.browser, storage: extension.browser.storage }))
beforeEach(() => {
  extension.messages.length = 0
  extension.changes.length = 0
  Object.keys(extension.values).forEach(key => delete extension.values[key])
})

it('omits the initial feed cursor and preserves large cursor IDs exactly', async () => {
  const fetch = vi.fn(async (_input: string) => new Response(JSON.stringify({ code: 0 })))
  vi.stubEnv('FIREFOX', '')
  vi.stubGlobal('fetch', fetch)
  try {
    const listener = apiListenerFactory(API_MOMENT)
    await listener({ contentScriptQuery: 'getMoments', type: 'video', offset: '' })
    expect(new URL(fetch.mock.calls[0][0]).searchParams.has('offset')).toBe(false)
    const offset = '1234567890123456789'
    await listener({ contentScriptQuery: 'getMoments', type: 'video', offset })
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('offset')).toBe(offset)
  }
  finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})

it('stops backfill on empty results and limits a load cycle', async () => {
  const empty = vi.fn(async () => ({ added: 0, done: false }))
  await boundedBackfill({ current: () => true, loadPage: empty, needsMore: async () => true })
  expect(empty).toHaveBeenCalledTimes(1)

  const page = vi.fn(async () => ({ added: 30, done: false }))
  await boundedBackfill({ current: () => true, loadPage: page, needsMore: async () => true })
  expect(page).toHaveBeenCalledTimes(5)
})

it('keeps valid filter rules usable while an expression is incomplete', () => {
  const rules = compileFilterKeywords([{ keyword: '/[/' }, { keyword: '/advert.*/' }, { keyword: 'author' }])
  expect(rules.exact.has('AUTHOR')).toBe(true)
  expect(rules.patterns.some(pattern => pattern.test('Advertisement'))).toBe(true)
})

it('shares previews and cancels only after the final consumer leaves', async () => {
  const request = createInflightRequests()
  const first = new AbortController()
  const second = new AbortController()
  let finish!: (url: string) => void
  let shared!: AbortSignal
  const load = vi.fn((signal: AbortSignal) => {
    shared = signal
    return new Promise<string>((resolve) => {
      finish = resolve
    })
  })
  const a = request('video', load, first.signal)
  const b = request('video', load, second.signal)
  await Promise.resolve()
  first.abort()
  await expect(a).rejects.toBeDefined()
  expect(shared.aborted).toBe(false)
  finish('preview.mp4')
  expect(await b).toBe('preview.mp4')
  const last = new AbortController()
  const c = request('video', load, last.signal)
  await Promise.resolve()
  last.abort()
  await expect(c).rejects.toBeDefined()
  expect(shared.aborted).toBe(true)
  expect(load).toHaveBeenCalledTimes(2)
})

it('merges simultaneous tab edits and propagates logout', async () => {
  setupStorageMessages()
  const a = useStorageLocal('settings', ref({ theme: 'auto', blockAds: false }), { debounce: 200 })
  const b = useStorageLocal('settings', ref({ theme: 'auto', blockAds: false }), { debounce: 200 })
  await Promise.all([a.ready, b.ready])
  a.value.theme = 'dark'
  b.value.blockAds = true
  await Promise.all([a.flush(), b.flush()])
  await vi.waitFor(() => {
    expect(a.value).toEqual({ theme: 'dark', blockAds: true })
    expect(b.value).toEqual(a.value)
  })
  expect(JSON.parse(extension.values.settings)).toEqual(a.value)
  const keyA = useStorageLocal('accessKey', '')
  const keyB = useStorageLocal('accessKey', '')
  await Promise.all([keyA.ready, keyB.ready])
  keyA.value = 'login'
  await keyA.flush()
  await vi.waitFor(() => expect(keyB.value).toBe('login'))
  keyA.value = null
  await keyA.flush()
  await vi.waitFor(() => expect(keyB.value).toBe(''))
  expect(extension.values.accessKey).toBeUndefined()
})

it('rejects invalid imports before replacing settings', () => {
  expect(() => parseSettings({ theme: 'other' })).toThrow('theme')
  expect(() => parseSettings({ filterByTitle: [{ keyword: null, remark: '' }] })).toThrow('filterByTitle')
  expect(parseSettings({ theme: 'dark', wallpaperMaskOpacity: 50 })).toMatchObject({
    theme: 'dark',
    wallpaperMaskOpacity: 50,
  })
})

it('keeps URI query values intact and recognizes vertical videos', () => {
  const video = parseBilibiliUri('bilibili://video/1?cid=12&trackid=a?b&player_width=720&player_height=1280#x')
  expect(video).toMatchObject({ cid: '12', trackid: 'a?b' })
  expect(isVerticalVideo('bilibili://video/1?player_width=720&player_height=1280')).toBe(true)
})
