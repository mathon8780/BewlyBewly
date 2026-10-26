/** 共享进行中的请求，最后一个调用方离开后取消。 */
export function createInflightRequests(timeoutMs = 10000) {
  const pending = new Map<string, { promise: Promise<unknown>, controller: AbortController, users: Set<symbol> }>()
  return function request<T>(key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted()
    let entry = pending.get(key)
    if (!entry) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs)
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
      })
      const promise = Promise.race([Promise.resolve().then(() => load(controller.signal)), aborted]).finally(() => {
        clearTimeout(timer)
        if (pending.get(key)?.promise === promise)
          pending.delete(key)
      })
      entry = { promise, controller, users: new Set() }
      pending.set(key, entry)
    }
    const shared = entry
    const user = Symbol('consumer')
    shared.users.add(user)
    return new Promise<T>((resolve, reject) => {
      const cancel = () => {
        release()
        reject(signal!.reason)
        if (!shared.users.size) {
          pending.delete(key)
          shared.controller.abort()
        }
      }
      function release() {
        signal?.removeEventListener('abort', cancel)
        shared.users.delete(user)
      }
      signal?.addEventListener('abort', cancel, { once: true })
      shared.promise.then(
        (value) => {
          release()
          resolve(value as T)
        },
        (error) => {
          release()
          reject(error)
        },
      )
    })
  }
}
