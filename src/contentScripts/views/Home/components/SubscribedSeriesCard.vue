<script setup lang="ts">
import ALink from '~/components/ALink.vue'
import type { Video } from '~/components/VideoCard/types'
import { numFormatter } from '~/utils/dataFormatter'

defineProps<{
  video: Video
  airDate: string
  totalEpisodes: number
  releasedEpisodes: number
  coverLoading: 'eager' | 'lazy'
}>()

const detailsOpen = ref(false)
</script>

<template>
  <article class="series-card" :class="{ 'details-open': detailsOpen }" @keydown.esc="detailsOpen = false">
    <div class="series-cover">
      <ALink :href="video.url!" type="videoCard" :aria-label="video.title" class="cover-link">
        <img :src="video.cover" alt="" :loading="coverLoading" decoding="async">
      </ALink>
      <dl class="series-details">
        <div>
          <dt>{{ $t('home.series_plays') }}</dt>
          <dd>{{ video.view == null ? '—' : numFormatter(video.view) }}</dd>
        </div>
        <div>
          <dt>{{ $t('common.danmakuWithoutNum') }}</dt>
          <dd>{{ video.danmaku == null ? '—' : numFormatter(video.danmaku) }}</dd>
        </div>
        <div>
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
        <div>
          <dt>{{ $t('home.series_air_date') }}</dt>
          <dd class="air-date">
            {{ airDate || '—' }}
          </dd>
        </div>
      </dl>
      <button
        class="details-toggle"
        type="button"
        :aria-label="$t('home.series_details')"
        :aria-expanded="detailsOpen"
        @click="detailsOpen = !detailsOpen"
      >
        <span aria-hidden="true" i-mingcute:information-line />
      </button>
    </div>
    <ALink class="series-title" :href="video.url!" type="videoCard" :title="video.title">
      {{ video.title }}
    </ALink>
  </article>
</template>

<style scoped lang="scss">
.series-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding-bottom: 8px;
  container-type: inline-size;
}

.series-cover {
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--bew-radius);
  background: var(--bew-skeleton);
  isolation: isolate;
  box-shadow: 0 0 0 1px var(--bew-border-color);
}

.cover-link {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.series-title {
  display: -webkit-box;
  overflow: hidden;
  min-height: 3em;
  margin: 12px 2px 0;
  color: var(--bew-text-1);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.series-details {
  position: absolute;
  inset: 8px 8px 8px auto;
  box-sizing: border-box;
  width: clamp(108px, 34%, 170px);
  margin: 0;
  padding: clamp(6px, 1.8cqi, 14px) clamp(10px, 2.5cqi, 18px);
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 2px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: calc(var(--bew-radius) - 2px);
  background: rgb(18 21 29 / 72%);
  backdrop-filter: blur(20px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 12%),
    0 4px 16px rgb(0 0 0 / 16%);
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
    margin: 1px 0 0;
    font-size: clamp(11px, 3.1cqi, 16px);
    line-height: 1.2;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .air-date {
    font-size: clamp(10px, 2.8cqi, 13px);
    white-space: nowrap;
  }
}

.series-card:focus-within .series-details,
.series-card.details-open .series-details {
  opacity: 1;
  visibility: visible;
}

@media (hover: hover) {
  .series-card:hover .series-details {
    opacity: 1;
    visibility: visible;
  }
}

.cover-link:focus-visible {
  outline: 3px solid var(--bew-theme-color);
  outline-offset: -3px;
}

.series-title:focus-visible,
.details-toggle:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.details-toggle {
  display: none;
  position: absolute;
  bottom: 8px;
  left: 8px;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: rgb(18 21 29 / 75%);
  color: white;
}

@media (hover: none) {
  .details-toggle {
    display: grid;
  }

  .series-card:focus-within:not(.details-open) .series-details {
    opacity: 0;
    visibility: hidden;
  }
}

@media (prefers-reduced-motion: reduce) {
  .series-details {
    transition: none;
  }
}
</style>
