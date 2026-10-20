import { settings } from '~/logic'

// DISABLED WHEN IN TOUCHSCREEN OPTIMIZATION IS ENABLED IN SETTINGS
export function useDelayedHover({ enterDelay = 300, leaveDelay = 300, beforeEnter, enter, beforeLeave, leave }:
{ enterDelay?: number, leaveDelay?: number, beforeEnter?: Function, enter: Function, beforeLeave?: Function, leave: Function }) {
  const el = ref<HTMLElement>()

  let enterTimer: ReturnType<typeof setTimeout> | undefined
  let leaveTimer: ReturnType<typeof setTimeout> | undefined

  function clearTimers() {
    clearTimeout(enterTimer)
    clearTimeout(leaveTimer)
    enterTimer = undefined
    leaveTimer = undefined
  }

  function handleMouseEnter() {
    if (beforeEnter)
      beforeEnter()

    if (enterTimer) {
      clearTimeout(enterTimer)
      enterTimer = undefined
    }
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = undefined
    }
    enterTimer = setTimeout(() => {
      enter()
    }, enterDelay)
  }
  function handleMouseLeave() {
    if (beforeLeave)
      beforeLeave()

    if (enterTimer) {
      clearTimeout(enterTimer)
      enterTimer = undefined
    }
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = undefined
    }
    leaveTimer = setTimeout(() => {
      leave()
    }, leaveDelay)
  }

  watch([el, () => settings.value.touchScreenOptimization], ([element, touchScreenOptimization], _, onCleanup) => {
    if (element && !touchScreenOptimization) {
      element.addEventListener('mouseenter', handleMouseEnter)
      element.addEventListener('mouseleave', handleMouseLeave)
    }

    onCleanup(() => {
      clearTimers()
      element?.removeEventListener('mouseenter', handleMouseEnter)
      element?.removeEventListener('mouseleave', handleMouseLeave)
    })
  }, { flush: 'post', immediate: true })

  return el
}
