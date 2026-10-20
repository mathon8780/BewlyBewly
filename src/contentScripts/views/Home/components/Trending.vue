<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import type { List as VideoItem, TrendingResult } from '~/models/video/trending'
import api from '~/utils/api'

interface VideoElement { uniqueId: string, item: VideoItem }
const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{ (e: 'beforeLoading'): void, (e: 'afterLoading'): void }>()
let page = 1
const { items: videoList, isLoading, windowFull, loadFailed, load: getData, reset: initData, continueWindow } = useWindowedFeed<VideoElement>({
  key: video => video.uniqueId,
  resetCursor: () => { page = 1 },
  beforeLoading: () => emit('beforeLoading'),
  afterLoading: () => emit('afterLoading'),
  loadPage: async (current) => {
    const response: TrendingResult = await api.video.getPopularVideos({ pn: page, ps: 30 })
    if (!current())
      return { items: [], done: true }
    if (response.code !== 0)
      throw new Error(response.message)
    page++
    const items = response.data.list
    return { items: items.map(item => ({ uniqueId: String(item.aid), item })), done: response.data.no_more || !items.length }
  },
})
defineExpose({ initData })
</script>

<template>
  <div>
    <VirtualFeed :items="videoList" :item-key="video => video.uniqueId" :layout="props.gridLayout">
      <template #default="{ item: video, index }">
        <VideoCard
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :skeleton="!video.item"
          :video="video.item ? {
            id: Number(video.item.aid),
            duration: video.item.duration,
            title: video.item.title,
            desc: video.item.desc,
            cover: video.item.pic,
            author: {
              name: video.item.owner.name,
              authorFace: video.item.owner.face,
              mid: video.item.owner.mid,
            },
            view: video.item.stat.view,
            danmaku: video.item.stat.danmaku,
            publishedTimestamp: video.item.pubdate,
            bvid: video.item.bvid,
            tag: video.item.rcmd_reason.content,
            cid: video.item.cid,
          } : undefined"
          show-preview
          :horizontal="gridLayout !== 'adaptive'"
        />
      </template>
    </VirtualFeed>
    <Loading v-if="isLoading" />
    <Button v-if="windowFull" class="my-4" @click="continueWindow">
      {{ $t('common.continue_browsing') }}
    </Button>
    <Button v-else-if="loadFailed" class="my-4" @click="getData">
      {{ $t('common.retry') }}
    </Button>
  </div>
</template>
