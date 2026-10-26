import './common'
import './shadowDom'
import './thirdParties'

import { getPageType } from '~/contentScripts/pageScope'
import { settings, settingsReady } from '~/logic/storage'
import { isInIframe } from '~/utils/main'

const styles = import.meta.glob('./pages/*.scss')
async function setupStyles() {
  const page = getPageType(location.href)
  const load = styles[`./pages/${page}.scss`]
  if (!load)
    return
  await settingsReady
  if (!settings.value.adaptToOtherPageStyles)
    return
  if (page === 'creativeCenterPage') {
    await import('./forceDark.scss')
    document.documentElement.classList.add('forceDark')
  }
  await load()
  document.documentElement.classList.add(page === 'animePlayback&MoviePage' ? 'animePlaybackAndMoviePage' : page)
  if (page === 'notificationsPage' && isInIframe() && settings.value.openNotificationsPageAsDrawer)
    document.documentElement.classList.add('drawer')
}
void setupStyles().catch(console.error)
