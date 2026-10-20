import { expect, it, vi } from 'vitest'

import { boundedBackfill } from '~/utils/boundedPagination'
import { compileFilterKeywords } from '~/utils/filterRules'
import { createInflightRequests } from '~/utils/inflightRequest'

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

it('shares only pending preview requests and releases them after completion', async () => {
  const request = createInflightRequests()
  let complete!: (url: string) => void
  const load = vi.fn(() => new Promise<string>((resolve) => {
    complete = resolve
  }))
  const first = request('video', load)
  const second = request('video', load)
  await Promise.resolve()
  expect(load).toHaveBeenCalledTimes(1)
  complete('preview.mp4')
  expect(await first).toBe('preview.mp4')
  expect(await second).toBe('preview.mp4')
  expect(await request('video', async () => 'new.mp4')).toBe('new.mp4')
})
