import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useDelayedHover } from '~/composables/useDelayedHover'
import { settings } from '~/logic'
import { calcTimeSince } from '~/utils/dataFormatter'
import { compressAndResizeImage, isHomePage, isNotificationPage, isVideoOrBangumiPage } from '~/utils/main'
import { parseBilibiliUri } from '~/utils/uriParse'

vi.mock('~/logic', () => ({
  settings: ref({ touchScreenOptimization: false }),
}))
vi.mock('~/utils/i18n', () => ({
  i18n: { global: { t: (key: string) => key.replace('common.', '') } },
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  settings.value.touchScreenOptimization = false
})

describe('page detection', () => {
  it('recognizes notification routes', () => {
    expect(isNotificationPage('https://message.bilibili.com/#/reply')).toBe(true)
  })

  it('matches the actual host instead of a URL embedded in another URL', () => {
    expect(isHomePage('https://example.com/?next=https://www.bilibili.com/')).toBe(false)
    expect(isNotificationPage('https://message.bilibili.com.example.org/')).toBe(false)
    expect(isVideoOrBangumiPage('https://example.com/?next=https://www.bilibili.com/video/BV1')).toBe(false)
    expect(isHomePage('https://www.bilibili.com/index.html?from=test')).toBe(true)
    expect(isVideoOrBangumiPage('https://www.bilibili.com/bangumi/play/ep1')).toBe(true)
    expect(isHomePage('invalid')).toBe(false)
  })
})

describe('relative time', () => {
  it.each([
    [30, '30 second'],
    [60, '1 minute'],
    [3600, '1 hour'],
    [86400, '1 day'],
    [604800, '1 week'],
    [2592000, '1 month'],
    [31536000, '1 year'],
  ])('formats %i seconds', (seconds, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    expect(calcTimeSince(Date.now() - seconds * 1000)).toBe(expected)
  })

  it('accepts ISO dates and clamps future dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    expect(calcTimeSince('2026-10-20T11:59:30Z')).toBe('30 second')
    expect(calcTimeSince(Date.now() + 1000)).toBe('0 second')
  })
})

it('preserves question marks inside URI query values and excludes fragments', () => {
  const parsed = parseBilibiliUri('bilibili://video/1?trackid=a?b&cid=123#fragment')
  expect(parsed.trackid).toBe('a?b')
  expect(parsed.cid).toBe('123')
})

it.each(['dispose', 'touch', 'replace'])('cancels delayed hover on %s', async (action) => {
  vi.useFakeTimers()
  const scope = effectScope()
  const enter = vi.fn()
  const leave = vi.fn()
  const el = scope.run(() => useDelayedHover({ enter, leave }))!
  try {
    el.value = document.createElement('div')
    await nextTick()
    el.value.dispatchEvent(new MouseEvent('mouseenter'))
    if (action === 'dispose')
      scope.stop()
    else if (action === 'touch')
      settings.value.touchScreenOptimization = true
    else
      el.value = document.createElement('div')
    await nextTick()
    vi.runAllTimers()
    expect(enter).not.toHaveBeenCalled()
    expect(leave).not.toHaveBeenCalled()
  }
  finally {
    scope.stop()
  }
})

it.each([
  [2400, 2000, 1728, 1440],
  [4000, 2000, 2560, 1280],
  [800, 600, 800, 600],
])('fits a %ix%i wallpaper within both bounds', (width, height, expectedWidth, expectedHeight) => {
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['image'])))
  vi.stubGlobal('FileReader', class {
    onload?: (event: unknown) => void
    readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,' } }) }
  })
  const images: { onload?: () => void }[] = []
  vi.stubGlobal('Image', class {
    width = width
    height = height
    constructor() { images.push(this) }
    onload?: () => void
  })
  const callback = vi.fn()
  compressAndResizeImage(new File(['image'], 'wallpaper.png'), 2560, 1440, 0.9, callback)
  images[0].onload?.()
  expect(drawImage).toHaveBeenCalledWith(images[0], 0, 0, expectedWidth, expectedHeight)
  expect(callback).toHaveBeenCalledOnce()
})
