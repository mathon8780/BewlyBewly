import type { wallpaperItem } from '~/constants/imgs'
import type { HomeSubPage } from '~/contentScripts/views/Home/types'
import type { AppPage } from '~/enums/appEnums'

import type { SeriesDisplayOptions, SeriesStyle } from './seriesSettings'
import { defaultSeriesStyles, parseSeriesStyles } from './seriesSettings'

export interface Settings {
  touchScreenOptimization: boolean
  enableGridLayoutSwitcher: boolean
  enableHorizontalScrolling: boolean

  language: string
  customizeFont: 'default' | 'recommend' | 'custom'
  fontFamily: string
  overrideDanmakuFont: boolean
  removeTheIndentFromChinesePunctuation: boolean

  disableFrostedGlass: boolean
  reduceFrostedGlassBlur: boolean
  disableShadow: boolean

  enableVideoPreview: boolean

  // Link Opening Behavior
  videoCardLinkOpenMode: 'drawer' | 'newTab' | 'currentTab'
  topBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  searchBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  closeDrawerWithoutPressingEscAgain: boolean

  blockAds: boolean
  blockAtComments: boolean
  blockTopSearchPageAds: boolean

  blockRelatedVideos: boolean
  blockVideoActivities: boolean

  enableVideoCtrlBarOnVideoCard: boolean
  hoverVideoCardDelayed: boolean

  // Desktop & Dock
  useOldTopBar: boolean
  autoHideTopBar: boolean
  showTopBarThemeColorGradient: boolean
  showBewlyOrBiliTopBarSwitcher: boolean
  showBewlyOrBiliPageSwitcher: boolean
  topBarIconBadges: 'number' | 'dot' | 'none'
  openNotificationsPageAsDrawer: boolean

  alwaysUseDock: boolean
  autoHideDock: boolean
  halfHideDock: boolean
  dockPosition: 'left' | 'right' | 'bottom'
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: { page: AppPage, visible: boolean }[]
  dockItemsConfig: { page: AppPage, visible: boolean, openInNewTab: boolean, useOriginalBiliPage: boolean }[]
  disableDockGlowingEffect: boolean
  disableLightDarkModeSwitcherOnDock: boolean
  backToTopAndRefreshButtonsAreSeparated: boolean

  sidebarPosition: 'left' | 'right'
  autoHideSidebar: boolean

  theme: 'light' | 'dark' | 'auto'
  themeColor: string
  useLinearGradientThemeColorBackground: boolean
  wallpaperMode: 'buildIn' | 'byUrl'
  wallpaper: string
  enableWallpaperMasking: boolean
  wallpaperMaskOpacity: number
  wallpaperBlurIntensity: number
  locallyUploadedWallpaper: wallpaperItem | null

  customizeCSS: boolean
  customizeCSSContent: string

  searchPageDarkenOnSearchFocus: boolean
  searchPageBlurredOnSearchFocus: boolean
  searchPageLogoColor: 'white' | 'themeColor'
  searchPageLogoGlow: boolean
  searchPageShowLogo: boolean
  searchPageSearchBarFocusCharacter: string
  individuallySetSearchPageWallpaper: boolean
  searchPageWallpaperMode: 'buildIn' | 'byUrl'
  searchPageWallpaper: string
  searchPageEnableWallpaperMasking: boolean
  searchPageWallpaperMaskOpacity: number
  searchPageWallpaperBlurIntensity: number

  recommendationMode: 'web' | 'app'

  // filter setting
  disableFilterForFollowedUser: boolean
  filterOutVerticalVideos: boolean
  enableFilterByViewCount: boolean
  filterByViewCount: number
  enableFilterByDuration: boolean
  filterByDuration: number
  enableFilterByTitle: boolean
  filterByTitle: { keyword: string, remark: string }[]
  enableFilterByUser: boolean
  filterByUser: { keyword: string, remark: string }[]

  followingTabShowLivestreamingVideos: boolean

  seriesStyle: SeriesStyle
  seriesStyles: Record<SeriesStyle, SeriesDisplayOptions>

  homePageTabVisibilityList: { page: HomeSubPage, visible: boolean }[]
  alwaysShowTabsOnHomePage: boolean
  useSearchPageModeOnHomePage: boolean
  searchPageModeWallpaperFixed: boolean

  adaptToOtherPageStyles: boolean
  showTopBar: boolean
  useOriginalBilibiliTopBar: boolean
  useOriginalBilibiliHomepage: boolean
}

export const originalSettings: Settings = {
  touchScreenOptimization: false,
  enableGridLayoutSwitcher: true,
  enableHorizontalScrolling: false,

  language: '',
  customizeFont: 'recommend',
  fontFamily: '',
  overrideDanmakuFont: true,
  removeTheIndentFromChinesePunctuation: false,

  disableFrostedGlass: true,
  reduceFrostedGlassBlur: false,
  disableShadow: false,

  // Link Opening Behavior
  videoCardLinkOpenMode: 'newTab',
  topBarLinkOpenMode: 'currentTabIfNotHomepage',
  searchBarLinkOpenMode: 'currentTabIfNotHomepage',
  closeDrawerWithoutPressingEscAgain: false,

  blockAds: false,
  blockAtComments: false,
  blockTopSearchPageAds: false,

  blockRelatedVideos: false,
  blockVideoActivities: false,

  enableVideoPreview: true,
  enableVideoCtrlBarOnVideoCard: false,
  hoverVideoCardDelayed: false,

  // Desktop & Dock
  useOldTopBar: false,
  autoHideTopBar: false,
  showTopBarThemeColorGradient: true,
  showBewlyOrBiliTopBarSwitcher: true,
  showBewlyOrBiliPageSwitcher: true,
  topBarIconBadges: 'number',
  openNotificationsPageAsDrawer: true,

  alwaysUseDock: false,
  autoHideDock: false,
  halfHideDock: false,
  dockPosition: 'right',
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: [],
  dockItemsConfig: [],
  disableDockGlowingEffect: false,
  disableLightDarkModeSwitcherOnDock: false,
  backToTopAndRefreshButtonsAreSeparated: true,

  sidebarPosition: 'right',
  autoHideSidebar: false,

  theme: 'auto',
  themeColor: '#00a1d6',
  useLinearGradientThemeColorBackground: false,
  wallpaperMode: 'buildIn',
  wallpaper: '',
  enableWallpaperMasking: false,
  wallpaperMaskOpacity: 80,
  wallpaperBlurIntensity: 0,
  locallyUploadedWallpaper: null,

  customizeCSS: false,
  customizeCSSContent: '',

  searchPageDarkenOnSearchFocus: true,
  searchPageBlurredOnSearchFocus: false,
  searchPageLogoColor: 'themeColor',
  searchPageLogoGlow: true,
  searchPageShowLogo: true,
  searchPageSearchBarFocusCharacter: '',
  individuallySetSearchPageWallpaper: false,
  searchPageWallpaperMode: 'buildIn',
  searchPageWallpaper: '',
  searchPageEnableWallpaperMasking: false,
  searchPageWallpaperMaskOpacity: 0,
  searchPageWallpaperBlurIntensity: 0,

  recommendationMode: 'web',

  // filter setting
  disableFilterForFollowedUser: false,
  filterOutVerticalVideos: false,
  enableFilterByViewCount: false,
  filterByViewCount: 10000,
  enableFilterByDuration: false,
  filterByDuration: 3600,
  enableFilterByTitle: false,
  filterByTitle: [],
  enableFilterByUser: false,
  filterByUser: [],

  followingTabShowLivestreamingVideos: false,

  seriesStyle: 'overlay',
  seriesStyles: defaultSeriesStyles(),

  homePageTabVisibilityList: [],
  alwaysShowTabsOnHomePage: false,
  useSearchPageModeOnHomePage: false,
  searchPageModeWallpaperFixed: false,

  adaptToOtherPageStyles: true,
  showTopBar: true,
  useOriginalBilibiliTopBar: false,
  useOriginalBilibiliHomepage: false,
}

const choices: Partial<Record<keyof Settings, readonly string[]>> = {
  seriesStyle: ['overlay', 'poster', 'below'],
  customizeFont: ['default', 'recommend', 'custom'],
  theme: ['light', 'dark', 'auto'],
  videoCardLinkOpenMode: ['drawer', 'newTab', 'currentTab'],
  topBarLinkOpenMode: ['currentTab', 'currentTabIfNotHomepage', 'newTab'],
  searchBarLinkOpenMode: ['currentTab', 'currentTabIfNotHomepage', 'newTab'],
  dockPosition: ['left', 'right', 'bottom'],
  sidebarPosition: ['left', 'right'],
  topBarIconBadges: ['number', 'dot', 'none'],
  recommendationMode: ['web', 'app'],
  wallpaperMode: ['buildIn', 'byUrl'],
  searchPageWallpaperMode: ['buildIn', 'byUrl'],
  searchPageLogoColor: ['white', 'themeColor'],
  language: ['', 'en', 'cmn-CN', 'cmn-TW', 'jyut'],
}

export function parseSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid settings')
  const result = structuredClone(originalSettings)
  for (const key of Object.keys(result) as (keyof Settings)[]) {
    if (!Object.hasOwn(input, key))
      continue
    const supplied = (input as Record<string, unknown>)[key]
    if (key === 'seriesStyles') {
      result.seriesStyles = parseSeriesStyles(supplied)
      continue
    }
    const value = key === 'customizeFont' && typeof supplied === 'boolean' ? 'recommend' : supplied
    const fallback = result[key]
    const valid = Array.isArray(fallback)
      ? Array.isArray(value)
      : fallback === null
        ? value === null
        || (typeof value === 'object'
          && value !== null
          && typeof (value as wallpaperItem).url === 'string'
          && typeof (value as wallpaperItem).name === 'string')
        : typeof value === typeof fallback
    if (!valid || (choices[key] && !choices[key]!.includes(value as string)))
      throw new Error(`Invalid setting: ${key}`)
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || (key.endsWith('Opacity') && value > 100)))
      throw new Error(`Invalid setting: ${key}`)
    if (
      Array.isArray(value)
      && !value.every(
        item =>
          item
          && typeof item === 'object'
          && (key.startsWith('filterBy')
            ? typeof item.keyword === 'string' && typeof item.remark === 'string'
            : typeof item.page === 'string'
              && typeof item.visible === 'boolean'
              && (key !== 'dockItemsConfig'
                || (typeof item.openInNewTab === 'boolean' && typeof item.useOriginalBiliPage === 'boolean'))),
      )
    ) {
      throw new Error(`Invalid setting: ${key}`)
    }
    Object.assign(result, { [key]: value })
  }
  if (!/^#[\da-f]{6}$/i.test(result.themeColor))
    throw new Error('Invalid setting: themeColor')
  return result
}
