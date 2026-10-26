import { useStorageLocal } from '~/composables/useStorageLocal'

import type { Settings } from './settings'
import { originalSettings } from './settings'
import { needsWallpaperMigration, wallpaperSettingsSerializer } from './wallpaperStorage'

export type { Settings } from './settings'
export { originalSettings } from './settings'

export const storageDemo = useStorageLocal('webext-demo', 'Storage Demo')
export const accessKey = useStorageLocal('accessKey', '')

export const settings = useStorageLocal('settings', ref<Settings>(structuredClone(originalSettings)), {
  mergeDefaults: true,
  debounce: 200,
  serializer: wallpaperSettingsSerializer,
  migrate: needsWallpaperMigration,
})

export type GridLayoutType = 'adaptive' | 'twoColumns' | 'oneColumn'

export interface GridLayout {
  home: GridLayoutType
}

export const gridLayout = useStorageLocal(
  'gridLayout',
  ref<GridLayout>({
    home: 'adaptive',
  }),
  { mergeDefaults: true, debounce: 200 },
)

export const sidePanel = useStorageLocal(
  'sidePanel',
  ref<{
    home: boolean
  }>({
    home: true,
  }),
  { mergeDefaults: true, debounce: 200 },
)

// Readiness includes legacy image migration, layout defaults and auth hydration.
export const settingsReady: Promise<void> = Promise.all([
  settings.ready,
  gridLayout.ready,
  sidePanel.ready,
  accessKey.ready,
]).then(() => {})
