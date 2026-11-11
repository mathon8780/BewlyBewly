import type { Video } from '~/components/VideoCard/types'
import type { FeedPage } from '~/composables/useWindowedFeed'
import type { List, WatchListResult } from '~/models/anime/watchList'

interface WatchListParams {
  vmid: string
  type: number
  pn: number
  ps: number
  follow_status: number
}

export interface SubscribedSeriesItem {
  uniqueId: string
  airDate: string
  totalEpisodes: number
  releasedEpisodes: number
  posterCover: string
  video: Video
}

const PAGE_SIZE = 20

function sortedItems(series: Map<number, List>): SubscribedSeriesItem[] {
  return [...series.values()]
    .sort((a, b) => premiereTimestamp(b) - premiereTimestamp(a))
    .map(item => ({
      uniqueId: String(item.season_id),
      airDate: seriesAirDate(item.publish?.pub_time),
      totalEpisodes: item.total_count || 0,
      releasedEpisodes: item.formal_ep_count || 0,
      posterCover: item.cover,
      video: {
        id: item.season_id,
        title: item.title,
        cover: item.horizontal_cover_16_9 || item.cover,
        url: item.url || `https://www.bilibili.com/bangumi/play/ss${item.season_id}`,
        view: item.stat?.view,
        danmaku: item.stat?.danmaku,
        desc: item.progress,
        threePointV2: [],
      },
    }))
}

export function createSubscribedSeriesLoader(
  request: (params: WatchListParams) => Promise<WatchListResult>,
  userId: () => string | undefined,
  onProgress: (count: number) => void = () => {},
) {
  const makeState = () => ({ pages: [1, 1], complete: [false, false], signatures: ['', ''], series: new Map<number, List>() })
  let state = makeState()
  return {
    reset() {
      state = makeState()
      onProgress(0)
    },
    async load(current: () => boolean, publish: (page: FeedPage<SubscribedSeriesItem>) => void = () => {}) {
      const vmid = userId()
      if (!vmid)
        return { items: [], done: true, unauthorized: true }
      const owner = state
      const { series } = owner
      let unauthorized = false
      let failed = false
      const results = await Promise.allSettled(
        [1, 2].map(async (type) => {
          try {
            const index = type - 1
            while (!owner.complete[index]) {
              if (failed || unauthorized || !current() || owner !== state)
                return
              const page = owner.pages[index]
              const response = await request({ vmid, type, pn: page, ps: PAGE_SIZE, follow_status: 0 })
              if (!current() || owner !== state)
                return
              if (response.code === -101) {
                unauthorized = true
                return
              }
              if (response.code !== 0)
                throw new Error(response.message)
              const { list, total, ps } = response.data
              const signature = (list || []).map(item => item.season_id).join(',')
              const done = !list?.length || page * (ps || PAGE_SIZE) >= total
              if (!done && signature === owner.signatures[index])
                throw new Error('Subscription pagination made no progress')
              for (const item of list || []) series.set(item.season_id, item)
              onProgress(series.size)
              owner.complete[index] = done
              owner.signatures[index] = signature
              owner.pages[index]++
              // 首次无缓存时逐页显示；完整结果仍在末尾返回，供统一排序与持久化。
              if (!unauthorized)
                publish({ items: sortedItems(series), done: false })
            }
          }
          catch (error) {
            failed = true
            throw error
          }
        }),
      )
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected')
        throw failure.reason
      if (!current() || owner !== state)
        return { items: [], done: true }
      if (unauthorized)
        return { items: [], done: true, unauthorized: true }
      const items = sortedItems(series)
      series.clear()
      return { items, done: true }
    },
  }
}

function premiereTimestamp(item: List): number {
  for (const value of [item.publish?.release_date, item.publish?.pub_time]) {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(value || '')
    if (Number.isFinite(timestamp) && timestamp > 0)
      return timestamp
  }
  return 0
}

// 开播日期仅取剧集自身的发布时间，不使用最新一集或动态的日期。
export function seriesAirDate(value: string | Date | undefined): string {
  if (!value || (value instanceof Date && !Number.isFinite(value.getTime())))
    return ''
  const text = value instanceof Date ? value.toISOString() : value
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(text)
  return match && Number.isFinite(Date.parse(text)) ? match[1] : ''
}
