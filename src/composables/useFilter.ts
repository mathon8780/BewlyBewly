import { settings } from '~/logic'
import { compileFilterKeywords } from '~/utils/filterRules'
import { isVerticalVideo } from '~/utils/uriParse'

const get = (obj: any, path: string[]) => path.reduce((acc, part) => acc && acc[part], obj)

export enum FilterType {
  filterOutVerticalVideos,
  viewCount,
  viewCountStr,
  duration,
  title,
  user,
}

// Compile once per settings revision, shared by all mounted lists.
const titleRules = computed(() => compileFilterKeywords(settings.value.filterByTitle))
const userRules = computed(() => compileFilterKeywords(settings.value.filterByUser))

export function useFilter(isFollowedKeyPath: string[], filterOpt: FilterType[], keyList: string[][]) {
  return computed<((item: any) => boolean) | null>(() => {
    const current = settings.value
    const title = titleRules.value
    const user = userRules.value
    const rules: Array<(item: any) => boolean> = []

    filterOpt.forEach((type, index) => {
      const path = keyList[index]
      switch (type) {
        case FilterType.filterOutVerticalVideos:
          if (current.filterOutVerticalVideos)
            rules.push(item => !isVerticalVideo(get(item, path)))
          break
        case FilterType.viewCount:
          if (current.enableFilterByViewCount) {
            const minimum = current.filterByViewCount
            rules.push(item => get(item, path) > minimum)
          }
          break
        case FilterType.viewCountStr:
          if (current.enableFilterByViewCount) {
            const minimum = current.filterByViewCount
            rules.push((item) => {
              const value = get(item, path)
              const numeric = typeof value === 'string' && /[万萬]/.test(value)
                ? Number(value.replace(/[万萬]/g, '')) * 10000
                : Number(value)
              return !Number.isNaN(numeric) && numeric > minimum
            })
          }
          break
        case FilterType.duration:
          if (current.enableFilterByDuration) {
            const minimum = current.filterByDuration
            rules.push(item => get(item, path) > minimum)
          }
          break
        case FilterType.title:
          if (current.enableFilterByTitle) {
            rules.push((item) => {
              const value = String(get(item, path))
              const normalized = value.toUpperCase()
              return !title.fragments.some(keyword => normalized.includes(keyword))
                && !title.patterns.some(pattern => pattern.test(value))
            })
          }
          break
        case FilterType.user:
          if (current.enableFilterByUser) {
            rules.push((item) => {
              const value = String(get(item, path))
              return !user.exact.has(value.toUpperCase()) && !user.patterns.some(pattern => pattern.test(value))
            })
          }
          break
      }
    })

    if (!rules.length)
      return null
    const exemptFollowed = current.disableFilterForFollowedUser
    const mode = current.recommendationMode
    return (item) => {
      if (exemptFollowed) {
        const followed = get(item, isFollowedKeyPath)
        if (mode === 'web' ? !!followed : followed === '已关注' || followed === '已關注')
          return true
      }
      return rules.every(rule => rule(item))
    }
  })
}
