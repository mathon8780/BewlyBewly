const SEARCH_HISTORY_LIMIT = 20

export interface HistoryItem {
  value: string
  timestamp: number
}
export interface SuggestionItem {
  value: string
  term: string
  name: string
  type: string
  ref: number
  spid: number
  timestamp: number
}
export interface SuggestionResponse {
  code: number
  exp_str: string
  result: {
    tag: SuggestionItem[]
  }
  stoken: string
}

function historySort(historyItems: HistoryItem[]) {
  historyItems.sort((a, b) => b.timestamp - a.timestamp)
  return historyItems
}

export interface BilibiliStorageEvent {
  type: 'COLS_RES'
  id?: string
  key: string
  value: string
}

class BilibiliStorageProvider {
  static BILIBILI_HISTORY_KEY = 'search_history:search_history'

  private async operate(type: 'COLS_GET'): Promise<BilibiliStorageEvent | undefined>
  private async operate(type: 'COLS_SET', value: string): Promise<void>
  private async operate(type: 'COLS_CLR'): Promise<void>
  private async operate(type: 'COLS_GET' | 'COLS_CLR' | 'COLS_SET', value?: string): Promise<BilibiliStorageEvent | void> {
    // Resolve each time: the host may replace the iframe after navigation.
    const iframe = Array.from(document.getElementsByTagName('iframe')).find(i => i.src.startsWith('https://s1.hdslb.com/bfs/seed/jinkela/short/cols/iframe.html'))
    const target = iframe?.contentWindow
    if (!target)
      return
    const origin = 'https://s1.hdslb.com'
    const key = BilibiliStorageProvider.BILIBILI_HISTORY_KEY
    if (type === 'COLS_GET') {
      return new Promise<BilibiliStorageEvent | undefined>((resolve) => {
        let timer: ReturnType<typeof setTimeout>
        let onMessage: (event: MessageEvent<BilibiliStorageEvent>) => void
        const finish = (result?: BilibiliStorageEvent) => {
          clearTimeout(timer)
          window.removeEventListener('message', onMessage)
          resolve(result)
        }
        onMessage = (event: MessageEvent<BilibiliStorageEvent>) => {
          if (event.origin === origin && event.source === target && event.data?.type === 'COLS_RES' && event.data.key === key)
            finish(event.data)
        }
        timer = setTimeout(() => finish(), 2000)
        // Listen before posting, and ignore unrelated messages without removing the listener.
        window.addEventListener('message', onMessage)
        try {
          target.postMessage({ type, key }, origin)
        }
        catch {
          finish()
        }
      })
    }
    target.postMessage({ type, key: type === 'COLS_CLR' ? 'search_history' : key, value }, origin)
  }

  getSearchHistory() {
    return this.operate('COLS_GET')
  }

  clearSearchHistory() {
    return this.operate('COLS_CLR')
  }

  addSearchHistory(value: string) {
    return this.operate('COLS_SET', value)
  }

  removeSearchHistory(value: string) {
    return this.operate('COLS_SET', value)
  }
}

const provider = new BilibiliStorageProvider()

export async function getSearchHistory(): Promise<HistoryItem[]> {
  const e = await provider.getSearchHistory()

  if (!e)
    return []

  try {
    const history = JSON.parse(e.value)
    return Array.isArray(history)
      ? historySort(history.filter(item => typeof item?.value === 'string' && typeof item?.timestamp === 'number')).slice(0, SEARCH_HISTORY_LIMIT)
      : []
  }
  catch (error) {
    return []
  }
}

export async function addSearchHistory(historyItem: HistoryItem) {
  let history = await getSearchHistory()

  let hasSameValue = false
  history.forEach((item) => {
    if (item.value === historyItem.value) {
      item.timestamp = historyItem.timestamp
      hasSameValue = true
    }
  })
  if (!hasSameValue)
    history.unshift(historyItem)

  // if out of limit, remove overflow items
  history = history.filter((item, index) => {
    if (index < SEARCH_HISTORY_LIMIT)
      return item
    else
      return false
  })

  await provider.addSearchHistory(JSON.stringify(history))
  return history
}

export async function removeSearchHistory(value: string) {
  let history = await getSearchHistory()
  history = history.filter(item => item.value !== value)
  await provider.removeSearchHistory(JSON.stringify(history))
  return history
}

export async function clearAllSearchHistory() {
  return provider.clearSearchHistory()
}
