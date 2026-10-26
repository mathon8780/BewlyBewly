<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const props = defineProps<{
  options: OptionType[]
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue', 'change'])

interface OptionType {
  value: any
  label: string
}

const label = computed(() => props.options.find(item => item.value === props.modelValue)?.label || '')
const showOptions = ref(false)
const root = ref<HTMLElement>()
onClickOutside(root, () => {
  showOptions.value = false
})
function onClickOption(val: OptionType) {
  emit('update:modelValue', val.value)
  emit('change', val.value)
  showOptions.value = false
}
function moveOption(direction: number) {
  const index = props.options.findIndex(item => item.value === props.modelValue)
  const next = (index + direction + props.options.length) % props.options.length
  if (props.options[next])
    onClickOption(props.options[next])
}
</script>

<template>
  <div ref="root" pos="relative">
    <button
      type="button"
      role="combobox"
      :aria-expanded="showOptions"
      p="x-4 y-2"
      bg="$bew-fill-1"
      rounded="$bew-radius"
      text="center $bew-text-1"
      cursor="pointer"
      flex="~"
      justify="between"
      items="center"
      w="full"
      :ring="showOptions ? '2px $bew-theme-color' : ''"
      duration-300
      @keydown.down.prevent="moveOption(1)"
      @keydown.up.prevent="moveOption(-1)"
      @keydown.esc.prevent="showOptions = false"
      @click="showOptions = !showOptions"
    >
      <div truncate overflow="hidden" m="r-2" v-text="label" />

      <!-- arrow -->
      <div
        border="~ solid t-0 l-0 r-2 b-2"
        :border-color="showOptions ? '$bew-theme-color' : '$bew-fill-4'"
        p="3px"
        m="l-2"
        display="inline-block"
        :transform="`~ ${!showOptions ? 'rotate-45 -translate-y-1/4' : 'rotate-225 translate-y-1/4'} `"
        transition="all duration-300"
      />
    </button>
    <Transition name="dropdown">
      <div
        v-if="showOptions"
        style="backdrop-filter: var(--bew-filter-glass-1)"
        pos="absolute"
        bg="$bew-elevated"
        shadow="$bew-shadow-2"
        p="2"
        m="t-2"
        rounded="$bew-radius"
        z="1"
        flex="~ col gap-1"
        w="full"
        max-h-300px
        overflow-y-overlay
        will-change-transform
        transform-gpu
      >
        <div
          v-for="option in options"
          :key="option.value"
          p="x-2 y-2"
          rounded="$bew-radius"
          w="full"
          bg="hover:$bew-fill-2"
          transition="all duration-300"
          cursor="pointer"
          @click="onClickOption(option)"
        >
          <span v-text="option.label" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped></style>
