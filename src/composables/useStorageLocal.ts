import type { MaybeRef, RemovableRef, UseStorageAsyncOptions } from '@vueuse/core'
import { StorageSerializers } from '@vueuse/core'
import { ref, shallowRef, toRaw, unref, watch } from 'vue'
import browser from 'webextension-polyfill'

interface LocalStorageOptions<T> extends UseStorageAsyncOptions<T> {
  debounce?: number
  migrate?: (raw: string) => boolean
}

export type ReadyStorageRef<T> = RemovableRef<T> & { ready: Promise<void>, flush: () => Promise<void> }

export function useStorageLocal<T>(
  key: string,
  initialValue: MaybeRef<T>,
  options: LocalStorageOptions<T> = {},
): ReadyStorageRef<T> {
  const defaults = structuredClone(toRaw(unref(initialValue)))
  const data = (options.shallow ? shallowRef(defaults) : ref(defaults)) as unknown as ReadyStorageRef<T>
  const serializer
    = options.serializer
      ?? (typeof defaults === 'object'
        ? StorageSerializers.object
        : StorageSerializers[typeof defaults as 'string' | 'number' | 'boolean'])
  const object = defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults)
  const onError = options.onError ?? console.error
  const dirty = new Map<string, number>()
  const snapshot = () => structuredClone(toRaw(data.value))
  let previous = snapshot()
  let revision = 0
  let applying = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let writes = Promise.resolve()
  let updates = Promise.resolve()

  const read = async (raw: unknown): Promise<T> => {
    const value = raw == null ? structuredClone(defaults) : await serializer.read(raw as string)
    return options.mergeDefaults && object ? { ...defaults, ...value } : value
  }
  function apply(value: T) {
    applying = true
    data.value = value
    previous = snapshot()
    applying = false
  }
  data.flush = () => {
    clearTimeout(timer)
    timer = undefined
    const result = writes.then(async () => {
      if (!dirty.size)
        return
      const fields = new Map(dirty)
      const value = snapshot()
      const raw = value == null ? null : await serializer.write(value)
      const serialized = object && raw !== null ? JSON.parse(raw) : undefined
      const patch = serialized && Object.fromEntries([...fields.keys()].map(field => [field, serialized[field]]))
      await browser.runtime.sendMessage({ storageWrite: { key, raw, patch } })
      for (const [field, version] of fields) {
        if (dirty.get(field) === version)
          dirty.delete(field)
      }
    })
    writes = result.catch(onError)
    return result
  }
  data.ready = (async () => {
    const raw = (await browser.storage.local.get(key))[key]
    apply(
      await read(raw).catch((error) => {
        onError(error)
        return structuredClone(defaults)
      }),
    )
    watch(
      data,
      () => {
        if (applying)
          return
        const value = snapshot()
        for (const field of object ? Object.keys(value as object) : ['value']) {
          if (
            !object
            || ((value as any)[field] !== (previous as any)[field]
              && JSON.stringify((value as any)[field]) !== JSON.stringify((previous as any)[field]))
          ) {
            dirty.set(field, ++revision)
          }
        }
        previous = value
        clearTimeout(timer)
        if (options.debounce) {
          timer = setTimeout(() => {
            void data.flush().catch(onError)
          }, options.debounce)
        }
        else {
          void data.flush().catch(onError)
        }
      },
      { deep: options.deep ?? true, flush: 'sync' },
    )
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[key])
        return
      updates = updates
        .then(async () => {
          const incoming = await read(changes[key].newValue)
          if (object) {
            for (const field of dirty.keys()) (incoming as any)[field] = (data.value as any)[field]
            apply(incoming)
          }
          else if (!dirty.size) {
            apply(incoming)
          }
        })
        .catch(onError)
    })
    if ((raw == null && options.writeDefaults !== false) || (raw != null && options.migrate?.(raw as string))) {
      for (const field of object ? Object.keys(data.value as object) : ['value']) dirty.set(field, ++revision)
      await data.flush()
    }
  })().catch(onError)
  window.addEventListener('pagehide', () => {
    if (timer)
      void data.flush().catch(onError)
  })
  return data
}
