<script setup lang="ts">
import { ref } from 'vue'

import { BewlyPage } from '../types'
import SubscribedSeries from './SubscribedSeries/SubscribedSeries.vue'

const activePage = ref<BewlyPage>(BewlyPage.Home)

const pages = [
  {
    value: BewlyPage.Home,
    title: 'settings.menu_home',
    icon: 'i-mingcute:home-5-line',
    iconActivated: 'i-mingcute:home-5-fill',
    component: defineAsyncComponent(() => import('./Home/Home.vue')),
  },
  {
    value: BewlyPage.Search,
    title: 'settings.menu_search_page',
    icon: 'i-mingcute:search-2-line',
    iconActivated: 'i-mingcute:search-2-fill',
    component: defineAsyncComponent(() => import('./SearchPage/SearchPage.vue')),
  },
  {
    value: BewlyPage.SubscribedSeries,
    title: 'home.subscribed_series',
    icon: 'i-mingcute:film-line',
    iconActivated: 'i-mingcute:film-fill',
    component: SubscribedSeries,
  },
]
</script>

<template>
  <div flex="~ gap-2">
    <!-- Sidebar -->
    <div w-140px>
      <div w-inherit pos="fixed">
        <ul flex="~ col gap-1">
          <li
            v-for="page in pages"
            :key="page.value"
            :style="{ backgroundColor: activePage === page.value ? 'var(--bew-fill-3)' : '' }"
            cursor-pointer p="y-2 x-4" ml--4 rounded="$bew-radius" bg="hover:$bew-fill-2"
            duration-300
            @click="activePage = page.value"
          >
            <div class="flex items-center">
              <div :class="activePage === page.value ? page.iconActivated : page.icon" class="mr-2 text-lg" />
              <span>{{ $t(page.title) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1 p-4">
      <KeepAlive include="SubscribedSeries" :max="1">
        <Component :is="pages.find(page => page.value === activePage)?.component" />
      </KeepAlive>
    </div>
  </div>
</template>
