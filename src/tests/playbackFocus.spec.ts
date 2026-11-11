import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createSSRApp, defineComponent, h, nextTick, onMounted, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { startCommentFilter } from '~/contentScripts/commentFilter'
import type { PlaybackFocusOptions } from '~/contentScripts/playbackFocus'
import { startPlaybackFocus } from '~/contentScripts/playbackFocus'
import { originalSettings, parseSettings } from '~/logic/settings'

// Vitest 默认将 CSS 导入替换为空串，这里读取实际样式验证显示行为。
vi.mock('~/styles/playbackFocus.css?raw', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: readFileSync(`${process.cwd()}/src/styles/playbackFocus.css`, 'utf8') }
})

const defaults: PlaybackFocusOptions = { blockRelatedVideos: false, blockVideoActivities: false }
let focus: ReturnType<typeof startPlaybackFocus> | undefined
let stopFilter: (() => void) | undefined
let app: App | undefined

function navigate(path: string) {
  vi.stubGlobal('location', new URL(path, 'https://www.bilibili.com'))
}

function start(options: Partial<PlaybackFocusOptions> = {}) {
  focus = startPlaybackFocus({ ...defaults, ...options })
  return focus
}

beforeEach(() => {
  vi.useFakeTimers()
  navigate('/video/BV1GJ411x7h7/')
})

afterEach(() => {
  app?.unmount()
  app = undefined
  focus?.dispose()
  stopFilter?.()
  focus = undefined
  stopFilter = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('disables recommendations by default and drops the removed collapse settings on import', () => {
  expect(originalSettings.blockRelatedVideos).toBe(false)
  expect(originalSettings.blockVideoActivities).toBe(false)
  expect(parseSettings({}).blockVideoActivities).toBe(false)
  expect(parseSettings({ blockVideoActivities: true }).blockVideoActivities).toBe(true)
  expect(() => parseSettings({ blockVideoActivities: 'true' })).toThrow('blockVideoActivities')
  const imported = parseSettings({ collapseVideoComments: true, collapseVideoDescription: true })
  expect(imported).not.toHaveProperty('collapseVideoComments')
  expect(imported).not.toHaveProperty('collapseVideoDescription')
  start()
  expect(document.querySelector('style[data-bewly-playback-focus]')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})

it('toggles activity items independently, covers late items and preserves other resources and native content', () => {
  document.body.innerHTML = '<main><div id="v_desc">简介</div><div class="video-resource-list"><div id="promotion" class="video-resource-list__item"><div class="activity-m-v1 act-now"><div class="hinter-msg"><b>活动推广</b></div></div></div><div id="resource" class="video-resource-list__item">其他资源</div></div><div id="commentapp">评论</div><div class="recommend-list-v1">推荐</div><div id="unrelated" class="activity-m-v1">无关模块</div></main>'
  const markup = document.body.innerHTML
  const promotion = document.querySelector('#promotion')!
  const recommendations = document.querySelector('.recommend-list-v1')!
  const controller = start()
  expect(getComputedStyle(promotion).display).not.toBe('none')
  controller.update({ ...defaults, blockVideoActivities: true })
  expect(getComputedStyle(promotion).display).toBe('none')
  expect(getComputedStyle(recommendations).display).not.toBe('none')
  for (const selector of ['#resource', '#v_desc', '#commentapp', '#unrelated'])
    expect(getComputedStyle(document.querySelector(selector)!).display).not.toBe('none')
  expect(document.body.innerHTML).toBe(markup)
  const late = document.createElement('div')
  late.className = 'video-resource-list__item'
  late.innerHTML = '<div class="activity-m-v1">稍后加载的活动</div>'
  document.querySelector('.video-resource-list')!.append(late)
  expect(getComputedStyle(late).display).toBe('none')
  controller.update({ ...defaults, blockRelatedVideos: true })
  expect(getComputedStyle(promotion).display).not.toBe('none')
  expect(getComputedStyle(late).display).not.toBe('none')
  expect(getComputedStyle(recommendations).display).toBe('none')
  controller.update({ blockRelatedVideos: true, blockVideoActivities: true })
  expect(getComputedStyle(promotion).display).toBe('none')
  expect(getComputedStyle(recommendations).display).toBe('none')
  controller.update(defaults)
  expect(getComputedStyle(promotion).display).not.toBe('none')
  expect(document.documentElement.hasAttribute('data-bewly-hide-activities')).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

describe.each([
  '/video/BV1GJ411x7h7/',
  '/video/BV1wD4y1o7AS/?p=2',
  '/list/ml123?bvid=BV1GJ411x7h7',
  '/watchlater/list',
  '/bangumi/play/ep232465',
  '/bangumi/play/ss24588',
])('playback page %s', (path) => {
  it('leaves native markup untouched even when saved collapse settings are still enabled', async () => {
    navigate(path)
    document.body.innerHTML = '<main><div id="player">播放器</div><aside class="up-panel-container"><img src="avatar.jpg"><button>关注</button><button>充电</button></aside><div id="v_desc" class="video-desc-container">简介</div><div id="commentapp"><bili-comments></bili-comments></div><div id="comment-module" class="comment_comment_wrapper__abc"></div><a class="mediainfo_media_desc_section__abc">简介</a></main>'
    const root = document.querySelector('main')!
    const original = root.outerHTML
    const mutations = vi.fn()
    const observer = new MutationObserver(mutations)
    observer.observe(root, { subtree: true, attributes: true, childList: true })
    const legacy = { blockRelatedVideos: true, collapseVideoComments: true, collapseVideoDescription: true }
    const controller = start(legacy)
    await vi.advanceTimersByTimeAsync(600)
    expect(root.outerHTML).toBe(original)
    expect(mutations).not.toHaveBeenCalled()
    for (const target of ['#player', '.up-panel-container', '#v_desc', '#commentapp', '#comment-module', 'bili-comments'])
      expect(getComputedStyle(document.querySelector(target)!).display).not.toBe('none')
    controller.update(defaults)
    expect(root.outerHTML).toBe(original)
    expect(vi.getTimerCount()).toBe(0)
    observer.disconnect()
  })
})

it('preserves SSR hydration, author initialization and native player and description controls', async () => {
  const page = defineComponent({
    setup() {
      const ready = ref(false)
      const mode = ref('normal')
      const expanded = ref(false)
      onMounted(() => {
        ready.value = true
      })
      return () => h('main', [
        h('div', { id: 'player', 'data-mode': mode.value }, [
          h('button', { class: 'bpx-player-ctrl-wide', onClick: () => { mode.value = 'wide' } }, '宽屏'),
          h('button', { class: 'bpx-player-ctrl-web', onClick: () => { mode.value = 'web' } }, '网页全屏'),
        ]),
        h('aside', { class: 'up-panel-container' }, [
          h('img', { src: ready.value ? 'avatar.jpg' : undefined }),
          h('button', { disabled: !ready.value }, '关注'),
          h('button', { disabled: !ready.value }, '充电'),
        ]),
        h('div', { id: 'v_desc' }, [
          h('button', { onClick: () => { expanded.value = !expanded.value } }, '展开'),
          h('p', expanded.value ? '完整简介' : '简介'),
        ]),
        h('div', { id: 'commentapp' }, [h('bili-comments')]),
        h('div', { class: 'recommend-list-v1' }, '推荐'),
      ])
    },
  })
  const root = document.body.appendChild(document.createElement('div'))
  root.innerHTML = await renderToString(createSSRApp(page))
  const original = root.innerHTML
  start({ blockRelatedVideos: true })
  expect(root.innerHTML).toBe(original)
  app = createSSRApp(page)
  app.mount(root)
  await nextTick()
  expect(document.querySelector('img')!.getAttribute('src')).toBe('avatar.jpg')
  expect(document.querySelector('.up-panel-container button:disabled')).toBeNull()
  for (const mode of ['wide', 'web']) {
    document.querySelector<HTMLButtonElement>(`.bpx-player-ctrl-${mode}`)!.click()
    await nextTick()
    expect(document.querySelector('#player')!.getAttribute('data-mode')).toBe(mode)
  }
  document.querySelector<HTMLButtonElement>('#v_desc button')!.click()
  await nextTick()
  expect(document.querySelector('#v_desc p')!.textContent).toBe('完整简介')
  expect(document.querySelector('bili-comments')).not.toBeNull()
})

it('hides late recommendations without hiding authors, parts, collections or episodes', () => {
  document.body.innerHTML = '<aside><div class="up-panel-container">作者</div><div class="video-sections-v1">合集</div><div class="multi-page">分 P</div><div class="ep-list-wrapper">选集</div><div class="video-pod"><div class="video-pod__list multip">分 P</div><div class="video-pod__list section">合集</div></div><div class="PaginatedEpList_root__67C7p">选集</div><div class="recommend-list-v1">相关推荐</div></aside>'
  const controller = start({ blockRelatedVideos: true })
  expect(getComputedStyle(document.querySelector('.recommend-list-v1')!).display).toBe('none')
  for (const selector of ['.up-panel-container', '.video-sections-v1', '.multi-page', '.ep-list-wrapper', '.video-pod', '.video-pod__list', '.PaginatedEpList_root__67C7p'])
    expect(getComputedStyle(document.querySelector(selector)!).display).not.toBe('none')
  for (const name of ['recommend_wrap__abc', 'RecommendSkeleton_blockWrap__lKeue', 'bpx-player-ending-related']) {
    const element = document.body.appendChild(document.createElement('div'))
    element.className = name
    expect(getComputedStyle(element).display).toBe('none')
  }
  controller.update(defaults)
  expect(getComputedStyle(document.querySelector('.recommend-list-v1')!).display).not.toBe('none')
  expect(vi.getTimerCount()).toBe(0)
})

it('updates recommendation scope after SPA navigation and disposes all timers', async () => {
  const controller = start({ blockRelatedVideos: true, blockVideoActivities: true })
  expect(document.documentElement.hasAttribute('data-bewly-hide-recommendations')).toBe(true)
  expect(document.documentElement.hasAttribute('data-bewly-hide-activities')).toBe(true)
  navigate('/')
  await vi.advanceTimersByTimeAsync(500)
  expect(document.documentElement.hasAttribute('data-bewly-hide-recommendations')).toBe(false)
  expect(document.documentElement.hasAttribute('data-bewly-hide-activities')).toBe(false)
  navigate('/bangumi/play/ep232465')
  window.dispatchEvent(new PopStateEvent('popstate'))
  expect(document.documentElement.hasAttribute('data-bewly-hide-recommendations')).toBe(true)
  expect(document.documentElement.hasAttribute('data-bewly-hide-activities')).toBe(true)
  controller.dispose()
  expect(vi.getTimerCount()).toBe(0)
  controller.update({ ...defaults, blockRelatedVideos: true })
  expect(document.querySelector('style[data-bewly-playback-focus]')).toBeNull()
  expect(document.documentElement.hasAttribute('data-bewly-hide-activities')).toBe(false)
})

it('keeps the existing comment filter independent of native comment visibility', async () => {
  document.body.innerHTML = '<div id="commentapp"><div class="reply-item"><div class="root-reply-container"><div class="root-reply"><span class="reply-content">@friend</span></div></div></div></div>'
  stopFilter = startCommentFilter()
  start({ blockRelatedVideos: true })
  await vi.advanceTimersByTimeAsync(60)
  expect(document.querySelector<HTMLElement>('.reply-item')!.style.display).toBe('none')
  expect(getComputedStyle(document.querySelector('#commentapp')!).display).not.toBe('none')
  focus!.dispose()
  expect(document.querySelector<HTMLElement>('.reply-item')!.style.display).toBe('none')
})
