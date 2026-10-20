<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { FilterType, useFilter } from '~/composables/useFilter'
import { provideVideoCardState } from '~/composables/useVideoCardState'
import { LanguageType } from '~/enums/appEnums'
import type { GridLayoutType } from '~/logic'
import { accessKey, settings, settingsReady } from '~/logic'
import type { Item as AppVideoItem } from '~/models/video/appForYou'
import type { Item as VideoItem } from '~/models/video/forYou'
import api from '~/utils/api'
import { TVAppKey } from '~/utils/authProvider'
import { boundedBackfill, requestGeneration } from '~/utils/boundedPagination'
import { isVerticalVideo } from '~/utils/uriParse'

const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const filterFunc = useFilter(
  ['is_followed'],
  [FilterType.duration, FilterType.viewCount, FilterType.title, FilterType.user, FilterType.user],
  [['duration'], ['stat', 'view'], ['title'], ['owner', 'name'], ['owner', 'mid']],
)
const appFilterFunc = useFilter(
  ['bottom_rcmd_reason'],
  [FilterType.filterOutVerticalVideos, FilterType.duration, FilterType.viewCountStr, FilterType.title, FilterType.user, FilterType.user],
  [['uri'], ['player_args', 'duration'], ['cover_left_text_1'], ['title'], ['mask', 'avatar', 'text'], ['mask', 'avatar', 'up_id']],
)

interface VideoElement { uniqueId: string, item: VideoItem }
interface AppVideoElement { uniqueId: string, item: AppVideoItem }
const videoList = shallowRef<VideoElement[]>([])
const appVideoList = shallowRef<AppVideoElement[]>([])
const isLoading = ref(false)
const needToLoginFirst = ref(false)
const noMoreContent = ref(false)
const windowFull = ref(false)
const loadFailed = ref(false)
const { handleReachBottom, handlePageRefresh, haveScrollbar, handleBackToTop } = useBewlyApp()
const generation = requestGeneration()
const cardStates = provideVideoCardState()
const PAGE_SIZE = 30
const WINDOW_SIZE = 600
let refreshIdx = 1
let appCursor: number | undefined = 1
let active = true
let initialized = false
let hydrated = false
let pendingWeb: VideoElement[] = []
let pendingApp: AppVideoElement[] = []
const count = () => settings.value.recommendationMode === 'web' ? videoList.value.length : appVideoList.value.length

watch(() => settings.value.recommendationMode, () => {
  if (initialized)
    void initData()
})

onMounted(async () => {
  initPageAction()
  await settingsReady
  hydrated = true
  if (active && !initialized) {
    initialized = true
    await initData()
  }
})
onActivated(() => {
  active = true
  initPageAction()
  if (hydrated && !initialized) {
    initialized = true
    void initData()
  }
  // A deactivated in-flight load was invalidated and may safely be retried.
  if (initialized && !count())
    void getData()
})
onDeactivated(stop)
onBeforeUnmount(stop)

function stop() {
  active = false
  generation.invalidate()
  isLoading.value = false
  emit('afterLoading')
  if (handleReachBottom.value === loadMore)
    handleReachBottom.value = undefined
  if (handlePageRefresh.value === initData)
    handlePageRefresh.value = undefined
}

async function initData() {
  cardStates.clear()
  generation.invalidate()
  isLoading.value = false
  videoList.value = []
  appVideoList.value = []
  pendingWeb = []
  pendingApp = []
  refreshIdx = 1
  appCursor = 1
  noMoreContent.value = false
  needToLoginFirst.value = false
  windowFull.value = false
  loadFailed.value = false
  await getData()
}

async function getData() {
  if (!hydrated || !active || isLoading.value || noMoreContent.value || windowFull.value || needToLoginFirst.value)
    return
  const token = generation.capture()
  const mode = settings.value.recommendationMode
  const current = () => active && generation.isCurrent(token) && mode === settings.value.recommendationMode
  isLoading.value = true
  loadFailed.value = false
  emit('beforeLoading')
  try {
    await boundedBackfill({
      current,
      loadPage: async () => {
        const result = mode === 'web' ? await getRecommendVideos(current) : await getAppRecommendVideos(current)
        if (current())
          windowFull.value = count() >= WINDOW_SIZE
        return { ...result, done: result.done || windowFull.value }
      },
      needsMore: async () => {
        await nextTick()
        const scrollbar = await haveScrollbar()
        return current() && (count() < PAGE_SIZE || !scrollbar)
      },
    })
  }
  catch {
    if (current())
      loadFailed.value = true
  }
  finally {
    if (current()) {
      isLoading.value = false
      emit('afterLoading')
    }
  }
}

async function loadMore() {
  // Empty/filtered/error cycles require an explicit retry instead of a bottom-event storm.
  if (!loadFailed.value)
    await getData()
}
function initPageAction() {
  handleReachBottom.value = loadMore
  handlePageRefresh.value = initData
}

async function getRecommendVideos(current: () => boolean) {
  const response = await api.video.getRecommendVideos({ fresh_idx: refreshIdx, ps: PAGE_SIZE })
  if (!current())
    return { added: 0, done: true }
  if (response.code === 62011) {
    needToLoginFirst.value = true
    return { added: 0, done: true }
  }
  if (response.code !== 0)
    throw new Error(response.message)
  refreshIdx++
  const items = response.data?.item ?? []
  if (!items.length) {
    noMoreContent.value = true
    return { added: 0, done: true }
  }
  const existing = new Set(videoList.value.map(video => video.uniqueId))
  const added = items.filter((item: VideoItem) => {
    const key = String(item.id)
    if (existing.has(key) || (filterFunc.value && !filterFunc.value(item)))
      return false
    existing.add(key)
    return true
  }).map((item: VideoItem) => ({ uniqueId: String(item.id), item }))
  const available = WINDOW_SIZE - videoList.value.length
  pendingWeb = added.slice(available)
  videoList.value = [...videoList.value, ...added.slice(0, available)]
  if (!added.length)
    loadFailed.value = true
  return { added: added.length, done: false }
}

async function getAppRecommendVideos(current: () => boolean) {
  const locale = settings.value.language === LanguageType.Mandarin_TW || settings.value.language === LanguageType.Cantonese ? 'zh-Hant_TW' : 'zh-Hans_CN'
  const response = await api.video.getAppRecommendVideos({
    access_key: accessKey.value,
    s_locale: locale,
    c_locate: locale,
    appkey: TVAppKey.appkey,
    idx: appCursor,
  })
  if (!current())
    return { added: 0, done: true }
  if (response.code === 62011) {
    needToLoginFirst.value = true
    return { added: 0, done: true }
  }
  if (response.code !== 0)
    throw new Error(response.message)
  const items: AppVideoItem[] = response.data?.items ?? []
  if (!items.length) {
    noMoreContent.value = true
    return { added: 0, done: true }
  }
  // Advance using the raw page, including filtered entries, so backfill makes progress.
  appCursor = items[items.length - 1].idx
  const existing = new Set(appVideoList.value.map(video => video.uniqueId))
  const added = items.filter((item) => {
    const key = String(item.idx)
    if (existing.has(key) || item.card_type.includes('banner') || item.card_type === 'cm_v1' || (appFilterFunc.value && !appFilterFunc.value(item)))
      return false
    existing.add(key)
    return true
  }).map(item => ({ uniqueId: String(item.idx), item }))
  const available = WINDOW_SIZE - appVideoList.value.length
  pendingApp = added.slice(available)
  appVideoList.value = [...appVideoList.value, ...added.slice(0, available)]
  if (!added.length)
    loadFailed.value = true
  return { added: added.length, done: false }
}

async function continueWindow() {
  cardStates.clear()
  generation.invalidate()
  videoList.value = pendingWeb
  appVideoList.value = pendingApp
  pendingWeb = []
  pendingApp = []
  windowFull.value = false
  handleBackToTop(settings.value.useSearchPageModeOnHomePage ? 510 : 0)
  await getData()
}
function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
defineExpose({ initData })
</script>

<template>
  <div>
    <Empty v-if="needToLoginFirst" mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>

    <div v-else>
      <VirtualFeed v-if="settings.recommendationMode === 'web'" :items="videoList" :item-key="video => video.uniqueId" :layout="props.gridLayout">
        <template #default="{ item: video, index }">
          <VideoCard
            :cover-loading="index < 10 ? 'eager' : 'lazy'"
            :skeleton="!video.item"
            type="rcmd"
            :video="video.item ? {
              id: video.item.id,
              duration: video.item.duration,
              title: video.item.title,
              cover: video.item.pic,
              author: {
                name: video.item.owner.name,
                authorFace: video.item.owner.face,
                followed: !!video.item.is_followed,
                mid: video.item.owner.mid,
              },
              view: video.item.stat.view,
              danmaku: video.item.stat.danmaku,
              publishedTimestamp: video.item.pubdate,
              bvid: video.item.bvid,
              cid: video.item.cid,
            } : undefined"
            show-preview
            :horizontal="gridLayout !== 'adaptive'"
            more-btn
          />
        </template>
      </VirtualFeed>
      <VirtualFeed v-else :items="appVideoList" :item-key="video => video.uniqueId" :layout="props.gridLayout">
        <template #default="{ item: video, index }">
          <VideoCard
            :cover-loading="index < 10 ? 'eager' : 'lazy'"
            :skeleton="!video.item"
            type="appRcmd"
            :video="video.item ? {
              id: video.item.args.aid ?? 0,
              durationStr: video.item.cover_right_text,
              title: `${video.item.title}`,
              cover: `${video.item.cover}`,
              author: {
                name: video.item?.mask?.avatar.text,
                authorFace: video.item?.mask?.avatar.cover || video.item?.avatar?.cover,
                followed: video.item?.bottom_rcmd_reason === '已关注' || video.item?.bottom_rcmd_reason === '已關注',
                mid: video.item?.mask?.avatar.up_id,
              },
              capsuleText: video.item?.desc?.split('·')[1],
              bvid: video.item.bvid,
              viewStr: video.item.cover_left_text_1,
              danmakuStr: video.item.cover_left_text_2,
              cid: video.item?.player_args?.cid,
              goto: video.item?.goto,
              url: video.item?.goto === 'bangumi' ? video.item.uri : '',
              type: video.item.card_goto === 'bangumi' ? 'bangumi' : isVerticalVideo(video.item.uri!) ? 'vertical' : 'horizontal',
              threePointV2: video.item?.three_point_v2,
            } : undefined"
            show-preview
            :horizontal="gridLayout !== 'adaptive'"
            more-btn
          />
        <!-- :more-options="video.three_point_v2" -->
        </template>
      </VirtualFeed>
    </div>

    <Loading v-show="isLoading" />
    <Button v-if="windowFull" class="my-4" @click="continueWindow">
      {{ $t('common.continue_browsing') }}
    </Button>
    <Button v-else-if="loadFailed" class="my-4" @click="getData">
      {{ $t('common.retry') }}
    </Button>
    <!-- no more content -->
    <Empty v-if="noMoreContent" class="pb-4" :description="$t('common.no_more_content')" />
  </div>
</template>
