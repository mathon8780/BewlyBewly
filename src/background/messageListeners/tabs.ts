import browser from 'webextension-polyfill'

interface Message {
  contentScriptQuery: string
  [key: string]: any
}

export enum TABS_MESSAGE {
  OPEN_LINK_IN_BACKGROUND = 'openLinkInBackground',
}

function handleMessage(message: Message | null | undefined) {
  if (message?.contentScriptQuery === TABS_MESSAGE.OPEN_LINK_IN_BACKGROUND) {
    return browser.tabs.create({ url: message.url, active: false })
  }
}

export function setupTabMsgLstnrs() {
  // Register synchronously so a cold worker can serve its very first message.
  browser.runtime.onMessage.removeListener(handleMessage)
  browser.runtime.onMessage.addListener(handleMessage)
}
