<script setup lang="ts">
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import type { GridLayoutType } from '~/logic'
import { settings } from '~/logic'
import api from '~/utils/api'
import { getUserID } from '~/utils/main'
import { createSubscribedSeriesLoader } from '~/utils/subscribedSeries'
import { createSubscribedSeriesCache } from '~/utils/subscribedSeriesCache'

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
  showingSnapshot,
  load: getData,
  reset: initData,
  continueWindow,
} = useWindowedFeed({
  key: video => video.uniqueId,
  resetCursor: loader.reset,
  cacheIdentity: getUserID,
  snapshot: createSubscribedSeriesCache(getUserID),
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
      :key="settings.seriesStyle"
      :items="videoList"
      :item-key="(video) => video.uniqueId"
      :layout="props.gridLayout"
      :max-columns="settings.seriesStyle === 'poster' ? 3 : 4"
      :column-offset="settings.seriesStyle === 'poster' ? 1 : 0"
    >
      <template #default="{ item: video, index }">
        <SubscribedSeriesCard
          :cover-loading="index < 10 ? 'eager' : 'lazy'"
          :video="video.video"
          :poster-cover="video.posterCover"
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
    <Loading v-if="isLoading && !showingSnapshot" />
    <p v-if="isLoading" text-center>
      {{ $t('common.loaded_items', { count: loadedCount }) }}
    </p>
    <Button v-if="windowFull" :disabled="isLoading" class="my-4" @click="continueWindow">
      {{ $t('common.continue_browsing') }}
    </Button>
    <Button v-if="loadFailed" class="my-4" @click="getData">
      {{ $t('common.retry') }}
    </Button>
  </div>
</template>
