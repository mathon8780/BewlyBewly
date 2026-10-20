<script setup lang="ts">
import type { VideoCardStates } from '~/composables/useVideoCardState'
import { provideVideoCardState } from '~/composables/useVideoCardState'

const props = defineProps<{ states: VideoCardStates }>()
provideVideoCardState(props.states)
</script>

<template>
  <div style="min-width: 0">
    <slot />
  </div>
</template>
