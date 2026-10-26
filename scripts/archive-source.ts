import { execFileSync } from 'node:child_process'

const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' })
if (changes.trim())
  throw new Error('Commit the source changes before creating a release source archive.')
execFileSync('git', ['archive', '--format=zip', '--output=extension-firefox-sources.zip', 'HEAD'])
