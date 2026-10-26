const rootSelector
  = '.root-reply-container, .bb-comment .comment-list > .list-item > .con, .comment-bilibili-fold .comment-list > .list-item > .con, bili-comment-renderer'

function bodyText(element: Element): string {
  if (element.matches('style, script'))
    return ''
  let text = ''
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE)
      text += node.textContent || ''
    else if (node instanceof Element && !node.matches('style, script'))
      text += bodyText(node)
  }
  if (element.shadowRoot)
    text += Array.from(element.shadowRoot.children).map(bodyText).join('')
  return text
}

function getThread(element: HTMLElement): HTMLElement | null {
  const root = element.getRootNode()
  if (root instanceof ShadowRoot && root.host.matches('bili-comment-thread-renderer'))
    return root.host as HTMLElement
  return element.closest<HTMLElement>('.list-item, .reply-item')
}

export function startCommentFilter() {
  const hidden = new Map<HTMLElement, { value: string, priority: string }>()
  const observers = new Map<Document | ShadowRoot, MutationObserver>()
  const pending = new Set<Document | ShadowRoot | Element>()
  const waiting = new Set<Element>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let queued = false
  let stopped = false

  function restore(element: HTMLElement) {
    const previous = hidden.get(element)
    if (!previous)
      return
    if (previous.value)
      element.style.setProperty('display', previous.value, previous.priority)
    else element.style.removeProperty('display')
    hidden.delete(element)
  }

  function commentRoot(element: Element): Element | null {
    const comment = element.closest(rootSelector)
    if (comment)
      return comment
    const root = element.getRootNode()
    return root instanceof ShadowRoot ? commentRoot(root.host) : null
  }

  function scan(root: Document | ShadowRoot | Element) {
    if (!(root instanceof Element) && !observers.has(root)) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
          const comment = element && commentRoot(element)
          if (comment)
            pending.add(comment)
          for (const node of mutation.addedNodes) {
            if (node instanceof Element)
              pending.add(node)
          }
        }
        schedule()
      })
      observer.observe(root, { childList: true, subtree: true, characterData: true })
      observers.set(root, observer)
    }
    const comments = [...root.querySelectorAll<HTMLElement>(rootSelector)]
    if (root instanceof HTMLElement && root.matches(rootSelector))
      comments.unshift(root)
    for (const element of comments) {
      const content
        = element.shadowRoot?.querySelector('#content')
          || element.querySelector('.root-reply .reply-content, :scope > .text, :scope > .text-con')
      const blocked = !!content && bodyText(content).includes('@')
      const target = getThread(element) || element
      if (blocked && !hidden.has(target)) {
        hidden.set(target, {
          value: target.style.getPropertyValue('display'),
          priority: target.style.getPropertyPriority('display'),
        })
        target.style.setProperty('display', 'none', 'important')
      }
      else if (!blocked) {
        restore(target)
      }
    }
    const selector
      = 'bili-comments, bili-comment-thread-renderer, bili-comment-renderer, bili-comment-replies-renderer, bili-comment-reply-renderer, bili-rich-text'
    const hosts = [...root.querySelectorAll(selector)]
    if (root instanceof Element && root.matches(selector))
      hosts.unshift(root)
    for (const element of hosts) {
      if (element.shadowRoot) {
        waiting.delete(element)
        const fresh = !observers.has(element.shadowRoot)
        scan(element.shadowRoot)
        const comment = commentRoot(element)
        if (fresh && comment && comment !== root)
          pending.add(comment)
      }
      else {
        waiting.add(element)
      }
    }
    if (waiting.size && !timer && !document.hidden) {
      timer = setTimeout(() => {
        timer = undefined
        for (const element of waiting) {
          if (!element.isConnected)
            waiting.delete(element)
          else pending.add(element)
        }
        schedule()
      }, 500)
    }
  }

  function refresh() {
    if (stopped)
      return
    for (const [root, observer] of observers) {
      if (root instanceof ShadowRoot && !root.host.isConnected) {
        observer.disconnect()
        observers.delete(root)
      }
    }
    for (const element of hidden.keys()) {
      if (!element.isConnected)
        restore(element)
    }
    const roots = [...pending]
    pending.clear()
    roots.forEach(scan)
  }

  function schedule() {
    if (queued || stopped)
      return
    queued = true
    queueMicrotask(() => {
      queued = false
      refresh()
      if (pending.size)
        schedule()
    })
  }

  pending.add(document)
  refresh()
  const resume = () => {
    if (!document.hidden) {
      waiting.forEach(element => pending.add(element))
      schedule()
    }
  }
  document.addEventListener('visibilitychange', resume)
  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', resume)
    waiting.clear()
    pending.clear()
    observers.forEach(observer => observer.disconnect())
    observers.clear()
    for (const element of hidden.keys()) restore(element)
  }
}
