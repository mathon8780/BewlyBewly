<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import api from '~/utils/api'

interface VideoElement { uniqueId: string, item: FollowingLiveItem }
const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{ (e: 'beforeLoading'): void, (e: 'afterLoading'): void }>()
let page = 1
const { items: videoList, isLoading, noMoreContent, needToLoginFirst, windowFull, loadFailed, load: getData, reset: initData, continueWindow } = useWindowedFeed<VideoElement>({
  key: video => video.uniqueId,
  minPages: 3,
  resetCursor: () => { page = 1 },
  beforeLoading: () => emit('beforeLoading'),
  afterLoading: () => emit('afterLoading'),
  loadPage: async (current) => {
    const response: FollowingLiveResult = await api.live.getFollowingLiveList({ page, page_size: 9 })
    if (!current())
      return { items: [], done: true }
    if (response.code === -101)
      return { items: [], done: true, unauthorized: true }
    if (response.code !== 0)
      throw new Error(response.message)
    page++
    const items = response.data.list
    return { items: items.map(item => ({ uniqueId: String(item.roomid), item })), done: items.length < 9 }
  },
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
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :skeleton="!video.item"
          :video="video.item ? {
            // id: Number(video.item.modules.module_dynamic.major.archive?.aid),
            title: `${video.item.title}`,
            cover: `${video.item.room_cover}`,
            author: {
              name: video.item.uname,
              authorFace: video.item.face,
              mid: video.item.uid,
            },
            viewStr: video.item.text_small,
            tag: video.item.area_name_v2,
            roomid: video.item.roomid,
            liveStatus: video.item.live_status,
          } : undefined"
          type="live"
          :show-watcher-later="false"
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
