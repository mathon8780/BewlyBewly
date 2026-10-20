import '~/styles'
import 'uno.css'

import { createApp } from 'vue'

import { initializeDarkTheme, useDark } from '~/composables/useDark'
import { BEWLY_MOUNTED } from '~/constants/globalEvents'
import { settings, settingsReady } from '~/logic'
import { setupApp } from '~/logic/common-setup'
import RESET_BEWLY_CSS from '~/styles/reset.css?raw'
import { runWhenIdle } from '~/utils/lazyLoad'
import { compareVersions, injectCSS, isHomePage, isInIframe, isNotificationPage, isVideoOrBangumiPage } from '~/utils/main'
import { SVG_ICONS } from '~/utils/svgIcons'

import { version } from '../../package.json'
import { mirrorExtensionStyles } from './extensionStyles'

const isFirefox: boolean = /Firefox/i.test(navigator.userAgent)

// Fix `OverlayScrollbars` not working in Firefox
// https://github.com/fingerprintjs/fingerprintjs/issues/683#issuecomment-881210244
if (isFirefox) {
  window.requestIdleCallback = window.requestIdleCallback.bind(window)
  window.cancelIdleCallback = window.cancelIdleCallback.bind(window)
  window.requestAnimationFrame = window.requestAnimationFrame.bind(window)
  window.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  window.setTimeout = window.setTimeout.bind(window)
  window.clearTimeout = window.clearTimeout.bind(window)
}

const currentUrl = document.URL

function isSupportedPages(): boolean {
  if (isInIframe())
    return false
  if (
    // homepage
    isHomePage()
    // video or bangumi page
    || isVideoOrBangumiPage()
    // popular page https://www.bilibili.com/v/popular/all
    || /https?:\/\/(?:www\.)?bilibili\.com\/v\/popular\/all.*/.test(currentUrl)
    // search page
    || /https?:\/\/search\.bilibili\.com\.*/.test(currentUrl)
    // moments page
    // https://github.com/BewlyBewly/BewlyBewly/issues/1246
    // https://github.com/BewlyBewly/BewlyBewly/issues/1256
    // https://github.com/BewlyBewly/BewlyBewly/issues/1266
    || /https?:\/\/t\.bilibili\.com(?!\/vote|\/share).*/.test(currentUrl)
    // moment detail
    || /https?:\/\/(?:www\.)?bilibili\.com\/opus\/.*/.test(currentUrl)
    // history page
    || /https?:\/\/(?:www\.)?bilibili\.com\/history.*/.test(currentUrl)
    || /https?:\/\/(?:www\.)?bilibili\.com\/account\/history.*/.test(currentUrl)
    // watcher later page
    || /https?:\/\/(?:www\.)?bilibili\.com\/watchlater\/#\/list.*/.test(currentUrl)
    || /https?:\/\/(?:www\.)?bilibili\.com\/watchlater\/list.*/.test(currentUrl)
    // user space page
    || /https?:\/\/space\.bilibili\.com\.*/.test(currentUrl)
    // notifications page
    || /https?:\/\/message\.bilibili\.com\.*/.test(currentUrl)
    // bilibili channel page b站分区页面
    || /https?:\/\/(?:www\.)?bilibili\.com\/v\/(?!popular).*/.test(currentUrl)
    // anime page & chinese anime page
    || /https?:\/\/(?:www\.)?bilibili\.com\/(?:anime|guochuang).*/.test(currentUrl)
    // channel page e.g. tv shows, movie, variety shows, mooc page
    || /https?:\/\/(?:www\.)?bilibili\.com\/(?:tv|movie|variety|mooc|documentary).*/.test(currentUrl)
    // article page
    || /https?:\/\/(?:www\.)?bilibili\.com\/read\/.*/.test(currentUrl)
    // 404 page
    || /^https?:\/\/(?:www\.)?bilibili\.com\/404.*$/.test(currentUrl)
    // creative center page 創作中心頁
    || /^https?:\/\/member\.bilibili\.com\/platform.*$/.test(currentUrl)
    // account settings page 帳號設定頁
    || /^https?:\/\/account\.bilibili\.com\/.*$/.test(currentUrl)
    // login page
    || /^https?:\/\/passport\.bilibili\.com\/login.*$/.test(currentUrl)
    // music center page 新歌熱榜 https://music.bilibili.com/pc/music-center/
    || /https?:\/\/music\.bilibili\.com\/pc\/music-center.*$/.test(currentUrl)
  ) {
    return true
  }
  else {
    return false
  }
}

export function isSupportedIframePages(): boolean {
  if (
    isInIframe()
    && (
      // supports Bilibili page URLs recorded in the dock
      isHomePage()
      // Since `Open in drawer` will open the video page within an iframe, so we need to support the following pages
      || isVideoOrBangumiPage()
      || /https?:\/\/search\.bilibili\.com\/all.*/.test(currentUrl)
      || /https?:\/\/www\.bilibili\.com\/anime.*/.test(currentUrl)
      || /https?:\/\/space\.bilibili\.com\/\d+\/favlist.*/.test(currentUrl)
      || /https?:\/\/www\.bilibili\.com\/history.*/.test(currentUrl)
      || /https?:\/\/www\.bilibili\.com\/watchlater\/#\/list.*/.test(currentUrl)
      || /https?:\/\/www\.bilibili\.com\/watchlater\/list.*/.test(currentUrl)
      // moments page
      // https://github.com/BewlyBewly/BewlyBewly/issues/1246
      // https://github.com/BewlyBewly/BewlyBewly/issues/1256
      // https://github.com/BewlyBewly/BewlyBewly/issues/1266
      || /https?:\/\/t\.bilibili\.com(?!\/vote|\/share).*/.test(currentUrl)
      // notifications page, for `Open the notifications page as a drawer`
      || isNotificationPage()
    )
  ) {
    return true
  }
  else {
    return false
  }
}

let started = false

export async function start() {
  if (started)
    return
  started = true
  await settingsReady
  if (!isSupportedPages() && !isSupportedIframePages())
    return
  const disposeDarkTheme = initializeDarkTheme()
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted)
      disposeDarkTheme()
  })
  let beforeLoadedStyleEl: HTMLStyleElement | undefined

  if (isSupportedPages() || isSupportedIframePages()) {
    if (settings.value.adaptToOtherPageStyles) {
      document.documentElement.classList.add('bewly-design')

      // Remove the Bilibili Evolved's dark mode style
      runWhenIdle(async () => {
        const darkModeStyle = document.head.querySelector('#dark-mode')
        if (darkModeStyle)
          document.head.removeChild(darkModeStyle)
      })
    }

    else {
      document.documentElement.classList.remove('bewly-design')
    }
  }

  if (settings.value.adaptToOtherPageStyles && isHomePage()) {
    beforeLoadedStyleEl = injectCSS(`
    html.bewly-design {
      background-color: var(--bew-bg);
      transition: background-color 0.2s ease-in;
    }

    body {
      display: none;
    }
  `)

    // Add opacity transition effect for page loaded
    injectCSS(`
    body {
      transition: opacity 0.5s;
    }
  `)
  }

  window.addEventListener(BEWLY_MOUNTED, () => {
    if (beforeLoadedStyleEl)
      beforeLoadedStyleEl.remove()
  }, { once: true })

  // Set the original Bilibili top bar to `display: none` to prevent it from showing before the load
  // see: https://github.com/BewlyBewly/BewlyBewly/issues/967
  const removeOriginalTopBar = injectCSS(`.bili-header, #biliMainHeader { visibility: hidden !important; }`)

  async function onDOMLoaded() {
    let originalTopBar: HTMLElement | null = null

    const changeHomePage = !isInIframe() && !settings.value.useOriginalBilibiliHomepage && isHomePage()

    // Remove the original Bilibili homepage if in Bilibili homepage & useOriginalBilibiliHomepage is enabled
    if (changeHomePage) {
      originalTopBar = document.querySelector<HTMLElement>('.bili-header')
      const originalTopBarInnerUselessContents = document.querySelectorAll<HTMLElement>('.bili-header > *:not(.bili-header__bar)')

      if (originalTopBar) {
      // always show the background on the original bilibili top bar
        originalTopBar.querySelector('.bili-header__bar')?.classList.add('slide-down')
      }

      // Remove the original Bilibili homepage if in Bilibili homepage & useOriginalBilibiliHomepage is enabled
      document.body.innerHTML = ''

      // Remove the Bilibili Evolved homepage & Bilibili-Gate homepage
      injectCSS(`
      .home-redesign-base, .bilibili-gate-root {
        display: none !important;
      }
    `)

      if (originalTopBarInnerUselessContents)
        originalTopBarInnerUselessContents.forEach(item => (item as HTMLElement).style.display = 'none')
      if (originalTopBar)
        document.body.appendChild(originalTopBar)
    }

    if (isSupportedPages() || isSupportedIframePages()) {
    // Then inject the app
      if (isHomePage()) {
        await injectApp()
      }
      else {
        await injectAppWhenIdle()
      }
    }

    // Reset the original Bilibili top bar display style
    if (removeOriginalTopBar)
      document.documentElement.removeChild(removeOriginalTopBar)
  }

  const mount = () => onDOMLoaded().catch((error) => {
    beforeLoadedStyleEl?.remove()
    removeOriginalTopBar.remove()
    console.error(error)
  })
  if (document.readyState !== 'loading')
    await mount()
  else
    document.addEventListener('DOMContentLoaded', mount, { once: true })
}

function injectAppWhenIdle() {
  return new Promise<void>((resolve, reject) => {
    // Inject app when idle
    runWhenIdle(async () => {
      try {
        await injectApp()
        resolve()
      }
      catch (error) {
        reject(error)
      }
    }, 1000)
  })
}

async function injectApp() {
  const { default: App } = await import('./views/App.vue')
  // Remove bewly element if it already exists and the version is less than the current version
  // Only the development mode bewly element remains
  const bewlyElArr: NodeListOf<Element> = document.querySelectorAll('#bewly')
  if (bewlyElArr.length > 0) {
    // alert(`
    //   You have multiple versions of BewlyBewly installed. Please retain only one to avoid conflicts and issues!
    //   您安装了多个版本的 BewlyBewly。请只保留一个版本以避免冲突和问题！
    //   您安裝了多個版本的 BewlyBewly。請只保留一個版本以避免衝突和問題！
    //   你單咗幾個版本嘅 BewlyBewly。請淨係留一個版本嚟避免衝突同問題！
    // `)

    bewlyElArr.forEach((el: Element) => {
      const elVersion = el.getAttribute('data-version') || '0.0.0'
      const elIsDev = el.getAttribute('data-dev') === 'true'

      // Remove bewly element if the version is less than the current version
      if (compareVersions(elVersion, version) < 0)
        el.remove()
      // Only the development mode element remains
      else if (!elIsDev)
        el.remove()
    })
  }

  // mount component to context window
  const container = document.createElement('div')
  container.id = 'bewly'
  // Theme initialization runs before this shadow host exists.
  container.classList.toggle('dark', useDark().isDark.value)
  container.setAttribute('data-version', version)
  container.setAttribute('data-dev', import.meta.env.DEV ? 'true' : 'false')
  const root = document.createElement('div')
  // Fix #69 https://github.com/hakadao/BewlyBewly/issues/69
  // https://medium.com/@emilio_martinez/shadow-dom-open-vs-closed-1a8cf286088a - open shadow dom
  const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container
  const resetStyleEl = document.createElement('style')
  resetStyleEl.textContent = `${RESET_BEWLY_CSS}`
  shadowDOM.appendChild(resetStyleEl)
  shadowDOM.appendChild(root)
  const styles = mirrorExtensionStyles(shadowDOM, browser.runtime.getURL('dist/contentScripts/'))
  container.style.opacity = '0'
  container.style.transition = 'opacity 0.5s'
  styles.ready.then(() => {
    requestAnimationFrame(() => {
      container.style.opacity = '1'
    })
  })

  // startShadowDOMStyleInjection()

  // inject svg icons
  const svgDiv = document.createElement('div')
  svgDiv.innerHTML = SVG_ICONS
  shadowDOM.appendChild(svgDiv)

  document.body.appendChild(container)

  const app = createApp(App)
  await setupApp(app)
  app.mount(root)
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      app.unmount()
      styles.dispose()
    }
  })
}
