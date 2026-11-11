<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import SubscribedSeriesCard from '~/contentScripts/views/Home/components/SubscribedSeriesCard.vue'
import { settings } from '~/logic'
import { defaultSeriesDisplayOptions } from '~/logic/seriesSettings'

const { t } = useI18n()
const styles = ['overlay', 'poster', 'below'] as const
const options = computed(() => settings.value.seriesStyles[settings.value.seriesStyle])
const fields = [
  { key: 'showPlays', label: 'home.series_plays' },
  { key: 'showDanmaku', label: 'common.danmakuWithoutNum' },
  { key: 'showEpisodes', label: 'home.series_episodes' },
  { key: 'showAirDate', label: 'home.series_air_date' },
] as const
const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#b6dbdc"/><circle cx="490" cy="75" r="40" fill="#fff3cc"/><path d="M0 250 150 80 320 280 440 130 640 270V400H0Z" fill="#72a5a7"/><path d="m0 310 180-100 190 110 270-120v200H0Z" fill="#397b83"/><path d="M0 360Q180 300 350 350T640 340" fill="none" stroke="#b7d6cc" stroke-width="3"/></svg>')}`
const video = computed<Video>(() => ({
  id: 0,
  title: t('settings.series_preview_title'),
  cover,
  view: 12345678,
  danmaku: 98765,
  threePointV2: [],
}))
function resetStyle() {
  settings.value.seriesStyles[settings.value.seriesStyle] = defaultSeriesDisplayOptions()
}
</script>

<template>
  <div class="series-settings">
    <fieldset class="style-picker">
      <legend>{{ $t('settings.series_style') }}</legend>
      <div class="style-options">
        <label v-for="style in styles" :key="style" class="style-option">
          <input v-model="settings.seriesStyle" type="radio" name="series-style" :value="style">
          <span class="style-option-body">
            <span class="style-sketch" :class="`sketch-${style}`" aria-hidden="true">
              <span class="sketch-cover" /><span class="sketch-lines" />
            </span>
            <span class="style-copy">
              <strong>{{ $t(`settings.series_style_${style}`) }}</strong>
              <small>{{ $t(`settings.series_style_${style}_desc`) }}</small>
            </span>
          </span>
        </label>
      </div>
    </fieldset>
    <section :aria-label="$t('settings.series_edit')">
      <header class="editor-heading">
        <div>
          <h2>{{ $t('settings.series_edit') }}</h2>
          <p>{{ $t(`settings.series_style_${settings.seriesStyle}`) }}</p>
        </div>
        <button type="button" @click="resetStyle">
          {{ $t('settings.series_reset') }}
        </button>
      </header>
      <div class="workspace">
        <figure class="series-preview" :aria-label="$t('settings.series_preview')">
          <SubscribedSeriesCard
            :video="video"
            air-date="2026-01-01"
            :total-episodes="24"
            :released-episodes="12"
            cover-loading="eager"
            preview
          />
          <figcaption>
            <span v-if="settings.seriesStyle === 'overlay'">{{ $t('settings.series_preview_expanded') }}</span>
            <small>{{ $t('settings.series_preview_hint') }}</small>
          </figcaption>
        </figure>
        <div class="controls">
          <fieldset>
            <legend>{{ $t('settings.series_content') }}</legend>
            <label v-for="field in fields" :key="field.key" class="field">
              <span>{{ $t(field.label) }}</span>
              <input v-model="options[field.key]" type="checkbox">
            </label>
          </fieldset>
          <fieldset>
            <legend>{{ $t('settings.series_display') }}</legend>
            <label class="field">
              <span>{{ $t('settings.series_cover_fit') }}</span>
              <select v-model="options.coverFit">
                <option value="cover">{{ $t('settings.series_fit_cover') }}</option>
                <option value="contain">{{ $t('settings.series_fit_contain') }}</option>
              </select>
            </label>
            <label class="field">
              <span>{{ $t('settings.series_title_lines') }}</span>
              <select v-model="options.titleLines">
                <option value="one">{{ $t('settings.series_title_one') }}</option>
                <option value="two">{{ $t('settings.series_title_two') }}</option>
                <option value="full">{{ $t('settings.series_title_full') }}</option>
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>{{ $t('settings.series_behavior') }}</legend>
            <template v-if="settings.seriesStyle === 'overlay'">
              <label class="field">
                <span>{{ $t('settings.series_details_mode') }}</span>
                <select v-model="options.detailsTrigger">
                  <option value="hover">{{ $t('settings.series_mode_hover') }}</option>
                  <option value="always">{{ $t('settings.series_mode_overlay') }}</option>
                </select>
              </label>
              <p class="behavior-note">
                {{ $t('settings.series_behavior_hint') }}
              </p>
            </template>
            <p v-else class="behavior-note">
              {{ $t('settings.series_always_visible') }}
            </p>
          </fieldset>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.series-settings {
  container-type: inline-size;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
legend {
  font-weight: 600;
  padding: 0;
  margin-bottom: 12px;
}
.style-picker {
  margin-bottom: 30px;
}
.style-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.style-option {
  position: relative;
  cursor: pointer;
  min-width: 0;
}
.style-option > input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.style-option-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  padding: 16px;
}
.style-option:hover .style-option-body {
  border-color: var(--bew-theme-color);
}
.style-option input:checked + .style-option-body {
  border-color: var(--bew-theme-color);
  background: var(--bew-theme-color-10);
}
.style-option input:focus-visible + .style-option-body {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 3px;
}
.style-copy strong {
  display: block;
  font-weight: 500;
}
.style-copy small {
  display: block;
  color: var(--bew-text-2);
  font-size: 11px;
  margin-top: 4px;
}
.style-sketch {
  position: relative;
  display: block;
  width: 58px;
  height: 40px;
}
.sketch-cover {
  position: absolute;
  inset: 0 0 9px;
  border-radius: 4px;
  background: var(--bew-fill-2);
  border: 1px solid var(--bew-text-3);
}
.sketch-lines {
  position: absolute;
  height: 3px;
  left: 0;
  right: 14px;
  bottom: 0;
  border-radius: 2px;
  background: var(--bew-text-3);
}
.sketch-overlay .sketch-cover::after {
  content: "";
  position: absolute;
  inset: 4px 4px 4px auto;
  width: 16px;
  border-radius: 2px;
  background: var(--bew-theme-color);
  opacity: 0.65;
}
.sketch-poster .sketch-cover {
  inset: 0 auto 0 0;
  width: 22px;
}
.sketch-poster .sketch-lines {
  inset: 3px 0 auto 30px;
  box-shadow:
    0 10px var(--bew-text-3),
    0 20px var(--bew-text-3),
    0 30px var(--bew-text-3);
}
.sketch-below .sketch-cover {
  bottom: 16px;
}
.sketch-below .sketch-lines {
  bottom: 7px;
  box-shadow: 0 7px var(--bew-text-3);
}
.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}
.editor-heading h2 {
  font-size: 18px;
  font-weight: 600;
}
.editor-heading p {
  color: var(--bew-text-2);
  font-size: 12px;
  margin-top: 4px;
}
.editor-heading button {
  color: var(--bew-theme-color);
  font-size: 12px;
  cursor: pointer;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 30px;
  align-items: start;
}
.series-preview {
  width: 100%;
  max-width: 410px;
  margin: 24px auto 0;
  min-width: 0;
}
.series-preview figcaption {
  text-align: center;
  color: var(--bew-text-2);
  font-size: 12px;
  margin-top: 18px;
}
.series-preview small {
  display: block;
  margin-top: 5px;
  font-size: 11px;
}
.controls fieldset {
  margin-bottom: 20px;
}
.controls fieldset + fieldset {
  border-top: 1px solid var(--bew-border-color);
  padding-top: 16px;
}
.controls legend {
  font-size: 13px;
  margin-bottom: 6px;
}
.controls fieldset + fieldset legend {
  float: left;
  width: 100%;
  margin-bottom: 8px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  clear: both;
  font-size: 13px;
}
.field select {
  width: 125px;
  max-width: 55%;
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  color: var(--bew-text-1);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
}
.field input[type="checkbox"] {
  appearance: none;
  width: 34px;
  height: 20px;
  border-radius: 20px;
  background: var(--bew-text-3);
  position: relative;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
}
.field input[type="checkbox"]::after {
  content: "";
  width: 14px;
  height: 14px;
  position: absolute;
  top: 3px;
  left: 3px;
  background: white;
  border-radius: 50%;
}
.field input[type="checkbox"]:checked {
  background: var(--bew-theme-color);
}
.field input[type="checkbox"]:checked::after {
  left: 17px;
}
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 3px;
}
.behavior-note {
  clear: both;
  font-size: 12px;
  color: var(--bew-text-2);
  padding-top: 5px;
  line-height: 1.8;
}
@container (max-width: 620px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .series-preview {
    margin-top: 0;
  }
  .controls {
    width: 100%;
  }
  .style-option-body {
    padding: 12px;
  }
  .style-copy small {
    display: none;
  }
}
</style>
