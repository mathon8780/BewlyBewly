<script setup lang="ts">
function reload() {
  location.reload()
}
</script>

<template>
  <div role="alert" p-4 text-center>
    <p>{{ $t('common.load_failed') }}</p>
    <button type="button" mt-2 underline @click="reload">
      {{ $t('common.retry') }}
    </button>
  </div>
</template>
