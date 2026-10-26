import './manifest'

import { execFileSync } from 'node:child_process'
import { execPath } from 'node:process'

import chokidar from 'chokidar'
import fs from 'fs-extra'

import { isDev, isFirefox, isSafari, r } from './utils'

const directory = r(isFirefox ? 'extension-firefox' : isSafari ? 'extension-safari' : 'extension')
fs.ensureDirSync(directory)
fs.copySync(r('assets'), r(directory, 'assets'))

if (isDev) {
  chokidar.watch([r('src/manifest.ts'), r('package.json')]).on('change', () => {
    execFileSync(execPath, [r('node_modules/esno/esno.js'), r('scripts/manifest.ts')], { stdio: 'inherit' })
  })
}
