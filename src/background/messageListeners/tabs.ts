import browser from 'webextension-polyfill'

interface Message {
  contentScriptQuery: string
  [key: string]: any
}

export enum TABS_MESSAGE {
  OPEN_LINK_IN_BACKGROUND = 'openLinkInBackground',
}

function handleMessage(input: unknown) {
  const message = input as Message | undefined
  if (message?.contentScriptQuery === TABS_MESSAGE.OPEN_LINK_IN_BACKGROUND) {
    const url = new URL(message.url)
    if (url.protocol === 'https:' || url.protocol === 'http:')
      return browser.tabs.create({ url: url.href, active: false })
  }
}

export function setupTabMsgLstnrs() {
  // Register synchronously so a cold worker can serve its very first message.
  browser.runtime.onMessage.removeListener(handleMessage)
  browser.runtime.onMessage.addListener(handleMessage)
}
