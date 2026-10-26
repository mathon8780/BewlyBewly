<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

import Empty from '~/components/Empty.vue'
import Loading from '~/components/Loading.vue'
import { useAsyncTask } from '~/composables/useAsyncTask'
import api from '~/utils/api'
import { calcCurrentTime } from '~/utils/dataFormatter'
import { getUserID, removeHttpFromUrl, scrollToTop } from '~/utils/main'

import type { FavoriteCategory, FavoriteResource } from '../types'

const favoriteCategories = reactive<Array<FavoriteCategory>>([])
const favoriteResources = reactive<Array<FavoriteResource>>([])

const activatedMediaId = ref<number>(0)
const activatedFavoriteTitle = ref<string>()
const currentPageNum = ref<number>(1)

const { isLoading, loadFailed, run } = useAsyncTask()
// when noMoreContent is true, the user can't scroll down to load more content
const noMoreContent = ref<boolean>(false)
const favoriteVideosWrap = ref<HTMLElement>() as Ref<HTMLElement>

const viewAllUrl = computed((): string => {
  return `//space.bilibili.com/${getUserID()}/favlist?fid=${activatedMediaId.value}&ftype=create`
})

const playAllUrl = computed((): string => {
  return `https://www.bilibili.com/list/ml${activatedMediaId.value}`
})

watch(activatedMediaId, (newVal: number, oldVal: number) => {
  if (newVal === oldVal)
    return

  favoriteResources.length = 0
  if (favoriteVideosWrap.value)
    scrollToTop(favoriteVideosWrap.value)

  currentPageNum.value = 1
  noMoreContent.value = false
  getFavoriteResources()
})

onMounted(() => {
  initData()
})

async function initData() {
  await run(
    () => api.favorite.getFavoriteCategories({ up_mid: getUserID() }),
    (res) => {
      if (res.code !== 0)
        throw new Error(res.message)
      favoriteCategories.splice(0, favoriteCategories.length, ...(res.data.list || []))
      const first = favoriteCategories[0]
      if (first) {
        activatedMediaId.value = first.id
        activatedFavoriteTitle.value = first.title
      }
    },
  )
}

useEventListener(favoriteVideosWrap, 'scroll', () => {
  const element = favoriteVideosWrap.value
  if (element.clientHeight + element.scrollTop >= element.scrollHeight - 20 && !isLoading.value && !noMoreContent.value)
    getFavoriteResources()
})

function getFavoriteResources() {
  return run(
    () => api.favorite.getFavoriteResources({ media_id: activatedMediaId.value, pn: currentPageNum.value }),
    (res) => {
      if (res.code !== 0)
        throw new Error(res.message)
      const items = res.data.medias || []
      favoriteResources.push(...items)
      noMoreContent.value = items.length < 20
      currentPageNum.value++
    },
  )
}

function refreshFavoriteResources() {
  favoriteResources.length = 0
  currentPageNum.value = 1
  noMoreContent.value = false
  getFavoriteResources()
}

function changeCategory(categoryItem: FavoriteCategory) {
  activatedMediaId.value = categoryItem.id
  activatedFavoriteTitle.value = categoryItem.title
}

function isMusic(item: FavoriteResource) {
  return item.link.includes('bilibili://music')
}

defineExpose({
  refreshFavoriteResources,
})
</script>

<template>
  <div
    style="backdrop-filter: var(--bew-filter-glass-1)"
    h="[calc(100vh-100px)]"
    max-h-500px
    important-overflow-y-overlay
    bg="$bew-elevated"
    w="450px"
    rounded="$bew-radius"
    pos="relative"
    shadow="[var(--bew-shadow-edge-glow-1),var(--bew-shadow-3)]"
    border="1 $bew-border-color"
  >
    <!-- top bar -->
    <header
      flex="~" items-center justify-between p="x-6" pos="sticky top-0 left-0"
      w="full" h-50px z="2"
    >
      <h3 cursor="pointer" font-600 @click="scrollToTop(favoriteVideosWrap)">
        {{ activatedFavoriteTitle }}
      </h3>

      <div flex="~ gap-4">
        <ALink :href="playAllUrl" type="topBar" flex="~" items="center">
          <span text="sm">{{ $t('common.play_all') }}</span>
        </ALink>
        <ALink :href="viewAllUrl" type="topBar" flex="~" items="center">
          <span text="sm">{{ $t('common.view_all') }}</span>
        </ALink>
      </div>
    </header>

    <main flex="~" h="[calc(100%-50px)]" rounded="$bew-radius">
      <aside
        pos="sticky top-50px left-0" w="140px" h-full overflow="y-auto" flex="shrink-0"
        bg="$bew-fill-1"
      >
        <ul grid="~ cols-1">
          <li
            v-for="item in favoriteCategories"
            :key="item.id"
            :class="activatedMediaId === item.id ? 'activated-category' : ''"
            p="y-2 x-6"
            cursor="pointer"
            transition="~ duration-300"
            @click="changeCategory(item)"
          >
            {{ item.title }}
          </li>
        </ul>
      </aside>

      <!-- Favorite videos wrapper -->
      <div
        ref="favoriteVideosWrap" flex="~ col gap-2 1" overflow="y-auto" p="x-4" pos="relative"
        h-full
      >
        <!-- loading -->
        <Button v-if="loadFailed" @click="activatedMediaId ? getFavoriteResources() : initData()">
          {{ $t('common.retry') }}
        </Button>
        <Loading
          v-if="isLoading && favoriteResources.length === 0"
          pos="absolute left-0"
          bg="$bew-content"
          z="1"
          w="full"
          h="full"
          flex="~"
          items="center"
          rounded="$bew-radius"
        />

        <!-- empty -->
        <Empty v-if="!isLoading && favoriteResources.length === 0" w="full" h="full" rounded="$bew-radius-half" />

        <!-- favorites -->
        <TransitionGroup name="list">
          <ALink
            v-for="item in favoriteResources"
            :key="item.id"
            :href="
              isMusic(item) ? `https://www.bilibili.com/audio/au${item.id}` : `//www.bilibili.com/video/${item.bvid}`
            "
            type="topBar"
            hover:bg="$bew-fill-2"
            rounded="$bew-radius"
            m="last:b-4"
            p="2"
            class="group"
            transition="~ duration-300"
          >
            <section flex="~ gap-4" item-start>
              <div bg="$bew-skeleton" w="120px" flex="shrink-0" rounded="$bew-radius-half" overflow="hidden">
                <div pos="relative">
                  <img
                    w="120px"
                    class="aspect-video"
                    :src="`${removeHttpFromUrl(item.cover)}@256w_144h_1c`"
                    :alt="item.title"
                    bg="contain"
                  >
                  <div
                    pos="absolute bottom-0 right-0"
                    bg="black opacity-60"
                    m="1"
                    p="x-2 y-1"
                    text="white xs"
                    rounded-full
                  >
                    {{ calcCurrentTime(item.duration) }}
                  </div>
                </div>
              </div>

              <!-- Description -->
              <div>
                <h3 class="keep-two-lines">
                  {{ item.title }}
                </h3>
                <div text="$bew-text-2 sm" m="t-2" flex="~" items-center>
                  {{ item.upper.name }}
                </div>
              </div>
            </section>
          </ALink>
        </TransitionGroup>

        <!-- loading -->
        <Transition name="fade">
          <Loading v-if="isLoading && favoriteResources.length !== 0" m="-t-4" />
        </Transition>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.activated-category {
  --uno: "bg-$bew-theme-color text-white";
}
</style>
