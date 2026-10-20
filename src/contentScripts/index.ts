/** Emitted as a classic script; the UI and its dependencies remain ES modules. */
export async function bootstrapContentScript(runtimeURL: string, styles: string[]) {
  const loadStyle = (href: string) => new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Cannot load extension stylesheet: ${href}`))
    ;(document.head || document.documentElement).appendChild(link)
  })
  // Start the module fetch and styles together, but mount only once both are ready.
  const [runtime] = await Promise.all([
    import(/* @vite-ignore */ runtimeURL) as Promise<{ start: () => Promise<void> }>,
    Promise.all(styles.map(loadStyle)),
  ])
  await runtime.start()
}
