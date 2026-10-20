import { onMounted, onScopeDispose } from 'vue'

import { updateInterval } from './notify'

/** Own the polling lifetime before awaiting initialization, including hidden tabs. */
export function useTopBarPolling(initialize: () => Promise<void>, refresh: () => Promise<unknown>, interval = updateInterval) {
  let disposed = false
  let initialized = false
  let refreshing = false
  let lastRefresh = document.hidden ? Number.NEGATIVE_INFINITY : Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined

  const isAlive = () => !disposed
  const isActive = () => isAlive() && !document.hidden

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function schedule() {
    clearTimer()
    // A result discarded while hidden needs a fresh request when the tab returns.
    if (document.hidden && (!initialized || refreshing))
      lastRefresh = Number.NEGATIVE_INFINITY
    if (!initialized || !isActive() || refreshing)
      return
    timer = setTimeout(update, Math.max(0, interval - (Date.now() - lastRefresh)))
  }

  async function update() {
    if (!isActive() || refreshing)
      return
    refreshing = true
    lastRefresh = Date.now()
    try {
      await refresh()
    }
    catch (error) {
      console.error(error)
    }
    finally {
      refreshing = false
      schedule()
    }
  }

  onMounted(async () => {
    document.addEventListener('visibilitychange', schedule)
    await initialize()
    if (disposed)
      return
    initialized = true
    schedule()
  })

  onScopeDispose(() => {
    disposed = true
    clearTimer()
    document.removeEventListener('visibilitychange', schedule)
  })

  return { isActive, isAlive }
}
