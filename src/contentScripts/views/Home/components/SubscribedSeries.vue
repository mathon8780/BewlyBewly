<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import type { DataItem as MomentItem, MomentResult } from '~/models/moment/moment'
import api from '~/utils/api'

interface VideoElement { uniqueId: string, item: MomentItem }
const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{ (e: 'beforeLoading'): void, (e: 'afterLoading'): void }>()
let offset = ''
let updateBaseline = ''
const { items: videoList, isLoading, noMoreContent, needToLoginFirst, windowFull, loadFailed, load: getData, reset: initData, continueWindow } = useWindowedFeed<VideoElement>({
  key: video => video.uniqueId,
  minPages: 3,
  resetCursor: () => {
    offset = ''
    updateBaseline = ''
  },
  beforeLoading: () => emit('beforeLoading'),
  afterLoading: () => emit('afterLoading'),
  loadPage: async (current) => {
    const response: MomentResult = await api.moment.getMoments({ type: 'pgc', offset, update_baseline: updateBaseline })
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
      items: items.map(item => ({ uniqueId: item.id_str, item })),
      done: !response.data.has_more || offset === '0' || offset === previousOffset || !items.length,
    }
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
    <Empty v-if="videoList.length === 0 && !needToLoginFirst && !isLoading && !loadFailed" mt-6 :description="$t('common.no_more_content')">
      <Button type="primary" @click="initData()">
        {{ $t('common.operation.refresh') }}
      </Button>
    </Empty>
    <VirtualFeed v-else :items="videoList" :item-key="video => video.uniqueId" :layout="props.gridLayout">
      <template #default="{ item: video, index }">
        <VideoCard
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :skeleton="!video.item"
          type="bangumi"
          :video="video.item ? {
            id: video.item.modules.module_author.mid,
            title: `${video.item.modules.module_dynamic.major.pgc?.title}`,
            cover: `${video.item.modules.module_dynamic.major.pgc?.cover}`,
            author: {
              name: video.item.modules.module_author.name,
              authorUrl: video.item.modules.module_author.jump_url,
              authorFace: video.item.modules.module_author.face,
              mid: video.item.modules.module_author.mid,
            },
            viewStr: video.item.modules.module_dynamic.major.pgc?.stat.play,
            danmakuStr: video.item.modules.module_dynamic.major.pgc?.stat.danmaku,
            capsuleText: video.item.modules.module_author.pub_time,
            epid: video.item.modules.module_dynamic.major.pgc?.epid,
          } : undefined"
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
