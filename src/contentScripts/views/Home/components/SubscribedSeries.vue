<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import api from '~/utils/api'
import { getUserID } from '~/utils/main'
import { createSubscribedSeriesLoader } from '~/utils/subscribedSeries'

import SubscribedSeriesCard from './SubscribedSeriesCard.vue'

const props = defineProps<{ gridLayout: GridLayoutType }>()
const emit = defineEmits<{ (e: 'beforeLoading'): void, (e: 'afterLoading'): void }>()
const loadedCount = ref(0)
const loader = createSubscribedSeriesLoader(
  api.anime.getAnimeWatchList,
  getUserID,
  count => (loadedCount.value = count),
)
const {
  items: videoList,
  isLoading,
  noMoreContent,
  needToLoginFirst,
  windowFull,
  loadFailed,
  load: getData,
  reset: initData,
  continueWindow,
} = useWindowedFeed({
  key: video => video.uniqueId,
  minPages: 3,
  resetCursor: loader.reset,
  beforeLoading: () => emit('beforeLoading'),
  afterLoading: () => emit('afterLoading'),
  loadPage: loader.load,
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
    <Empty
      v-else-if="videoList.length === 0 && !isLoading && !loadFailed"
      mt-6
      :description="$t('common.no_more_content')"
    >
      <Button type="primary" @click="initData()">
        {{ $t('common.operation.refresh') }}
      </Button>
    </Empty>
    <VirtualFeed
      v-else
      :items="videoList"
      :item-key="(video) => video.uniqueId"
      :layout="props.gridLayout"
      :max-columns="4"
    >
      <template #default="{ item: video, index }">
        <SubscribedSeriesCard
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :video="video.video"
          :air-date="video.airDate"
          :total-episodes="video.totalEpisodes"
          :released-episodes="video.releasedEpisodes"
        />
      </template>
    </VirtualFeed>

    <!-- no more content -->
    <Empty
      v-if="videoList.length && noMoreContent && !windowFull && !needToLoginFirst"
      class="pb-4"
      :description="$t('common.no_more_content')"
    />
    <Loading v-if="isLoading" />
    <p v-if="isLoading" text-center>
      {{ $t('common.loaded_items', { count: loadedCount }) }}
    </p>
    <Button v-if="windowFull" class="my-4" @click="continueWindow">
      {{ $t('common.continue_browsing') }}
    </Button>
    <Button v-else-if="loadFailed" class="my-4" @click="getData">
      {{ $t('common.retry') }}
    </Button>
  </div>
</template>
