/** A single awaited load cycle. Every asynchronous boundary rechecks its owner. */
export async function boundedBackfill(options: {
  current: () => boolean
  loadPage: () => Promise<{ added: number, done: boolean }>
  needsMore: () => Promise<boolean>
  maxPages?: number
}): Promise<void> {
  for (let page = 0; page < (options.maxPages ?? 5) && options.current(); page++) {
    const result = await options.loadPage()
    if (!options.current() || result.done || result.added === 0)
      return
    if (!await options.needsMore())
      return
  }
}

/** Invalidating a generation prevents late responses from mutating a new view. */
export function requestGeneration() {
  let generation = 0
  return {
    invalidate: () => ++generation,
    capture: () => generation,
    isCurrent: (token: number) => token === generation,
  }
}
