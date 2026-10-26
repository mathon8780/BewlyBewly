import type { Video } from '~/components/VideoCard/types'
import type { List, WatchListResult } from '~/models/anime/watchList'

interface WatchListParams {
  vmid: string
  type: number
  pn: number
  ps: number
  follow_status: number
}

export function createSubscribedSeriesLoader(
  request: (params: WatchListParams) => Promise<WatchListResult>,
  userId: () => string | undefined,
  onProgress: (count: number) => void = () => {},
) {
  const makeState = () => ({ pages: [1, 1], complete: [false, false], series: new Map<number, List>() })
  let state = makeState()
  return {
    reset() {
      state = makeState()
      onProgress(0)
    },
    async load(current: () => boolean) {
      const vmid = userId()
      if (!vmid)
        return { items: [], done: true, unauthorized: true }
      const owner = state
      const { series } = owner
      let unauthorized = false
      let failed = false
      const results = await Promise.allSettled(
        [1, 2].map(async (type) => {
          let lastPage = ''
          try {
            const index = type - 1
            while (!owner.complete[index]) {
              if (failed || !current() || owner !== state)
                return
              const page = owner.pages[index]
              const response = await request({ vmid, type, pn: page, ps: 30, follow_status: 0 })
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
              for (const item of list || []) series.set(item.season_id, item)
              onProgress(series.size)
              owner.complete[index] = !list?.length || page * (ps || 30) >= total
              if (!owner.complete[index] && signature === lastPage)
                throw new Error('Subscription pagination made no progress')
              lastPage = signature
              owner.pages[index]++
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
      // 两类订阅全部加载后统一排序，避免后续分页中的新剧排在旧剧后面。
      const items = [...series.values()]
        .sort((a, b) => premiereTimestamp(b) - premiereTimestamp(a))
        .map(item => ({
          uniqueId: String(item.season_id),
          airDate: seriesAirDate(item.publish?.pub_time),
          totalEpisodes: item.total_count || 0,
          releasedEpisodes: item.formal_ep_count || 0,
          video: {
            id: item.season_id,
            title: item.title,
            cover: item.horizontal_cover_16_9 || item.cover,
            url: item.url || `https://www.bilibili.com/bangumi/play/ss${item.season_id}`,
            view: item.stat?.view,
            danmaku: item.stat?.danmaku,
            desc: item.progress,
            threePointV2: [],
          } satisfies Video,
        }))
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
