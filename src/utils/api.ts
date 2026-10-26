import browser from 'webextension-polyfill'

import type { API_COLLECTION } from '~/background/messageListeners/api'
import type { WatchListResult } from '~/models/anime/watchList'
import type { HistoryResult } from '~/models/history/history'
import type { VideoInfo } from '~/models/video/videoInfo'
import type { VideoPreviewResult } from '~/models/video/videoPreview'

interface Responses {
  getAnimeWatchList: WatchListResult
  getHistoryList: HistoryResult
  getVideoInfo: VideoInfo
  getVideoPreview: VideoPreviewResult
}
type Params<E> = (E extends { params: infer P } ? P : unknown) & (E extends { _fetch: { body: infer B } } ? B : unknown)
type Client = {
  [K in keyof typeof API_COLLECTION as K extends string ? Lowercase<K> : never]: {
    [P in keyof (typeof API_COLLECTION)[K]]: (
      options?: Partial<Params<(typeof API_COLLECTION)[K][P]>>,
      request?: { signal: AbortSignal },
    ) => Promise<P extends keyof Responses ? Responses[P] : any>
  }
}

async function send(query: string, params: object = {}, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const requestId = signal ? crypto.randomUUID() : undefined
  const cancel = () => {
    void browser.runtime.sendMessage({ cancelRequest: requestId }).catch(console.error)
  }
  const response = browser.runtime.sendMessage({ ...params, contentScriptQuery: query, requestId })
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    return await response
  }
  finally {
    signal?.removeEventListener('abort', cancel)
  }
}

const namespaces = new Map<PropertyKey, object>()
const api = new Proxy({} as Client, {
  get(_, namespace) {
    if (!namespaces.has(namespace)) {
      namespaces.set(
        namespace,
        new Proxy(
          {},
          {
            get: (_, query: string) => (params?: object, request?: { signal: AbortSignal }) =>
              send(query, params, request?.signal),
          },
        ),
      )
    }
    return namespaces.get(namespace)
  },
})
export default api
