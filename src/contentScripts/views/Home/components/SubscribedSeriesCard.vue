<script setup lang="ts">
import ALink from '~/components/ALink.vue'
import type { Video } from '~/components/VideoCard/types'
import { settings } from '~/logic'
import { numFormatter } from '~/utils/dataFormatter'

defineProps<{
  video: Video
  airDate: string
  totalEpisodes: number
  releasedEpisodes: number
  coverLoading: 'eager' | 'lazy'
  preview?: boolean
  posterCover?: string
}>()

const options = computed(() => settings.value.seriesStyles[settings.value.seriesStyle])
const hasDetails = computed(() => options.value.showPlays || options.value.showDanmaku
  || options.value.showEpisodes || options.value.showAirDate)
</script>

<template>
  <article
    class="series-card"
    :class="[
      `layout-${settings.seriesStyle}`,
      `title-${options.titleLines}`,
      { 'is-preview': preview, 'details-always': options.detailsTrigger === 'always' },
    ]"
    :style="{ '--series-cover-fit': options.coverFit }"
  >
    <div class="series-cover">
      <component :is="preview ? 'span' : ALink" :href="preview ? undefined : video.url!" type="videoCard" :aria-label="video.title" class="cover-link">
        <img :src="settings.seriesStyle === 'poster' ? posterCover || video.cover : video.cover" alt="" :loading="coverLoading" decoding="async">
      </component>
    </div>
    <component :is="preview ? 'span' : ALink" class="series-title" :href="preview ? undefined : video.url!" type="videoCard" :title="video.title">
      {{ video.title }}
    </component>
    <dl v-if="hasDetails" class="series-details">
      <div v-if="options.showPlays">
        <dt>{{ $t('home.series_plays') }}</dt>
        <dd>{{ video.view == null ? '—' : numFormatter(video.view) }}</dd>
      </div>
      <div v-if="options.showDanmaku">
        <dt>{{ $t('common.danmakuWithoutNum') }}</dt>
        <dd>{{ video.danmaku == null ? '—' : numFormatter(video.danmaku) }}</dd>
      </div>
      <div v-if="options.showEpisodes">
        <dt>{{ $t('home.series_episodes') }}</dt>
        <dd>
          {{
            totalEpisodes > 0
              ? $t('anime.total_episodes', { ep: totalEpisodes })
              : releasedEpisodes > 0
                ? $t('anime.update_to_n_episodes', { ep: releasedEpisodes })
                : '—'
          }}
        </dd>
      </div>
      <div v-if="options.showAirDate">
        <dt>{{ $t('home.series_air_date') }}</dt>
        <dd class="air-date">
          {{ airDate || '—' }}
        </dd>
      </div>
    </dl>
  </article>
</template>

<style scoped lang="scss">
.series-card {
  display: grid;
  grid-template-areas: "cover" "title" "details";
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  padding-bottom: 8px;
  container-type: inline-size;
}
.series-cover {
  grid-area: cover;
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--bew-radius);
  background: var(--bew-skeleton);
}
.cover-link {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: var(--series-cover-fit);
  }
}
.series-title {
  grid-area: title;
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  min-height: 3em;
  margin: 12px 0 0;
  color: var(--bew-text-1);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.series-details {
  grid-area: details;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 14px 12px;
  min-width: 0;
  margin: 16px 0 0;
  color: var(--bew-text-1);
  dt {
    font-size: 12px;
    line-height: 1.4;
    color: var(--bew-text-2);
  }
  dd {
    margin: 3px 0 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
}
.layout-overlay .series-details {
  grid-area: cover;
  z-index: 1;
  justify-self: end;
  width: clamp(108px, 36%, 170px);
  min-height: 0;
  margin: 8px;
  padding: clamp(6px, 1.8cqi, 14px) clamp(10px, 2.5cqi, 18px);
  grid-template-columns: 1fr;
  align-content: space-around;
  gap: 2px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: calc(var(--bew-radius) - 2px);
  background: rgb(18 21 29 / 72%);
  backdrop-filter: blur(20px) saturate(160%);
  color: white;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 160ms ease,
    visibility 160ms;
  dt {
    font-size: clamp(9px, 2.5cqi, 12px);
    line-height: 1.15;
    color: rgb(255 255 255 / 72%);
  }
  dd {
    margin-top: 1px;
    font-size: clamp(11px, 3.1cqi, 16px);
    line-height: 1.2;
  }
  .air-date {
    font-size: clamp(10px, 2.8cqi, 13px);
  }
}
.layout-overlay:focus-within .series-details,
.layout-overlay.details-always .series-details,
.layout-overlay.is-preview .series-details {
  opacity: 1;
  visibility: visible;
}
@media (hover: hover) {
  .layout-overlay:hover .series-details {
    opacity: 1;
    visibility: visible;
  }
}
.layout-poster {
  grid-template-areas: "cover title" "cover details";
  grid-template-columns: clamp(100px, 30%, 160px) minmax(0, 1fr);
  grid-template-rows: min-content 1fr;
  column-gap: 16px;
  max-width: 560px;
  .series-cover {
    align-self: start;
  }
  .cover-link {
    aspect-ratio: 3 / 4;
    height: auto;
  }
  .series-title {
    margin: 0;
    min-height: 0;
    align-self: start;
  }
  .series-details {
    align-self: start;
    margin-top: 14px;
  }
}
.title-one .series-title {
  min-height: 1.5em;
  -webkit-line-clamp: 1;
}
.title-full .series-title {
  display: block;
  min-height: 0;
}
.cover-link:focus-visible {
  outline: 3px solid var(--bew-theme-color);
  outline-offset: -3px;
}
.series-title:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .series-details {
    transition: none;
  }
}
</style>
