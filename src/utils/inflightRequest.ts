/** Share pending read requests only; completed values are never cached. */
export function createInflightRequests(timeoutMs = 10000) {
  const pending = new Map<string, Promise<unknown>>()
  return function request<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const existing = pending.get(key)
    if (existing)
      return existing as Promise<T>
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const promise = Promise.race([
      Promise.resolve().then(() => load(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Request timed out'))
        }, timeoutMs)
      }),
    ]).finally(() => {
      clearTimeout(timer)
      if (pending.get(key) === promise)
        pending.delete(key)
    })
    pending.set(key, promise)
    return promise
  }
}
