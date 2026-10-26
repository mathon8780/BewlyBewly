import browser from 'webextension-polyfill'

interface StorageWrite {
  key: string
  raw: string | null
  patch?: Record<string, unknown>
}

export function setupStorageMessages() {
  let writes = Promise.resolve()
  browser.runtime.onMessage.addListener((message: unknown) => {
    const update = (message as { storageWrite?: StorageWrite })?.storageWrite
    if (!update)
      return
    const result = writes.then(async () => {
      const { key, raw, patch } = update
      if (raw === null) {
        await browser.storage.local.remove(key)
      }
      else {
        const stored = (await browser.storage.local.get(key))[key]
        const value = patch ? JSON.stringify({ ...(stored ? JSON.parse(stored as string) : {}), ...patch }) : raw
        await browser.storage.local.set({ [key]: value })
      }
    })
    writes = result.catch(console.error)
    return result
  })
}
