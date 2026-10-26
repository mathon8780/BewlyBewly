import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'

import type PkgType from '../package.json'
import { isDev, isFirefox, isSafari, port, r } from '../scripts/utils'

export async function getManifest() {
  const pkg = (await fs.readJSON(r('package.json'))) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: `${pkg.displayName || pkg.name}${isDev ? ' Dev' : ''}`,
    version: pkg.version,
    description: pkg.description,
    homepage_url: pkg.homepage,
    // action: {
    //   default_icon: './assets/icon-512.png',
    //   default_popup: './dist/popup/index.html',
    // },
    // options_ui: {
    //   page: './dist/options/index.html',
    //   open_in_tab: true,
    // },

    // Setting `persistent` to true in Manifest V3 results in an error in Firefox
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
    background:
      isFirefox || isSafari
        ? { scripts: ['./dist/background/index.js'], persistent: isFirefox ? undefined : false }
        : { service_worker: './dist/background/index.js' },

    icons: {
      512: './assets/icon-512.png',
    },
    permissions: [
      'storage',
      'declarativeNetRequest',
      ...(isFirefox ? ['webRequest', 'webRequestBlocking', 'cookies'] : []),
    ],
    host_permissions: ['*://*.bilibili.com/*', '*://*.hdslb.com/*'],
    content_scripts: [
      {
        matches: [
          '*://www.bilibili.com/*',
          '*://search.bilibili.com/*',
          '*://t.bilibili.com/*',
          '*://space.bilibili.com/*',
          '*://message.bilibili.com/*',
          '*://member.bilibili.com/*',
          '*://account.bilibili.com/*',
          '*://www.hdslb.com/*',
          '*://passport.bilibili.com/*',
          '*://music.bilibili.com/*',
        ],
        js: ['./dist/contentScripts/index.global.js'],
        run_at: 'document_start',
        match_about_blank: true,
        all_frames: true,
      },
      {
        matches: [
          '*://www.bilibili.com/*',
          '*://search.bilibili.com/*',
          '*://t.bilibili.com/*',
          '*://space.bilibili.com/*',
          '*://message.bilibili.com/*',
          '*://member.bilibili.com/*',
          '*://account.bilibili.com/*',
          '*://www.hdslb.com/*',
          '*://passport.bilibili.com/*',
          '*://music.bilibili.com/*',
        ],
        js: ['./dist/inject/index.js'],
        run_at: 'document_start',
        all_frames: true,
        world: 'MAIN',
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          'dist/contentScripts/*.js',
          'dist/contentScripts/chunks/*.js',
          'dist/contentScripts/styles/*.css',
          'assets/*',
        ],
        matches: ['*://*.bilibili.com/*', '*://*.hdslb.com/*'],
        // matches: ['./assets/*'],
      },
    ],
    content_security_policy: isFirefox
      ? {
          extension_pages: 'script-src \'self\'; object-src \'self\'',
        }
      : {
          extension_pages: isDev
            ? `script-src 'self' http://localhost:${port}; object-src 'self' http://localhost:${port}`
            : 'script-src \'self\'; object-src \'self\'',
        },
    ...(isFirefox
      ? {}
      : {
          declarative_net_request: {
            rule_resources: [
              {
                id: 'ruleset_1',
                enabled: true,
                path: 'assets/rules.json',
              },
            ],
          },
        }),
  }

  if (isDev)
    manifest.permissions?.push('webNavigation')

  if (isFirefox) {
    const gecko: NonNullable<Manifest.WebExtensionManifest['browser_specific_settings']>['gecko'] = {
      id: 'mathon@bewlybewly.com',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: [
          'authenticationInfo',
          'personallyIdentifyingInfo',
          'websiteContent',
          'websiteActivity',
          'searchTerms',
        ],
      },
    }
    manifest.browser_specific_settings = {
      gecko,
      gecko_android: { strict_min_version: '142.0' },
    }
  }

  return manifest
}
