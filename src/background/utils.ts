// 对于fetch的常见后处理
// 1. 直接返回data
// 2. json化后返回data

import md5 from 'md5'
import type Browser from 'webextension-polyfill'
import browser from 'webextension-polyfill'

type FetchAfterHandler = ((data: Response) => Promise<any>) | ((data: any) => any)

function toJsonHandler(data: Response): Promise<any> {
  return data.json()
}
function toData(data: Promise<any>): Promise<any> {
  return data
}

// if need sendResponse, use this
// return a FetchAfterHandler function
function sendResponseHandler(sendResponse: Function) {
  return (data: any) => sendResponse(data)
}

// 定义后处理流
const AHS: {
  J_D: FetchAfterHandler[]
  J_S: FetchAfterHandler[]
  S: FetchAfterHandler[]
} = {
  J_D: [toJsonHandler, toData],
  J_S: [toJsonHandler, sendResponseHandler],
  S: [sendResponseHandler],
}

interface Message {
  contentScriptQuery: string
  [key: string]: any
}

interface _FETCH {
  method: string
  headers?: {
    [key: string]: any
  }
  body?: any
}

interface API {
  url: string
  _fetch: _FETCH
  params?: {
    [key: string]: any
  }
  afterHandle: FetchAfterHandler[]
}
// 重载API 可以为函数
type APIFunction = (message: Message, sender?: any, sendResponse?: Function) => any
export type APIType = API | APIFunction
interface APIMAP {
  [key: string]: APIType
}
// 工厂函数API_LISTENER_FACTORY
function apiListenerFactory(API_MAP: APIMAP) {
  // Keep this outer function synchronous: Promise<undefined> claims unrelated
  // messages and can race another listener's actual response.
  return (message: Message | null | undefined, sender?: Browser.Runtime.MessageSender, sendResponse?: Function) => {
    const contentScriptQuery = message?.contentScriptQuery
    if (!contentScriptQuery || !Object.prototype.hasOwnProperty.call(API_MAP, contentScriptQuery))
      return
    if (API_MAP[contentScriptQuery] instanceof Function)
      return (API_MAP[contentScriptQuery] as APIFunction)(message, sender, sendResponse)

    const api = API_MAP[contentScriptQuery] as API

    // Chromium has no cookies permission. Without a reliable account snapshot,
    // skip deduplication so even a login change in one tab cannot reuse a GET.
    // eslint-disable-next-line node/prefer-global/process
    if (!process.env.FIREFOX)
      return doRequest(message!, api, sendResponse)

    // Include the current cookie context in the key, including login changes while
    // an older GET is pending. Never share results between Firefox containers.
    const cookieStoreId = sender?.tab?.cookieStoreId
    return browser.cookies.getAll({ url: api.url, ...(cookieStoreId ? { storeId: cookieStoreId } : {}) }).then((cookies) => {
      const accountContext = `${cookieStoreId || 'default'}:${md5(JSON.stringify(cookies.map(cookie => [cookie.name, cookie.value, cookie.domain, cookie.path]).sort()))}`
      return doRequest(message!, api, sendResponse, cookies, accountContext)
    })
  }
}

const REQUEST_TIMEOUT = 15000
const MAX_IN_FLIGHT = 256
// Pending GETs only: no completed responses or account data cache.
const inFlight = new Map<string, Promise<any>>()

async function doRequest(message: Message, api: API, sendResponse?: Function, cookies?: Browser.Cookies.Cookie[], accountContext?: string) {
  const { contentScriptQuery, ...rest } = message
  const { _fetch, params = {}, afterHandle } = api
  let { url } = api
  const { method, body } = _fetch
  // Header objects belong to API definitions and must never hold a container's cookies.
  const headers = { ..._fetch.headers }
  const isGET = method.toLowerCase() === 'get'
  const targetParams = { ...params }
  let targetBody: any = { ...body }
  Object.keys(rest).forEach((key) => {
    if (body && body[key] !== undefined)
      targetBody[key] = rest[key]
    else
      targetParams[key] = rest[key]
  })
  const urlParams = new URLSearchParams()
  for (const key in targetParams) {
    if (targetParams[key] !== undefined && targetParams[key] !== null && targetParams[key] !== '')
      urlParams.append(key, String(targetParams[key]))
  }
  if (urlParams.size)
    url += `${url.includes('?') ? '&' : '?'}${urlParams}`
  if (!isGET) {
    targetBody = headers['Content-Type']?.includes('application/x-www-form-urlencoded')
      ? new URLSearchParams(targetBody)
      : JSON.stringify(targetBody)
  }
  if (cookies)
    headers['firefox-multi-account-cookie'] = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')

  const key = isGET && accountContext ? JSON.stringify([accountContext, contentScriptQuery, url, headers]) : undefined
  let pending = key ? inFlight.get(key) : undefined
  if (!pending) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Background request timed out'))
      }, REQUEST_TIMEOUT)
    })
    const request = (async () => {
      let result: any = await fetch(url, { method, headers, ...(!isGET ? { body: targetBody } : {}), signal: controller.signal })
      if (!result.ok)
        throw new Error(`Background request failed with HTTP ${result.status}`)
      for (const handler of afterHandle) {
        if (handler !== sendResponseHandler)
          result = await handler(result)
      }
      return result
    })()
    pending = Promise.race([request, timeout]).finally(() => clearTimeout(timer))
    if (key && inFlight.size < MAX_IN_FLIGHT) {
      inFlight.set(key, pending)
      // Handle both outcomes; using an ignored finally would create a rejection.
      const remove = () => {
        if (inFlight.get(key) === pending)
          inFlight.delete(key)
      }
      pending.then(remove, remove)
    }
  }
  const result = await pending
  if (afterHandle.includes(sendResponseHandler) && sendResponse)
    return sendResponse(result)
  return result
}

export {
  type _FETCH,
  AHS,
  type API,
  apiListenerFactory,
  type APIMAP,
  type FetchAfterHandler,
  type Message,
  sendResponseHandler,
  toData,
  toJsonHandler,
}
