/** 统一维护加载状态、错误和过期响应。 */
export function useAsyncTask() {
  const isLoading = ref(false)
  const loadFailed = ref(false)
  let generation = 0
  const invalidate = () => {
    generation++
    isLoading.value = false
  }
  onScopeDispose(invalidate)
  onDeactivated(invalidate)

  async function run<T>(load: () => Promise<T>, apply: (result: T) => void) {
    const token = ++generation
    isLoading.value = true
    loadFailed.value = false
    try {
      const result = await load()
      if (token === generation)
        apply(result)
    }
    catch (error) {
      if (token === generation) {
        loadFailed.value = true
        console.error(error)
      }
    }
    finally {
      if (token === generation)
        isLoading.value = false
    }
  }
  return { isLoading, loadFailed, run, invalidate }
}
