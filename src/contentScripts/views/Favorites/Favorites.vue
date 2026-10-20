<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { FavoriteCategory, FavoriteResource } from '~/components/TopBar/types'
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import type { FavoritesResult, Media as FavoriteItem } from '~/models/video/favorite'
import type { FavoritesCategoryResult, List as CategoryItem } from '~/models/video/favoriteCategory'
import api from '~/utils/api'
import { getCSRF, getUserID, openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'
import emitter from '~/utils/mitt'

const { t } = useI18n()

const favoriteCategories = shallowRef<CategoryItem[]>([])
const categoryOptions = computed(() => favoriteCategories.value.map(item => ({ label: item.title, value: item })))
const selectedCategory = ref<FavoriteCategory>()
const activatedCategoryCover = ref('')
const shouldMoveCtrlBarUp = ref(false)
const keyword = ref('')
const categoriesLoading = ref(false)
const categoriesFailed = ref(false)
const { handleBackToTop } = useBewlyApp()
let currentPageNum = 1
let query = ''
let alive = true
let categoryGeneration = 0

const {
  items: favoriteResources,
  isLoading,
  noMoreContent,
  loadFailed,
  windowFull,
  load,
  reset,
  continueWindow,
} = useWindowedFeed<FavoriteItem>({
  key: item => `${item.type}:${item.id}`,
  scrollTarget: () => 0,
  beforeLoading: () => {},
  afterLoading: () => {},
  resetCursor: () => { currentPageNum = 1 },
  loadPage: async (current) => {
    const category = selectedCategory.value
    if (!category)
      return { items: [], done: true }
    const res: FavoritesResult = await api.favorite.getFavoriteResources({
      media_id: category.id,
      pn: currentPageNum,
      keyword: query,
    })
    if (!current())
      return { items: [], done: true }
    if (res.code !== 0)
      throw new Error(res.message)
    currentPageNum++
    activatedCategoryCover.value = res.data.info.cover
    const items = res.data.medias ?? []
    return { items, done: !items.length || res.data.has_more === false }
  },
})
const isFullPageLoading = computed(() => categoriesLoading.value || (isLoading.value && !favoriteResources.value.length))

function handleTopBarVisibility(val: boolean) {
  shouldMoveCtrlBarUp.value = settings.value.autoHideTopBar && settings.value.showTopBar && !val
}

onMounted(() => {
  emitter.on(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibility)
  void initData()
})
onBeforeUnmount(() => {
  alive = false
  categoryGeneration++
  emitter.off(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibility)
})

async function initData() {
  const token = ++categoryGeneration
  categoriesLoading.value = true
  categoriesFailed.value = false
  try {
    const res: FavoritesCategoryResult = await api.favorite.getFavoriteCategories({ up_mid: getUserID() })
    if (!alive || token !== categoryGeneration)
      return
    if (res.code !== 0)
      throw new Error(res.message)
    favoriteCategories.value = res.data?.list ?? []
    const category = favoriteCategories.value.find(item => item.id === selectedCategory.value?.id) ?? favoriteCategories.value[0]
    if (category) {
      await changeCategory(category)
    }
    else {
      selectedCategory.value = undefined
      await reset()
    }
  }
  catch {
    if (alive && token === categoryGeneration)
      categoriesFailed.value = true
  }
  finally {
    if (alive && token === categoryGeneration)
      categoriesLoading.value = false
  }
}

async function changeCategory(categoryItem: FavoriteCategory) {
  selectedCategory.value = categoryItem
  activatedCategoryCover.value = ''
  query = ''
  keyword.value = ''
  handleBackToTop()
  await reset()
}

function handleSearch() {
  query = keyword.value.trim()
  handleBackToTop()
  void reset()
}

function handlePlayAll() {
  openLinkToNewTab(`https://www.bilibili.com/list/ml${selectedCategory.value?.id}`)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

function handleUnfavorite(favoriteResource: FavoriteResource) {
  if (!confirm(t('favorites.unfavorite_confirm')))
    return
  const category = selectedCategory.value?.id
  api.favorite.patchDelFavoriteResources({
    resources: `${favoriteResource.id}:${favoriteResource.type}`,
    media_id: category,
    csrf: getCSRF(),
  }).then((res) => {
    if (alive && res.code === 0 && selectedCategory.value?.id === category)
      favoriteResources.value = favoriteResources.value.filter(item => item.id !== favoriteResource.id || item.type !== favoriteResource.type)
  })
}

function isMusic(item: FavoriteResource) {
  return item.link.includes('bilibili://music')
}
</script>

<template>
  <div v-if="getCSRF()" flex="~ col md:row lg:row" gap-6>
    <main w="full md:60% lg:70% xl:75%" order="2 md:1 lg:1" relative>
      <!-- <h3 text="3xl $bew-text-1" font-bold mb-6>
        {{ selectedCategory?.title }}
      </h3> -->
      <div
        fixed z-10 absolute p-2 flex="~ gap-2"
        items-center
        bg="$bew-elevated-solid" rounded="$bew-radius" shadow="$bew-shadow-2" mt--2 transition="all 300 ease-in-out"
        :class="{ hide: shouldMoveCtrlBarUp }"
      >
        <Select v-model="selectedCategory" w-150px :options="categoryOptions" @change="(val: FavoriteCategory) => changeCategory(val)" />
        <Input v-model="keyword" w-250px @enter="handleSearch" />
        <Button type="primary" @click="handleSearch">
          <template #left>
            <div i-tabler:search />
          </template>
        </Button>
        <!-- <h3
          text="2xl $bew-text-1" font-bold w-150px
        >
          {{ selectedCategory?.title }}
        </h3> -->
      </div>
      <Button v-if="categoriesFailed" class="mt-55px" @click="initData">
        {{ $t('common.retry') }}
      </Button>
      <Button v-else-if="loadFailed" class="mt-55px" @click="load">
        {{ $t('common.retry') }}
      </Button>
      <Empty v-if="favoriteResources.length === 0 && !isFullPageLoading" m="t-55px b-6" />
      <template v-else>
        <Transition name="fade">
          <Loading v-if="isFullPageLoading" w-full h-full pos="absolute top-0 left-0" mt--50px />
        </Transition>
        <!-- favorite list -->
        <VirtualFeed :items="favoriteResources" :item-key="item => `${item.type}:${item.id}`" layout="adaptive" :column-offset="1" m="t-55px b-6">
          <template #default="{ item, index }">
            <VideoCard
              :cover-loading="index < 8 ? 'eager' : 'lazy'"
              :video="{
                id: item.id,
                duration: item.duration,
                title: item.title,
                cover: item.cover,
                author: {
                  name: item.upper.name,
                  authorFace: item.upper.face,
                  mid: item.upper.mid,
                },
                view: item.cnt_info.play,
                danmaku: item.cnt_info.danmaku,
                publishedTimestamp: item.pubtime,
                bvid: isMusic(item) ? undefined : item.bvid,
                url: isMusic(item) ? `https://www.bilibili.com/audio/au${item.id}` : undefined,
              }"
              group
            >
              <template #coverTopLeft>
                <button
                  p="x-2 y-1" m="1"
                  rounded="$bew-radius"
                  text="!white xl"
                  bg="black opacity-60 hover:$bew-error-color-80"
                  @click.prevent.stop="handleUnfavorite(item)"
                >
                  <Tooltip :content="$t('favorites.unfavorite')" placement="bottom" type="dark">
                    <div i-ic-baseline-clear />
                  </Tooltip>
                </button>
              </template>
            </VideoCard>
          </template>
        </VirtualFeed>

        <Button v-if="windowFull" class="my-4" @click="continueWindow">
          {{ $t('common.continue_browsing') }}
        </Button>
        <!-- no more content -->
        <Empty v-if="noMoreContent" class="py-4" :description="$t('common.no_more_content')" />

        <!-- loading -->
        <Transition name="fade">
          <Loading
            v-if="isLoading && favoriteResources.length !== 0 && !noMoreContent"
            m="-t-4"
          />
        </Transition>
      </template>
    </main>

    <aside relative w="full md:40% lg:30% xl:25%" class="hidden md:block" order="1 md:2 lg:2">
      <div
        pos="sticky top-120px"
        w-full h="auto md:[calc(100vh-160px)]"
        my-10
        rounded="$bew-radius"
        overflow-hidden
      >
        <!-- Frosted Glass Cover -->
        <div
          pos="absolute top-0 left-0" w-full h-full
          z--1
        >
          <div
            absolute w-full h-full
            bg="$bew-fill-4"
          />
          <img
            v-if="activatedCategoryCover"
            :src="removeHttpFromUrl(`${activatedCategoryCover}@480w_270h_1c`)"
            w-full h-full object="cover center" blur-40px
            relative z--1
          >
        </div>

        <!-- Content -->
        <main
          pos="absolute top-0 left-0"
          w-full h-full
          overflow-overlay
          flex="~ col gap-4 justify-start"
          p-6
        >
          <picture
            rounded="$bew-radius" style="box-shadow: 0 16px 24px -12px rgba(0, 0, 0, .36)"
            aspect-video mb-4 bg="$bew-skeleton"
          >
            <img
              v-if="activatedCategoryCover" :src="removeHttpFromUrl(`${activatedCategoryCover}@480w_270h_1c`)"
              rounded="$bew-radius" aspect-video w-full object-cover
            >
            <div v-else aspect-video w-full>
              <!-- <Empty /> -->
            </div>
          </picture>

          <h3 text="3xl white" fw-600 style="text-shadow: 0 0 12px rgba(0,0,0,.3)">
            {{ selectedCategory?.title }}
          </h3>
          <p flex="~ col" gap-4>
            <Button
              color="rgba(255,255,255,.35)" block text-color="white" strong flex-1
              @click="handlePlayAll"
            >
              <template #left>
                <div i-tabler:player-play />
              </template>
              {{ t('common.play_all') }}
            </Button>
          </p>
          <ul
            class="category-list" h-full min-h-200px
            overflow-overlay
            border="1 color-[rgba(255,255,255,.2)]"
            rounded="$bew-radius"
          >
            <li
              v-for="item in favoriteCategories" :key="item.id"
              border-b="1 color-[rgba(255,255,255,.2)]"
              lh-30px px-4 cursor-pointer hover:bg="[rgba(255,255,255,.35)]"
              duration-300 color-white flex justify-between
              :style="{ background: item.id === selectedCategory?.id ? 'rgba(255,255,255,.35)' : '', pointerEvents: 'auto' }"
              @click="changeCategory(item)"
            >
              <span>{{ item.title }}</span> <span ml-2 color-white color-opacity-60>{{ item.media_count }}</span>
            </li>
          </ul>
        </main>
      </div>
    </aside>
  </div>
  <Empty v-else mt-6 :description="t('common.please_log_in_first')">
    <Button type="primary" @click="jumpToLoginPage()">
      {{ $t('common.login') }}
    </Button>
  </Empty>
</template>

<style lang="scss" scoped>
.hide {
  transform: translateY(-70px);
}

.category-list {
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.35);
    border-radius: 20px;
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }
}
</style>
