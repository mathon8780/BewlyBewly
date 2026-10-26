import md5 from 'md5'
import { storage } from 'webextension-polyfill'

import type { Settings } from './settings'
import { parseSettings } from './settings'

const PREFIX = 'bewly-wallpaper:'
const CREATED = 'bewly-wallpaper-time:'
const savedImages = new Map<string, string>()
const persistedImages = new Set<string>()
const pendingImages = new Map<string, Promise<void>>()

storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(PREFIX) && change.newValue === undefined) {
        savedImages.delete(key)
        persistedImages.delete(key)
      }
    }
  }
})

function rememberImage(key: string, url: string) {
  savedImages.set(key, url)
  let bytes = [...savedImages.values()].reduce((sum, value) => sum + value.length, 0)
  for (const [oldKey, value] of savedImages) {
    if (bytes <= 4 * 1024 * 1024)
      break
    savedImages.delete(oldKey)
    bytes -= value.length
  }
}

async function storeImage(url: string): Promise<string> {
  if (!url.startsWith('data:image/'))
    return url
  for (const [key, value] of savedImages) {
    if (value === url)
      return key
  }
  const key = `${PREFIX}${md5(url)}`
  if (!persistedImages.has(key)) {
    let pending = pendingImages.get(key)
    if (!pending) {
      pending = storage.local.set({ [key]: url, [CREATED + key]: Date.now() })
      pendingImages.set(key, pending)
    }
    try {
      await pending
      persistedImages.add(key)
      rememberImage(key, url)
    }
    finally {
      pendingImages.delete(key)
    }
  }
  return key
}

async function loadImage(url: string): Promise<string> {
  if (!url.startsWith(PREFIX))
    return url
  const image = savedImages.get(url) ?? (await storage.local.get(url))[url]
  if (typeof image !== 'string')
    return ''
  persistedImages.add(url)
  rememberImage(url, image)
  return image
}

export async function persistWallpaper(dataUrl: string): Promise<void> {
  await storeImage(dataUrl)
}

export async function wallpaperBytes(): Promise<number> {
  const items = await storage.local.get(null)
  return Object.entries(items).reduce(
    (sum, [key, value]) => sum + (key.startsWith(PREFIX) ? key.length + String(value).length : 0),
    0,
  )
}

/** 显式清理以已保存的设置引用为准。 */
export async function cleanupWallpapers(): Promise<void> {
  const items = await storage.local.get(null)
  const settings = JSON.parse((items.settings as string) || '{}')
  const used = new Set([
    settings.wallpaper,
    settings.searchPageWallpaper,
    settings.locallyUploadedWallpaper?.url,
    settings.locallyUploadedWallpaper?.thumbnail,
  ])
  const unused = Object.keys(items).filter(
    key => key.startsWith(PREFIX) && !used.has(key) && Number(items[CREATED + key] || 0) < Date.now() - 60000,
  )
  await storage.local.remove(unused.flatMap(key => [key, CREATED + key]))
  savedImages.clear()
  persistedImages.clear()
}

export function needsWallpaperMigration(raw: string): boolean {
  const value = JSON.parse(raw)
  return [
    value.wallpaper,
    value.searchPageWallpaper,
    value.locallyUploadedWallpaper?.url,
    value.locallyUploadedWallpaper?.thumbnail,
  ].some(url => typeof url === 'string' && url.startsWith('data:image/'))
}

/**
 * Separate extension-storage keys retain data URLs for cross-origin content scripts.
 * This avoids IndexedDB's per-site origin and Blob URL lifetime issues. Images are
 * written once; ordinary settings writes contain small references. Unreferenced
 * images are retained so another tab or an imported settings file can still use them.
 */
export const wallpaperSettingsSerializer = {
  async read(raw: string): Promise<Settings> {
    const value = parseSettings(JSON.parse(raw))
    for (const field of ['wallpaper', 'searchPageWallpaper'] as const) {
      if (typeof value[field] === 'string')
        value[field] = await loadImage(value[field])
    }
    if (value.locallyUploadedWallpaper) {
      value.locallyUploadedWallpaper.url = await loadImage(value.locallyUploadedWallpaper.url || '')
      if (value.locallyUploadedWallpaper.thumbnail)
        value.locallyUploadedWallpaper.thumbnail = await loadImage(value.locallyUploadedWallpaper.thumbnail)
    }
    return value
  },
  async write(value: Settings): Promise<string> {
    const result = {
      ...value,
      locallyUploadedWallpaper: value.locallyUploadedWallpaper ? { ...value.locallyUploadedWallpaper } : null,
    }
    const [wallpaper, searchPageWallpaper, local, thumbnail] = await Promise.all([
      storeImage(result.wallpaper),
      storeImage(result.searchPageWallpaper),
      storeImage(result.locallyUploadedWallpaper?.url || ''),
      storeImage(result.locallyUploadedWallpaper?.thumbnail || ''),
    ])
    result.wallpaper = wallpaper
    result.searchPageWallpaper = searchPageWallpaper
    if (result.locallyUploadedWallpaper) {
      result.locallyUploadedWallpaper.url = local
      if (thumbnail)
        result.locallyUploadedWallpaper.thumbnail = thumbnail
    }
    return JSON.stringify(result)
  },
}
