import md5 from 'md5'
import { storage } from 'webextension-polyfill'

import type { Settings } from './storage'

const PREFIX = 'bewly-wallpaper:'
const savedImages = new Map<string, string>()
const pendingImages = new Map<string, Promise<void>>()

function rememberImage(key: string, url: string) {
  savedImages.set(key, url)
  if (savedImages.size > 8)
    savedImages.delete(savedImages.keys().next().value!)
}

async function storeImage(url: string): Promise<string> {
  if (!url.startsWith('data:image/'))
    return url
  for (const [key, value] of savedImages) {
    if (value === url)
      return key
  }
  const key = `${PREFIX}${md5(url)}`
  if (!savedImages.has(key)) {
    let pending = pendingImages.get(key)
    if (!pending) {
      pending = storage.local.set({ [key]: url })
      pendingImages.set(key, pending)
    }
    try {
      await pending
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
  rememberImage(url, image)
  return image
}

export async function persistWallpaper(dataUrl: string): Promise<void> {
  await storeImage(dataUrl)
}

export function needsWallpaperMigration(raw: string): boolean {
  const value = JSON.parse(raw)
  return [value.wallpaper, value.searchPageWallpaper, value.locallyUploadedWallpaper?.url, value.locallyUploadedWallpaper?.thumbnail]
    .some(url => typeof url === 'string' && url.startsWith('data:image/'))
}

/**
 * Separate extension-storage keys retain data URLs for cross-origin content scripts.
 * This avoids IndexedDB's per-site origin and Blob URL lifetime issues. Images are
 * written once; ordinary settings writes contain small references. Unreferenced
 * images are retained so another tab or an imported settings file can still use them.
 */
export const wallpaperSettingsSerializer = {
  async read(raw: string): Promise<Settings> {
    const value = JSON.parse(raw)
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
    const result = { ...value, locallyUploadedWallpaper: value.locallyUploadedWallpaper ? { ...value.locallyUploadedWallpaper } : null }
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
