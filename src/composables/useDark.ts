import { computed, effectScope, nextTick, readonly, ref, watch } from 'vue'

import { settings } from '~/logic'
import { runWhenIdle } from '~/utils/lazyLoad'
import { setCookie } from '~/utils/main'

// Components consume these shared refs without adding document-wide effects.
const preferredDark = ref(false)
const currentSystemColorScheme = computed(() => preferredDark.value ? 'dark' : 'light')
const currentAppColorScheme = computed(() => settings.value.theme === 'auto' ? currentSystemColorScheme.value : settings.value.theme)
const isDark = computed(() => currentAppColorScheme.value === 'dark')
let disposeTheme: (() => void) | undefined

/** One owner per document; its disposer cancels every compatibility retry. */
export function initializeDarkTheme() {
  if (disposeTheme)
    return disposeTheme
  const scope = effectScope(true)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  preferredDark.value = media.matches
  const onChange = () => {
    preferredDark.value = media.matches
  }
  media.addEventListener('change', onChange)
  let timer: ReturnType<typeof setInterval> | undefined
  let idle: ReturnType<typeof runWhenIdle> | undefined
  let disposed = false
  scope.run(() => {
    watch(isDark, (dark) => {
      clearInterval(timer)
      idle?.dispose()
      const scheme = dark ? 'dark' : 'light'
      document.querySelector('#bewly')?.classList.toggle('dark', dark)
      document.documentElement.classList.toggle('dark', dark)
      // Preserve the existing compatibility policy for Bilibili's partial theme.
      document.documentElement.classList.remove('bili_dark')
      void nextTick(() => {
        if (!disposed)
          document.body?.classList.toggle('dark', dark)
      })
      setCookie('theme_style', scheme, 365 * 10)
      const dispatch = () => window.dispatchEvent(new CustomEvent('global.themeChange', { detail: scheme }))
      dispatch()
      idle = runWhenIdle(() => {
        let retries = 0
        timer = setInterval(() => {
          dispatch()
          if (++retries >= 10)
            clearInterval(timer)
        }, 500)
      })
    }, { immediate: true })
  })
  disposeTheme = () => {
    disposed = true
    clearInterval(timer)
    idle?.dispose()
    scope.stop()
    media.removeEventListener('change', onChange)
    disposeTheme = undefined
  }
  return disposeTheme
}

export function useDark() {
  function toggleDark(e: MouseEvent) {
    const updateThemeSettings = () => {
      if (currentAppColorScheme.value !== currentSystemColorScheme.value)
        settings.value.theme = 'auto'
      else
        settings.value.theme = preferredDark.value ? 'light' : 'dark'
    }

    const isAppearanceTransition = typeof document !== 'undefined'
    // @ts-expect-error: Transition API
      && document.startViewTransition
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!isAppearanceTransition) {
      updateThemeSettings()
    }
    else {
      const x = e.clientX
      const y = e.clientY
      const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y),
      )
      // https://github.com/vueuse/vueuse/pull/3129
      const style = document.createElement('style')
      const styleString = `
            *, *::before, *::after
            {-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
      style.appendChild(document.createTextNode(styleString))
      document.head.appendChild(style)

      // Since the above normal dom style cannot be applied in shadow dom style
      // We need to add this style again to the shadow dom
      const shadowDomStyle = document.createElement('style')
      const shadowDomStyleString = `
            *, *::before, *::after
            {-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important; will-change: background}`
      shadowDomStyle.appendChild(document.createTextNode(shadowDomStyleString))

      const bewlyShadowRoot = document.getElementById('bewly')?.shadowRoot
      const bewlyWrapper = bewlyShadowRoot?.getElementById('bewly-wrapper')
      if (!bewlyWrapper) {
        style.remove()
        updateThemeSettings()
        return
      }

      bewlyWrapper.appendChild(shadowDomStyle)

      // @ts-expect-error: Transition API
      const transition = document.startViewTransition(async () => {
        updateThemeSettings()
        await nextTick()
      })

      const cleanupStyles = () => {
        style.remove()
        shadowDomStyle.remove()
      }
      transition.finished.then(cleanupStyles, cleanupStyles)
      transition.ready.then(() => {
        const clipPath = [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
        ]
        const animation = document.documentElement.animate(
          {
            clipPath: currentAppColorScheme.value === 'dark'
              ? [...clipPath].reverse()
              : clipPath,
          },
          {
            duration: 300,
            easing: 'ease-in-out',
            pseudoElement: currentAppColorScheme.value === 'dark'
              ? '::view-transition-old(root)'
              : '::view-transition-new(root)',
          },
        )
        animation.addEventListener('finish', () => {
          cleanupStyles()
        }, { once: true })
      }).catch(cleanupStyles)
    }
  }

  return {
    isDark: readonly(isDark),
    toggleDark,
  }
}
