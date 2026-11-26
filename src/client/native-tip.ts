/**
 * Native tip replacement.
 *
 * `title=` is drawn by the platform: a white rectangle in the system font,
 * outside the page's paint, so no selector reaches it and it never matches the
 * shell's own tooltip chip. The only way to keep one tooltip language is to
 * take the string off the attribute and draw the tip here.
 *
 * The attribute is moved, not dropped: `data-dsh-native-tip-label` keeps the
 * text so it can be put back on dispose, and so a re-scan can tell a node this
 * module already handled from a fresh one. Everything is restored when the
 * layer unmounts — "off" means the stock browser tip again.
 *
 * Scope is deliberate: only `title` on an element that is NOT a link, an image
 * or an SVG, whose element is small (a control, not a truncated heading), and
 * whose text is short enough to be a label. A `title` on a paragraph or on an
 * `<a>` is a fallback for content the author could not shorten, and replacing
 * that with a chip would lose information.
 */

/** Attribute holding the tip text while the element is under this module. */
export const TIP_LABEL_ATTR = 'data-dsh-native-tip-label'
/** Marker on the single tip element this module owns. */
export const TIP_HOST_ATTR = 'data-dsh-native-tip'

/** Longest tooltip text taken over; longer ones read as prose. */
const MAX_TIP_LENGTH = 120
/** Elements whose `title` is a content fallback, not a control label. */
const SKIP_TAGS = new Set(['A', 'IMG', 'SVG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'AREA'])
/** A container holding these is prose, and its `title` is a fallback. */
const CONTENT_TAGS = 'p, div, li, ul, ol, table, pre, code, h1, h2, h3, h4, h5, h6, article, section'

interface TipHandle {
  dispose: () => void
}

/**
 * Move every eligible `title` to `data-dsh-native-tip-label` and draw the tip
 * on hover/focus, tracking React remounts.
 * @returns the handle; dispose restores every moved attribute.
 */
export function startNativeTips(): TipHandle {
  const moved = new Map<HTMLElement, string>()
  let host: HTMLElement | null = null
  let owner: HTMLElement | null = null
  let disposed = false

  const ensureHost = (): HTMLElement => {
    if (host !== null && host.isConnected) return host
    host = document.createElement('div')
    host.setAttribute(TIP_HOST_ATTR, '')
    host.hidden = true
    document.body.appendChild(host)
    return host
  }

  const hide = (): void => {
    owner = null
    if (host !== null) host.hidden = true
  }

  const show = (el: HTMLElement, text: string): void => {
    const tip = ensureHost()
    owner = el
    tip.textContent = text
    tip.hidden = false
    // Measure after the text is in, then clamp to the viewport: a tip on a
    // control near the bottom edge flips above it instead of running off.
    const rect = el.getBoundingClientRect()
    const box = tip.getBoundingClientRect()
    const margin = 8
    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - box.width / 2),
      Math.max(margin, window.innerWidth - box.width - margin),
    )
    const above = rect.top - box.height - margin
    const top = above >= margin ? above : rect.bottom + margin
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
  }

  const eligible = (el: HTMLElement): boolean => {
    if (SKIP_TAGS.has(el.tagName)) return false
    const text = el.getAttribute('title')
    if (text === null || text.trim() === '') return false
    if (text.length > MAX_TIP_LENGTH) return false
    // A container of prose carries a `title` as a fallback for text the author
    // could not shorten; a control carries it as a label. The icon inside a
    // button is a child, so "has children" cannot be the test — what matters is
    // what the children are.
    if (el.querySelector(CONTENT_TAGS) !== null) return false
    // Long visible text means the element is showing content, not a glyph.
    return (el.textContent ?? '').trim().length <= 24
  }

  /** Take over every eligible title in the document. */
  const scan = (): void => {
    for (const el of document.querySelectorAll<HTMLElement>('[title]')) {
      const text = el.getAttribute('title') ?? ''
      if (text.trim() === '') continue
      // React writes `title` again on every render of the component that owns
      // it, so an element this module already handles can come back with the
      // attribute restored. Take the new string and move it again — keeping
      // the old one would show a stale tip and, worse, put the platform's
      // rectangle back on top of ours.
      if (el.hasAttribute(TIP_LABEL_ATTR)) {
        if (text.length <= MAX_TIP_LENGTH) {
          el.setAttribute(TIP_LABEL_ATTR, text)
          el.removeAttribute('title')
          moved.set(el, text)
        }
        continue
      }
      if (!eligible(el)) continue
      el.setAttribute(TIP_LABEL_ATTR, text)
      el.removeAttribute('title')
      moved.set(el, text)
    }
  }

  const onEnter = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const el = target.closest<HTMLElement>(`[${TIP_LABEL_ATTR}]`)
    if (el === null) return
    const text = el.getAttribute(TIP_LABEL_ATTR)
    if (text === null || text === '') return
    show(el, text)
  }

  const onLeave = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (!target.closest(`[${TIP_LABEL_ATTR}]`)) return
    hide()
  }

  // A press or a scroll invalidates the anchor, and a fixed tip left behind
  // would float over unrelated content.
  const onDismiss = (): void => { hide() }

  scan()
  // Child-list covers remounts; the `title` filter covers React re-writing the
  // attribute on an element it already owns. Our own removals land here too and
  // cost one no-op pass, which is cheaper than a tip that stops working after
  // the component re-renders.
  const observer = new MutationObserver(() => { if (!disposed) scan() })
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] })

  document.addEventListener('pointerover', onEnter, true)
  document.addEventListener('pointerout', onLeave, true)
  document.addEventListener('focusin', onEnter, true)
  document.addEventListener('focusout', onLeave, true)
  document.addEventListener('pointerdown', onDismiss, true)
  window.addEventListener('scroll', onDismiss, true)

  return {
    dispose: () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener('pointerover', onEnter, true)
      document.removeEventListener('pointerout', onLeave, true)
      document.removeEventListener('focusin', onEnter, true)
      document.removeEventListener('focusout', onLeave, true)
      document.removeEventListener('pointerdown', onDismiss, true)
      window.removeEventListener('scroll', onDismiss, true)
      for (const el of moved.keys()) {
        // Only put the attribute back if the node still carries this module's
        // marker; a node that React re-used for a different purpose must not
        // inherit a stale label.
        const text = el.getAttribute(TIP_LABEL_ATTR)
        if (text !== null) el.setAttribute('title', text)
        el.removeAttribute(TIP_LABEL_ATTR)
      }
      moved.clear()
      host?.remove()
      host = null
      owner = null
    },
  }
}
