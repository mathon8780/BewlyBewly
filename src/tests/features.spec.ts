import { afterEach, expect, it, vi } from 'vitest'

import { startCommentFilter } from '~/contentScripts/commentFilter'
import type { List, WatchListResult } from '~/models/anime/watchList'
import { createSubscribedSeriesLoader, seriesAirDate } from '~/utils/subscribedSeries'

let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  document.body.replaceChildren()
  vi.useRealTimers()
})

it('filters root text only and restores the original display when disabled', async () => {
  document.body.innerHTML
    = '<div class="reply-item"><div class="root-reply-container" style="display: flex"><div class="user-name">@name</div><div class="root-reply"><span class="reply-content">hello</span></div></div><div class="sub-reply-item">@reply</div></div>'
  const root = document.querySelector<HTMLElement>('.root-reply-container')!
  stop = startCommentFilter()
  expect(root.style.display).toBe('flex')
  expect(root.parentElement!.style.display).toBe('')
  root.querySelector('.reply-content')!.textContent = 'hello @friend'
  await vi.waitFor(() => expect(root.parentElement!.style.display).toBe('none'))
  expect(document.querySelector<HTMLElement>('.sub-reply-item')!.style.display).toBe('')
  stop()
  expect(root.style.display).toBe('flex')
  expect(root.parentElement!.style.display).toBe('')
})

it('handles nested shadow roots and late rich text without filtering replies', async () => {
  vi.useFakeTimers()
  const thread = document.createElement('bili-comment-thread-renderer')
  document.body.append(thread)
  const shadow = thread.attachShadow({ mode: 'open' })
  shadow.innerHTML
    = '<bili-comment-renderer></bili-comment-renderer><bili-comment-reply-renderer>@reply</bili-comment-reply-renderer>'
  const root = shadow.querySelector<HTMLElement>('bili-comment-renderer')!
  root.attachShadow({ mode: 'open' }).innerHTML = '<bili-rich-text id="content"></bili-rich-text>'
  stop = startCommentFilter()
  const content = root.shadowRoot!.querySelector('bili-rich-text')!
  content.attachShadow({ mode: 'open' }).innerHTML = '<p id="contents">@friend</p>'
  await vi.advanceTimersByTimeAsync(1000)
  expect(thread.style.display).toBe('none')
  expect(shadow.querySelector<HTMLElement>('bili-comment-reply-renderer')!.style.display).toBe('')
  content.shadowRoot!.querySelector('p')!.textContent = 'hello'
  await vi.advanceTimersByTimeAsync(1000)
  expect(root.style.display).toBe('')
  expect(thread.style.display).toBe('')
})

function response(ids: number[], total = ids.length, ps = 30): WatchListResult {
  return {
    code: 0,
    message: '',
    ttl: 1,
    data: {
      pn: 1,
      ps,
      total,
      list: ids.map(
        season_id =>
          ({
            season_id,
            title: `Series ${season_id}`,
            cover: 'cover',
            new_ep: { index_show: 'EP 3', pub_time: '2026-10-25 12:00:00' },
          }) as unknown as List,
      ),
    },
  }
}

it('loads both types, sorts the complete list and deduplicates seasons', async () => {
  const anime = response([1, 2])
  const dramas = response([1, 3])
  anime.data.list[0].publish = { release_date: '2020-01-01' } as List['publish']
  anime.data.list[1].publish = { release_date: '2025-01-01', pub_time: '2025-01-01' } as List['publish']
  dramas.data.list[0] = anime.data.list[0]
  dramas.data.list[1].publish = { release_date: '2026-01-01' } as List['publish']
  const request = vi.fn(async ({ type }) => (type === 1 ? anime : dramas))
  const result = await createSubscribedSeriesLoader(request, () => '123').load(() => true)
  expect(result.items.map(item => item.uniqueId)).toEqual(['3', '2', '1'])
  expect(result.items[1].airDate).toBe('2025-01-01')
  expect(seriesAirDate(undefined)).toBe('')
})

it('retries only failed subscription pages and ignores an obsolete load', async () => {
  let fail = true
  const request = vi.fn(async ({ type, pn }) => {
    if (type === 2)
      return response([])
    if (pn === 1)
      return response([1], 2, 1)
    if (fail) {
      fail = false
      throw new Error('network')
    }
    return response([2], 2, 1)
  })
  const loader = createSubscribedSeriesLoader(request, () => '123')
  await expect(loader.load(() => true)).rejects.toThrow('network')
  expect((await loader.load(() => true)).items.map(item => item.uniqueId)).toEqual(['1', '2'])
  loader.reset()
  expect((await loader.load(() => false)).items).toEqual([])
})
