<script setup lang="ts">
import type { Author } from '~/components/VideoCard/types'
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import { settings } from '~/logic'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import type { DataItem as MomentItem, MomentResult } from '~/models/moment/moment'
import api from '~/utils/api'

interface VideoElement {
  uniqueId: string
  bvid?: string
  item?: MomentItem
  liveItem?: FollowingLiveItem
  authorList?: Author[]
}
const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{ (e: 'beforeLoading'): void, (e: 'afterLoading'): void }>()
let offset = ''
let updateBaseline = ''
let livePage = 1
let liveFinished = false
const { items: videoList, isLoading, noMoreContent, needToLoginFirst, windowFull, loadFailed, load: getData, reset: initData, continueWindow } = useWindowedFeed<VideoElement>({
  key: video => video.uniqueId,
  minPages: 3,
  resetCursor: () => {
    offset = ''
    updateBaseline = ''
    livePage = 1
    liveFinished = !settings.value.followingTabShowLivestreamingVideos
  },
  beforeLoading: () => emit('beforeLoading'),
  afterLoading: () => emit('afterLoading'),
  merge: (previous, next) => {
    if (!previous.bvid || previous.bvid !== next.bvid)
      return
    const authors = [...(previous.authorList || [])]
    for (const author of next.authorList || []) {
      if (!authors.some(existing => existing.mid === author.mid))
        authors.push(author)
    }
    return { ...previous, authorList: authors }
  },
  loadPage: async (current) => {
    // Followed livestreams are a finite prefix, with their own independent cursor.
    if (!liveFinished) {
      const response: FollowingLiveResult = await api.live.getFollowingLiveList({ page: livePage, page_size: 9 })
      if (!current())
        return { items: [], done: true }
      if (response.code === -101)
        return { items: [], done: true, unauthorized: true }
      if (response.code !== 0)
        throw new Error(response.message)
      livePage++
      const raw = response.data.list
      liveFinished = raw.length < 9 || raw.some(item => item.live_status !== 1)
      const items = raw.filter(item => item.live_status === 1)
        .map(item => ({ uniqueId: `live-${item.roomid}`, liveItem: item }))
      if (items.length)
        return { items, done: false }
      liveFinished = true
    }
    const response: MomentResult = await api.moment.getMoments({ type: 'video', offset: Number(offset), update_baseline: updateBaseline })
    if (!current())
      return { items: [], done: true }
    if (response.code === -101)
      return { items: [], done: true, unauthorized: true }
    if (response.code !== 0)
      throw new Error(response.message)
    const previousOffset = offset
    offset = response.data.offset
    updateBaseline = response.data.update_baseline
    const items = response.data.items
    return {
      items: items.map((item) => {
        const author = item.modules.module_author
        return {
          uniqueId: `moment-${item.id_str}`,
          bvid: item.modules.module_dynamic.major.archive?.bvid,
          item,
          authorList: [{ name: author.name, authorFace: author.face, mid: author.mid }],
        }
      }),
      done: !response.data.has_more || offset === '0' || offset === previousOffset || !items.length,
    }
  },
})
watch(() => settings.value.followingTabShowLivestreamingVideos, () => {
  void initData()
})
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
    <VirtualFeed v-else :items="videoList" :item-key="video => video.uniqueId" :layout="props.gridLayout">
      <template #default="{ item: video, index }">
        <VideoCard
          v-if="video.liveItem"
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :skeleton="!video.liveItem"
          :video="video.liveItem ? {
            // id: Number(video.liveItem.modules.module_dynamic.major.archive?.aid),
            title: `${video.liveItem.title}`,
            cover: `${video.liveItem.room_cover}`,
            author: {
              name: video.liveItem.uname,
              authorFace: video.liveItem.face,
              mid: video.liveItem.uid,
            },
            viewStr: video.liveItem.text_small,
            tag: video.liveItem.area_name_v2,
            roomid: video.liveItem.roomid,
            liveStatus: video.liveItem.live_status,
          } : undefined"
          type="live"
          :show-watcher-later="false"
          :horizontal="gridLayout !== 'adaptive'"
        />

        <VideoCard
          v-else
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :skeleton="!video.item"
          :video="video.item ? {
            id: Number(video.item.modules.module_dynamic.major.archive?.aid),
            durationStr: video.item.modules.module_dynamic.major.archive?.duration_text,
            title: `${video.item.modules.module_dynamic.major.archive?.title}`,
            cover: `${video.item.modules.module_dynamic.major.archive?.cover}`,
            author: video.authorList,
            viewStr: video.item.modules.module_dynamic.major.archive?.stat.play,
            danmakuStr: video.item.modules.module_dynamic.major.archive?.stat.danmaku,
            capsuleText: video.item.modules.module_author.pub_time,
            bvid: video.item.modules.module_dynamic.major.archive?.bvid,
            badge: video.item.modules.module_dynamic.major.archive?.badge.text !== '投稿视频' ? {
              bgColor: video.item.modules.module_dynamic.major.archive?.badge.bg_color,
              color: video.item.modules.module_dynamic.major.archive?.badge.color,
              iconUrl: video.item.modules.module_dynamic.major.archive?.badge.icon_url,
              text: video.item.modules.module_dynamic.major.archive?.badge.text,
            } : undefined,
          } : undefined"
          show-preview
          :horizontal="gridLayout !== 'adaptive'"
        />
      </template>
    </VirtualFeed>

    <!-- no more content -->
    <Empty v-if="noMoreContent && !windowFull && !needToLoginFirst" class="pb-4" :description="$t('common.no_more_content')" />
    <Loading v-if="isLoading" />
    <Button v-if="windowFull" class="my-4" @click="continueWindow">
      {{ $t('common.continue_browsing') }}
    </Button>
    <Button v-else-if="loadFailed" class="my-4" @click="getData">
      {{ $t('common.retry') }}
    </Button>
  </div>
</template>
