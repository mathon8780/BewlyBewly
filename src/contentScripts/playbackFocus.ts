import styles from '~/styles/playbackFocus.css?raw'

import { getPageType } from './pageScope'

export interface PlaybackFocusOptions {
  blockRelatedVideos: boolean
  blockVideoActivities: boolean
}

function isPlaybackPage() {
  const url = new URL(location.href)
  const page = getPageType(url.href)
  return page === 'videoPage' || page === 'animePlayback&MoviePage'
    || (page === 'watchLaterPage' && /^\/watchlater\/list(?:\/|$)/.test(url.pathname))
}

// 只用样式隐藏推荐和活动，不修改原站组件树，以免干扰初始化和评论懒加载。
export function startPlaybackFocus(initial: PlaybackFocusOptions) {
  let options = { ...initial }
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  const style = document.createElement('style')
  style.dataset.bewlyPlaybackFocus = ''
  style.textContent = styles

  function refresh() {
    const playback = isPlaybackPage()
    document.documentElement.toggleAttribute('data-bewly-hide-recommendations', playback && options.blockRelatedVideos)
    document.documentElement.toggleAttribute('data-bewly-hide-activities', playback && options.blockVideoActivities)
  }

  function stop() {
    clearInterval(timer)
    timer = undefined
    window.removeEventListener('popstate', refresh)
    window.removeEventListener('hashchange', refresh)
    document.documentElement.removeAttribute('data-bewly-hide-recommendations')
    document.documentElement.removeAttribute('data-bewly-hide-activities')
    style.remove()
  }

  function sync(next: PlaybackFocusOptions) {
    options = { ...next }
    if (!options.blockRelatedVideos && !options.blockVideoActivities) {
      stop()
      return
    }
    if (!style.isConnected)
      document.documentElement.append(style)
    if (!timer) {
      // 原生 SPA 的 pushState 不会触发 popstate；新推荐节点由 CSS 自动覆盖。
      timer = setInterval(refresh, 500)
      window.addEventListener('popstate', refresh)
      window.addEventListener('hashchange', refresh)
    }
    refresh()
  }

  sync(initial)
  return {
    update(options: PlaybackFocusOptions) {
      if (!disposed)
        sync(options)
    },
    dispose() {
      disposed = true
      stop()
    },
  }
}
