import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef } from 'vue'

import { useBewlyApp } from '~/composables/useAppProvider'
import { provideVideoCardState } from '~/composables/useVideoCardState'
import { settings } from '~/logic'
import { requestGeneration } from '~/utils/boundedPagination'

export interface FeedPage<T> {
  items: T[]
  done: boolean
  unauthorized?: boolean
}

/** A bounded browse window keeps its cursor until the reader explicitly continues. */
export function useWindowedFeed<T>(options: {
  key: (item: T) => string
  loadPage: (current: () => boolean) => Promise<FeedPage<T>>
  resetCursor: () => void
  merge?: (previous: T, next: T) => T | undefined
  beforeLoading: () => void
  afterLoading: () => void
  minPages?: number
  windowSize?: number
  scrollTarget?: () => number
}) {
  const { handleReachBottom, handlePageRefresh, handleBackToTop, haveScrollbar } = useBewlyApp()
  const cardState = provideVideoCardState()
  const items = shallowRef<T[]>([])
  const pending = shallowRef<T[]>([])
  const isLoading = shallowRef(false)
  const noMoreContent = shallowRef(false)
  const needToLoginFirst = shallowRef(false)
  const loadFailed = shallowRef(false)
  const limit = options.windowSize ?? 600
  const windowFull = computed(() => items.value.length >= limit && (!noMoreContent.value || pending.value.length > 0))
  const generation = requestGeneration()
  let active = true

  function append(incoming: T[]) {
    const combined = [...items.value, ...pending.value]
    const seen = new Set(combined.map(options.key))
    let added = 0
    for (const item of incoming) {
      const key = options.key(item)
      if (seen.has(key))
        continue
      seen.add(key)
      const last = combined[combined.length - 1]
      const merged = last && options.merge?.(last, item)
      if (merged) {
        combined[combined.length - 1] = merged
      }
      else {
        combined.push(item)
        added++
      }
    }
    items.value = combined.slice(0, limit)
    pending.value = combined.slice(limit)
    return added
  }

  async function load() {
    if (!active || isLoading.value || needToLoginFirst.value)
      return
    // Deletions can free slots while the last API page still has buffered items.
    // Consume those first, including the final page, before requesting another.
    if (pending.value.length && items.value.length < limit)
      append([])
    if (noMoreContent.value || windowFull.value)
      return
    const token = generation.capture()
    const current = () => active && generation.isCurrent(token)
    isLoading.value = true
    loadFailed.value = false
    options.beforeLoading()
    try {
      for (let page = 0; page < 5 && current(); page++) {
        const result = await options.loadPage(current)
        if (!current())
          return
        needToLoginFirst.value = !!result.unauthorized
        noMoreContent.value = result.done || !!result.unauthorized
        const added = append(result.items)
        if (noMoreContent.value || windowFull.value)
          return
        if (!added) {
          loadFailed.value = true
          return
        }
        if (page + 1 >= (options.minPages ?? 1) && await haveScrollbar())
          return
      }
    }
    catch {
      if (current())
        loadFailed.value = true
    }
    finally {
      if (current()) {
        isLoading.value = false
        options.afterLoading()
      }
    }
  }

  async function reset() {
    generation.invalidate()
    isLoading.value = false
    items.value = []
    pending.value = []
    noMoreContent.value = false
    needToLoginFirst.value = false
    loadFailed.value = false
    cardState.clear()
    options.resetCursor()
    await load()
  }

  async function continueWindow() {
    generation.invalidate()
    isLoading.value = false
    items.value = pending.value.slice(0, limit)
    pending.value = pending.value.slice(limit)
    cardState.clear()
    handleBackToTop(options.scrollTarget?.() ?? (settings.value.useSearchPageModeOnHomePage ? 510 : 0))
    await load()
  }

  function loadMore() {
    if (!loadFailed.value)
      void load()
  }

  function bindActions() {
    handleReachBottom.value = loadMore
    handlePageRefresh.value = reset
  }

  function stop() {
    active = false
    generation.invalidate()
    isLoading.value = false
    options.afterLoading()
    if (handleReachBottom.value === loadMore)
      handleReachBottom.value = undefined
    if (handlePageRefresh.value === reset)
      handlePageRefresh.value = undefined
  }

  onMounted(() => {
    bindActions()
    void reset()
  })
  onActivated(() => {
    active = true
    bindActions()
  })
  onDeactivated(stop)
  onBeforeUnmount(stop)

  return { items, isLoading, noMoreContent, needToLoginFirst, loadFailed, windowFull, load, reset, continueWindow }
}
