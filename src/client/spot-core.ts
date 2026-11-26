/**
 * Spot geometry + overlay maintenance, shared by the spotlight/tilt
 * controller (spotlight.ts).
 *
 * A "spot" is a floating-glass pane stamped with `data-dsh-aqua-spot` by the
 * seam-stamper. One injected overlay lives inside a spot:
 * `data-dsh-aqua-glow` — the cursor glow surface (geometry set by the hover
 * controller; the radial fill lives in the stylesheet). It is re-attached
 * after React re-renders wipe it (one shared MutationObserver).
 */

/** Seam attribute marking a floating-glass pane as a spotlight target. */
export const SPOT_ATTR = 'data-dsh-aqua-spot'

/** Attribute on the injected glow overlay div. */
export const GLOW_ATTR = 'data-dsh-aqua-glow'

/** Marker set on a pane while the pointer is inside it. */
export const ON_ATTR = 'data-spot-on'

/** Selector matching every stamped pane. */
export const SPOT_SELECTOR = `[${SPOT_ATTR}]`

/** Nearest stamped pane from an event target (null when outside all panes). */
export function closestSpot(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(SPOT_SELECTOR) : null
}

/** Every stamped pane in document order. */
export function spotElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SPOT_SELECTOR))
}

/** The fullscreen workbench panel, when one is mounted inside a spot. */
const FULLSCREEN_PANEL = '[data-sidebar-right-panel="fullscreen"]'

/**
 * Does the pane's own padding box equal its visible glass?
 *
 * True for every plain pane — the sidebar column, a main panel page, a card in
 * the transcript. False for the two panes whose glass is NOT their own box: the
 * fused composer+stats spot (an invisible wrapper around both) and a workbench
 * card hosting a fullscreen panel.
 *
 * The controller needs this because it sizes the glow overlay inline. For a
 * plain pane that inline box is a second, independent copy of a measurement the
 * browser already has — and when it is taken at the wrong moment the overlay is
 * left too small, so the radial fill ends on a straight edge partway across the
 * pane. Those panes let the stylesheet's `inset: 0` own the box instead, which
 * follows every layout change for free.
 */
export function glassIsOwnBox(spot: HTMLElement): boolean {
  if (spot.querySelector('[data-composer-card]') !== null) return false
  return spot.querySelector<HTMLElement>(FULLSCREEN_PANEL) === null
}

/**
 * The visible glass region of a pane (viewport rect). The fused
 * composer+stats spot is the wider invisible inputbar wrapper — its glass is
 * the union of the composer card and the docked stats band, so the wrapper's
 * side gutters stay outside every effect.
 *
 * A workbench card hosting a fullscreen panel is the page, not the card: the
 * host widens the panel to `calc(100vw + 1px)` and lets it hang leftward out of
 * the column track, while the card itself keeps the track's width. Measuring the
 * card there bounded the glow and the press to the right-hand strip. The panel
 * is measured instead.
 */
export function visualRect(spot: HTMLElement): DOMRect {
  if (spot.querySelector('[data-composer-card]') !== null) {
    const card = spot.querySelector<HTMLElement>('[data-composer-card]')!
    const r0 = card.getBoundingClientRect()
    const stats = spot.querySelector<HTMLElement>('[data-dsh-stats]')
    if (stats === null) return r0
    const r1 = stats.getBoundingClientRect()
    const left = Math.min(r0.left, r1.left)
    const top = Math.min(r0.top, r1.top)
    return new DOMRect(left, top, Math.max(r0.right, r1.right) - left, Math.max(r0.bottom, r1.bottom) - top)
  }
  const panel = spot.querySelector<HTMLElement>(FULLSCREEN_PANEL)
  if (panel !== null) return panel.getBoundingClientRect()
  return spot.getBoundingClientRect()
}

/** Is the pointer over the visible glass of the pane? */
export function inside(visual: DOMRect, clientX: number, clientY: number): boolean {
  return clientX >= visual.left && clientX <= visual.right
    && clientY >= visual.top && clientY <= visual.bottom
}

/** Offset-chain position of `el` within `ancestor` (both boxes), in the
 *  UNTRANSFORMED layout space — offsetLeft/offsetTop ignore transforms, so
 *  this stays exact while the pane is tilted. */
function localTopLeft(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node !== null && node !== ancestor) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

/**
 * The padding box of a pane — the box an absolutely positioned `inset: 0`
 * child resolves against, which is what the glow overlay needs to fill.
 *
 * `clientWidth`/`clientHeight` are wrong here for two separate reasons:
 * they exclude the border (so the overlay stopped at the border's inner edge)
 * and they exclude a `scrollbar-gutter: stable` lane (so it stopped 6px short
 * down the right side of a pane that reserves one for the same reason). The
 * border box minus the border widths is exactly the padding box, lane and all.
 */
function paddingBox(el: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(el)
  const horizontal = Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth)
  const vertical = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
  return {
    width: el.offsetWidth - (Number.isFinite(horizontal) ? horizontal : 0),
    height: el.offsetHeight - (Number.isFinite(vertical) ? vertical : 0),
  }
}

/**
 * The visible glass region of a pane in the pane's own local space
 * (untransformed — safe to measure while tilted). For the fused
 * composer+stats spot this is the union of the composer card and the docked
 * stats band; for the other panes it is the pane's own box.
 */
export function glassLocalRect(spot: HTMLElement): { left: number; top: number; width: number; height: number } {
  // A fullscreen panel hangs leftward out of the card, so its own box is the
  // glass: the card's padding box would clip the glow to the column track.
  // `position: absolute` resolves it against the card, and the card declares
  // `overflow: visible` for the fullscreen case, so the overlay may extend past
  // it. Width/height come from the laid-out box. The card keeps `position:
  // relative`, so its padding box is the origin.
  const panel = spot.querySelector<HTMLElement>(FULLSCREEN_PANEL)
  if (panel !== null) {
    const card = paddingBox(spot)
    const box = panel.getBoundingClientRect()
    const own = spot.getBoundingClientRect()
    return {
      left: box.left - own.left,
      top: box.top - own.top,
      width: Math.max(box.width, card.width),
      height: Math.max(box.height, card.height),
    }
  }
  const card = spot.querySelector<HTMLElement>('[data-composer-card]')
  if (card === null) {
    const box = paddingBox(spot)
    return { left: 0, top: 0, width: box.width, height: box.height }
  }
  const cardPos = localTopLeft(card, spot)
  let left = cardPos.x
  let top = cardPos.y
  let right = left + card.offsetWidth
  let bottom = top + card.offsetHeight
  const stats = spot.querySelector<HTMLElement>('[data-dsh-stats]')
  if (stats !== null) {
    const statsPos = localTopLeft(stats, spot)
    left = Math.min(left, statsPos.x)
    top = Math.min(top, statsPos.y)
    right = Math.max(right, statsPos.x + stats.offsetWidth)
    bottom = Math.max(bottom, statsPos.y + stats.offsetHeight)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/** Ensure the pane carries exactly one glow overlay div. */
export function ensureGlow(spot: HTMLElement): HTMLElement {
  let glow = spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)
  if (glow === null) {
    glow = document.createElement('div')
    glow.setAttribute(GLOW_ATTR, '')
    glow.setAttribute('aria-hidden', 'true')
    spot.appendChild(glow)
  }
  // A pane that IS its own glass never gets an inline box: `inset: 0` in the
  // stylesheet follows the pane through every reflow, while a number measured
  // once can go stale and strand the radially brightest part of the fill off the
  // edge. A pane whose glass sits inside its own box still needs the numbers.
  if (glassIsOwnBox(spot)) {
    glow.style.removeProperty('left')
    glow.style.removeProperty('top')
    glow.style.removeProperty('width')
    glow.style.removeProperty('height')
  }
  return glow
}

/**
 * A replaced element (`<img>`, `<video>`, …) renders no children, so a glow
 * div appended inside it never paints. The image viewer's picture is stamped
 * for its press alone.
 */
export function replacedElement(spot: HTMLElement): boolean {
  return spot.tagName === 'IMG' || spot.tagName === 'VIDEO' || spot.tagName === 'CANVAS'
}

/**
 * One shared observer + resize feed: keeps the glow divs glued to the panes
 * through React re-renders and notifies the caller of DOM/layout changes
 * (the caller coalesces the callbacks).
 * @returns a disposer that removes every injected glow div.
 */
export function startOverlayKeeper(onChange: () => void): () => void {
  const tick = (): void => {
    for (const spot of spotElements()) {
      // Replaced elements cannot host the overlay (see replacedElement).
      if (!replacedElement(spot)) ensureGlow(spot)
    }
    onChange()
  }
  tick()
  const observer = new MutationObserver(tick)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('resize', tick, { passive: true })
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', tick)
    for (const glow of document.querySelectorAll(`[${GLOW_ATTR}]`)) glow.remove()
  }
}
