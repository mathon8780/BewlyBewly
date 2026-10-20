/** Mirror only this extension's split stylesheets into its own shadow root. */
export function mirrorExtensionStyles(root: ShadowRoot | HTMLElement, prefix: string) {
  const copies = new Map<HTMLLinkElement, HTMLLinkElement>()
  const copy = (node: Node): Promise<void> | undefined => {
    if (!(node instanceof HTMLLinkElement) || node.rel !== 'stylesheet' || !node.href.startsWith(prefix) || copies.has(node))
      return
    const link = node.cloneNode() as HTMLLinkElement
    copies.set(node, link)
    const ready = new Promise<void>((resolve) => {
      link.onload = () => resolve()
      link.onerror = () => resolve()
    })
    root.appendChild(link)
    return ready
  }
  const initial = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(copy)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => copy(node))
      mutation.removedNodes.forEach((node) => {
        const link = copies.get(node as HTMLLinkElement)
        if (link) {
          link.remove()
          copies.delete(node as HTMLLinkElement)
        }
      })
    }
  })
  observer.observe(document.head || document.documentElement, { childList: true })
  return {
    ready: Promise.all(initial),
    dispose() {
      observer.disconnect()
      copies.forEach(link => link.remove())
      copies.clear()
    },
  }
}
