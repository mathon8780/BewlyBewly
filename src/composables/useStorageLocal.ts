import type { MaybeRef, RemovableRef, UseStorageAsyncOptions } from '@vueuse/core'
import { StorageSerializers } from '@vueuse/core'
import { ref, shallowRef, unref, watch } from 'vue'
import { storage } from 'webextension-polyfill'

interface LocalStorageOptions<T> extends UseStorageAsyncOptions<T> {
  debounce?: number
  migrate?: (raw: string) => boolean
}

export type ReadyStorageRef<T> = RemovableRef<T> & { ready: Promise<void>, flush: () => Promise<void> }

/** Hydrate before watching, and serialize only when a coalesced write is due. */
export function useStorageLocal<T>(key: string, initialValue: MaybeRef<T>, options: LocalStorageOptions<T> = {}): ReadyStorageRef<T> {
  const defaults = unref(initialValue)
  const data = (options.shallow ? shallowRef(defaults) : ref(defaults)) as ReadyStorageRef<T>
  const serializer = options.serializer ?? (typeof defaults === 'object' ? StorageSerializers.object : StorageSerializers[typeof defaults as 'string' | 'number' | 'boolean'])
  const onError = options.onError ?? console.error
  let timer: ReturnType<typeof setTimeout> | undefined
  let writes = Promise.resolve()

  data.flush = () => {
    clearTimeout(timer)
    timer = undefined
    // Keep writes ordered, including async image migration/serialization.
    writes = writes.then(async () => {
      if (data.value == null)
        await storage.local.remove(key)
      else
        await storage.local.set({ [key]: await serializer.write(data.value) })
    }).catch(onError)
    return writes
  }

  data.ready = (async () => {
    try {
      const raw = (await storage.local.get(key))[key]
      if (raw != null) {
        const value = await serializer.read(raw)
        data.value = typeof options.mergeDefaults === 'function'
          ? options.mergeDefaults(value, defaults)
          : options.mergeDefaults && defaults && typeof defaults === 'object' && !Array.isArray(defaults)
            ? { ...defaults, ...value }
            : value
        if (options.migrate?.(raw))
          await data.flush()
      }
      else if (options.writeDefaults !== false) {
        await data.flush()
      }
    }
    catch (error) {
      onError(error)
    }
    watch(data, () => {
      if (options.debounce) {
        clearTimeout(timer)
        timer = setTimeout(data.flush, options.debounce)
      }
      else {
        void data.flush()
      }
    }, { deep: options.deep ?? true, flush: options.flush ?? 'pre' })
  })()

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      if (timer)
        void data.flush()
    })
  }
  return data
}
