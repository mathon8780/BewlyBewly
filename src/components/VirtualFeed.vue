<script setup lang="ts" generic="T">
import { useBewlyApp } from '~/composables/useAppProvider'
import type { VideoCardStates } from '~/composables/useVideoCardState'

import VirtualFeedItem from './VirtualFeedItem.vue'

const props = withDefaults(defineProps<{
  items: T[]
  itemKey: (item: T) => string | number
  layout?: 'adaptive' | 'twoColumns' | 'oneColumn'
  columnOffset?: number
}>(), { layout: 'oneColumn', columnOffset: 0 })

const { scrollbarRef } = useBewlyApp()
const root = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const width = ref(window.innerWidth)
const scrollTop = ref(0)
const viewHeight = ref(window.innerHeight)
const heights = shallowRef<Record<number, number>>({})
// State follows retained data keys, including rows currently outside the DOM.
const cardStates = new Map<string | number, VideoCardStates>()
function getCardStates(item: T) {
  const key = props.itemKey(item)
  let state = cardStates.get(key)
  if (!state) {
    state = new Map()
    cardStates.set(key, state)
  }
  return state
}
watch(() => props.items, (items) => {
  const retained = new Set(items.map(props.itemKey))
  for (const key of cardStates.keys()) {
    if (!retained.has(key))
      cardStates.delete(key)
  }
})
const columns = computed(() => props.layout === 'adaptive'
  ? Math.max(1, (width.value >= 1536 ? 5 : width.value >= 1280 ? 4 : width.value >= 1024 ? 3 : width.value >= 768 ? 2 : 1) - props.columnOffset)
  : props.layout === 'twoColumns' && width.value >= 1280 ? 2 : 1)
const rows = computed(() => Array.from({ length: Math.ceil(props.items.length / columns.value) }, (_, index) => ({
  index,
  items: props.items.slice(index * columns.value, (index + 1) * columns.value),
})))
// Measured rows preserve different card heights; unvisited rows use the measured mean.
const estimate = computed(() => {
  const values = Object.values(heights.value)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 340
})
const offsets = computed(() => {
  const result = [0]
  for (let index = 0; index < rows.value.length; index++)
    result.push(result[index] + (heights.value[index] ?? estimate.value))
  return result
})
const range = computed(() => {
  let start = 0
  while (start < rows.value.length && offsets.value[start + 1] < scrollTop.value - 700)
    start++
  let end = start
  while (end < rows.value.length && offsets.value[end] < scrollTop.value + viewHeight.value + 700)
    end++
  return { start, end: Math.max(end, Math.min(start + 3, rows.value.length)) }
})
const visibleRows = computed(() => rows.value.slice(range.value.start, range.value.end))
let observer: ResizeObserver | undefined
let frame = 0
let active = false
let measuredWidth = 0
let viewportAttempts = 0

function updateScroll() {
  width.value = window.innerWidth
  if (!viewport.value) {
    viewport.value = scrollbarRef.value?.osInstance()?.elements().viewport
    viewport.value?.addEventListener('scroll', scheduleUpdate, { passive: true })
  }
  if (!root.value || !viewport.value) {
    // OverlayScrollbars can defer initialization until idle. Retry briefly, then rely on resize/activation.
    if (active && viewportAttempts++ < 180)
      scheduleUpdate()
    return
  }
  const bounds = viewport.value.getBoundingClientRect()
  scrollTop.value = Math.max(0, bounds.top - root.value.getBoundingClientRect().top)
  viewHeight.value = viewport.value.clientHeight
}

function scheduleUpdate() {
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0
      updateScroll()
    })
  }
}

function observeRows() {
  observer?.disconnect()
  if (root.value)
    observer?.observe(root.value)
  root.value?.querySelectorAll<HTMLElement>('[data-feed-row]').forEach(element => observer?.observe(element))
}

function start() {
  if (active)
    return
  active = true
  viewportAttempts = 0
  viewport.value = scrollbarRef.value?.osInstance()?.elements().viewport
  viewport.value?.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  observer = new ResizeObserver((entries) => {
    const container = entries.find(entry => entry.target === root.value)
    if (container && Math.abs(container.contentRect.width - measuredWidth) > 0.5) {
      measuredWidth = container.contentRect.width
      heights.value = {}
      scheduleUpdate()
      return
    }
    const next = { ...heights.value }
    let changed = false
    for (const entry of entries) {
      if (entry.target === root.value) {
        scheduleUpdate()
        continue
      }
      const index = Number((entry.target as HTMLElement).dataset.feedRow)
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      if (Math.abs((next[index] ?? 0) - height) > 0.5) {
        next[index] = height
        changed = true
      }
    }
    if (changed)
      heights.value = next
  })
  observeRows()
  updateScroll()
}

function stop() {
  active = false
  viewport.value?.removeEventListener('scroll', scheduleUpdate)
  window.removeEventListener('resize', scheduleUpdate)
  observer?.disconnect()
  observer = undefined
  cancelAnimationFrame(frame)
  frame = 0
}

watch(columns, () => {
  heights.value = {}
})
watch(() => props.layout, () => {
  heights.value = {}
})
watch(() => props.items[0], () => {
  heights.value = {}
})
watch(visibleRows, () => nextTick(observeRows))
onMounted(start)
onActivated(start)
onDeactivated(stop)
onBeforeUnmount(stop)
</script>

<template>
  <div ref="root">
    <div aria-hidden="true" :style="{ height: `${offsets[range.start]}px` }" />
    <div
      v-for="row in visibleRows" :key="row.index"
      :data-feed-row="row.index"
      :style="{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '20px', paddingBottom: '20px' }"
    >
      <VirtualFeedItem v-for="(item, index) in row.items" :key="itemKey(item)" :states="getCardStates(item)">
        <slot :item="item" :index="row.index * columns + index" />
      </VirtualFeedItem>
    </div>
    <div aria-hidden="true" :style="{ height: `${offsets[offsets.length - 1] - offsets[range.end]}px` }" />
  </div>
</template>
