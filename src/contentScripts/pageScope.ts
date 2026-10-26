export function getPageType(href: string) {
  const { hostname: host, pathname: path, protocol } = new URL(href)
  if (!/^https?:$/.test(protocol))
    return ''
  if (host === 'www.bilibili.com' || host === 'bilibili.com') {
    if (path === '/' || path === '/index.html')
      return 'homePage'
    if (/^\/(?:video|list)\b/.test(path))
      return 'videoPage'
    if (/^\/bangumi\/play\b/.test(path))
      return 'animePlayback&MoviePage'
    if (/^\/(?:account\/)?history\b/.test(path))
      return 'historyPage'
    if (/^\/watchlater\b/.test(path))
      return 'watchLaterPage'
    if (/^\/opus\b/.test(path))
      return 'momentsPage'
    if (/^\/v\/topic\/detail\b/.test(path))
      return 'topicPage'
    if (/^\/(?:v|tv|movie|variety|mooc|documentary)\b/.test(path))
      return 'channelPage'
    if (/^\/(?:anime|guochuang)\b/.test(path))
      return 'animePage'
    if (/^\/read\b/.test(path))
      return 'articlesPage'
    if (/^\/404\b/.test(path))
      return 'error404Page'
  }
  if (host === 'search.bilibili.com')
    return 'searchPage'
  if (host === 'message.bilibili.com')
    return 'notificationsPage'
  if (host === 'space.bilibili.com')
    return /\/v\/note-list/.test(path) ? 'notePage' : 'userSpacePage'
  if (host === 't.bilibili.com' && !/^\/(?:vote|share)\b/.test(path))
    return 'momentsPage'
  if (host === 'member.bilibili.com' && /^\/platform\b/.test(path))
    return 'creativeCenterPage'
  if (host === 'account.bilibili.com')
    return /^\/big/.test(path) ? 'premiumPage' : 'accountSettingsPage'
  if (host === 'passport.bilibili.com' && /^\/login\b/.test(path))
    return 'loginPage'
  if (host === 'music.bilibili.com' && /^\/pc\/music-center\b/.test(path))
    return 'musicPage'
  return ''
}

export function supportsContentScript(href: string, inIframe: boolean): boolean {
  const page = getPageType(href)
  if (!inIframe)
    return !!page
  if (page === 'searchPage')
    return new URL(href).pathname.startsWith('/all')
  if (page === 'userSpacePage')
    return /^\/\d+\/favlist\b/.test(new URL(href).pathname)
  return [
    'homePage',
    'videoPage',
    'animePlayback&MoviePage',
    'animePage',
    'historyPage',
    'watchLaterPage',
    'momentsPage',
    'notificationsPage',
  ].includes(page)
}
