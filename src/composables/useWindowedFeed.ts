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

/** Snapshots contain a complete, sorted feed rather than a single API page. */
export interface FeedSnapshot<T> {
  page: FeedPage<T>
  stale: boolean
}

/** A bounded browse window keeps its cursor until the reader explicitly continues. */
export function useWindowedFeed<T>(options: {
  key: (item: T) => string
  loadPage: (current: () => boolean, publish?: (page: FeedPage<T>) => void) => Promise<FeedPage<T>>
  resetCursor: () => void
  merge?: (previous: T, next: T) => T | undefined
  beforeLoading: () => void
  afterLoading: () => void
  minPages?: number
  windowSize?: number
  scrollTarget?: () => number
  cacheIdentity?: () => unknown
  snapshot?: {
    read: () => Promise<FeedSnapshot<T> | undefined>
    write: (page: FeedPage<T>) => Promise<void>
    remove: () => Promise<void>
  }
}) {
  const { handleReachBottom, handlePageRefresh, handleBackToTop, haveScrollbar } = useBewlyApp()
  const cardState = provideVideoCardState()
  const items = shallowRef<T[]>([])
  const pending = shallowRef<T[]>([])
  const isLoading = shallowRef(false)
  const noMoreContent = shallowRef(false)
  const needToLoginFirst = shallowRef(false)
  const loadFailed = shallowRef(false)
  const showingSnapshot = shallowRef(false)
  const limit = options.windowSize ?? 600
  const windowFull = computed(() => items.value.length >= limit && (!noMoreContent.value || pending.value.length > 0))
  const generation = requestGeneration()
  let active = true
  let identity = options.cacheIdentity?.()
  let refreshPending = false

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
    if (options.snapshot && loadFailed.value)
      return refreshSnapshot(false)
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
    catch (error) {
      if (current()) {
        loadFailed.value = true
        console.error('[BewlyBewly] Could not load feed', error)
      }
    }
    finally {
      if (current()) {
        isLoading.value = false
        options.afterLoading()
      }
    }
  }

  function replace(page: FeedPage<T>, clearState = true) {
    items.value = []
    pending.value = []
    if (clearState)
      cardState.clear()
    needToLoginFirst.value = !!page.unauthorized
    noMoreContent.value = page.done || !!page.unauthorized
    append(page.unauthorized ? [] : page.items)
  }

  async function refreshSnapshot(restore: boolean) {
    if (!active || isLoading.value)
      return
    const token = generation.capture()
    const account = identity
    const current = () => active && generation.isCurrent(token) && account === options.cacheIdentity?.()
    isLoading.value = true
    loadFailed.value = false
    refreshPending = true
    options.beforeLoading()
    try {
      if (restore) {
        const snapshot = await options.snapshot!.read().catch(() => undefined)
        if (!current())
          return
        if (snapshot) {
          replace(snapshot.page)
          showingSnapshot.value = true
          if (!snapshot.stale) {
            refreshPending = false
            return
          }
        }
      }
      const result = await options.loadPage(current, (partial) => {
        // 有完整旧缓存时避免被部分数据替换；冷启动则立即展示已返回的批次。
        if (current() && !showingSnapshot.value)
          replace(partial, false)
      })
      if (!current())
        return
      replace(result, showingSnapshot.value)
      showingSnapshot.value = false
      refreshPending = false
      const persist = result.unauthorized ? options.snapshot!.remove() : options.snapshot!.write(result)
      void persist.catch(error => console.error('[BewlyBewly] Could not persist feed snapshot', error))
    }
    catch (error) {
      if (current()) {
        loadFailed.value = true
        refreshPending = false
        console.error('[BewlyBewly] Could not refresh feed snapshot', error)
      }
    }
    finally {
      if (active && generation.isCurrent(token)) {
        isLoading.value = false
        options.afterLoading()
      }
    }
  }

  async function resetFeed(restoreSnapshot = false) {
    identity = options.cacheIdentity?.()
    generation.invalidate()
    isLoading.value = false
    items.value = []
    pending.value = []
    noMoreContent.value = false
    needToLoginFirst.value = false
    loadFailed.value = false
    showingSnapshot.value = false
    refreshPending = false
    cardState.clear()
    options.resetCursor()
    if (options.snapshot)
      await refreshSnapshot(restoreSnapshot)
    else
      await load()
  }

  async function reset() {
    await resetFeed()
  }

  async function continueWindow() {
    if (options.snapshot && isLoading.value)
      return
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
    void resetFeed(true)
  })
  onActivated(() => {
    active = true
    bindActions()
    if (identity !== options.cacheIdentity?.()) {
      void resetFeed(true)
    }
    else if (options.snapshot && refreshPending && !isLoading.value) {
      options.resetCursor()
      void refreshSnapshot(!items.value.length)
    }
    else if (!items.value.length && !loadFailed.value) {
      void load()
    }
  })
  onDeactivated(stop)
  onBeforeUnmount(stop)

  return { items, isLoading, noMoreContent, needToLoginFirst, loadFailed, showingSnapshot, windowFull, load, reset, continueWindow }
}
