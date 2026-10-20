/** Keep this function self-contained: the content bootstrap embeds its source. */
export function supportsContentScript(href: string, inIframe: boolean): boolean {
  const url = new URL(href)
  const { hostname, pathname } = url
  if (!/^https?:$/.test(url.protocol))
    return false

  if (inIframe) {
    return (hostname === 'www.bilibili.com' && (
      pathname === '/' || pathname === '/index.html' || /^\/(?:video|bangumi\/play|anime|history|account\/history|watchlater|list)\b/.test(pathname)
    )) || (hostname === 'search.bilibili.com' && /^\/all\b/.test(pathname))
    || (hostname === 'space.bilibili.com' && /^\/\d+\/favlist\b/.test(pathname))
    || (hostname === 't.bilibili.com' && !/^\/(?:vote|share)\b/.test(pathname))
    || hostname === 'message.bilibili.com'
  }

  if (hostname === 'www.bilibili.com') {
    return pathname === '/' || pathname === '/index.html' || /^\/(?:video|bangumi\/play|list|v|opus|history|account\/history|watchlater|anime|guochuang|tv|movie|variety|mooc|documentary|read|404)\b/.test(pathname)
  }
  if (['search.bilibili.com', 'space.bilibili.com', 'message.bilibili.com', 'account.bilibili.com'].includes(hostname))
    return true
  if (hostname === 't.bilibili.com')
    return !/^\/(?:vote|share)\b/.test(pathname)
  if (hostname === 'member.bilibili.com')
    return /^\/platform\b/.test(pathname)
  if (hostname === 'passport.bilibili.com')
    return /^\/login\b/.test(pathname)
  return hostname === 'music.bilibili.com' && /^\/pc\/music-center\b/.test(pathname)
}
