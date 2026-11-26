/**
 * Cursor spotlight glow + geometric tilt: the deepseek.com/harness
 * feature-card hover interactions, ported onto the floating glass panes.
 *
 * Two effects ride the same hover marker (`data-spot-on`):
 * - a blue radial glow that follows the cursor — a `data-dsh-aqua-glow`
 *   overlay inside each pane whose inline background a JS pointermove
 *   writes (`radial-gradient(180px at Xpx Ypx, rgba(120,170,255,.15),
 *   transparent 70%)`, official values). The glow sits BEHIND the glass
 *   (z-index -1) so it diffuses through the translucent surface and never
 *   covers content;
 * - a cursor-driven rigid tilt written inline per pointermove, the official
 *   card's exact recipe (sign-verified from its inline transform):
 *   `perspective(800px) rotateX(θx) rotateY(θy) scale(1.01)` with
 *   θx = −k·Δy, θy = +k·Δx — the edge under the cursor sinks, the far edge
 *   lifts (cursor right ⇒ right sinks; cursor top ⇒ top sinks), ≈1° at the
 *   pane edge, 0.1s ease-out transition;
 *
 * Port notes:
 * - the sidebar NEVER tilts (its settings overlay renders inside the column
 *   and a running transform would re-anchor it — the panel traps at the
 *   column width); it keeps the glow;
 * - the fused composer+stats spot is the wider invisible inputbar wrapper:
 *   the hover region, glow geometry and tilt pivot are computed against the
 *   VISIBLE glass (see visualRect / glassLocalRect in spot-core.ts), so the
 *   wrapper's side gutters never respond;
 * - the tilt rides a short CSS transition and reduced motion skips it;
 * - geometry is measured ONCE per hover session in untransformed local space
 *   (offset-based — immune to the pane's own rotation) and refreshed on
 *   DOM/layout changes, so the per-frame path does zero layout reads.
 *
 * Two html-attribute gates from the layer's settings: `data-dsh-aqua-spotlight`
 * (glow) and `data-dsh-aqua-press` (tilt). Hover tracking runs when EITHER is
 * on. The glow divs are maintained by spot-core's overlay keeper, independent
 * of the toggles.
 */
import {
  closestSpot, ensureGlow, glassIsOwnBox, glassLocalRect, GLOW_ATTR, inside, ON_ATTR, replacedElement, spotElements,
  startOverlayKeeper, visualRect,
} from './spot-core.ts'

/** html attribute the layer uses to switch the glow effect (its toggle). */
export const SPOTLIGHT_ATTRIBUTE = 'data-dsh-aqua-spotlight'

/** html attribute the layer uses to switch the tilt effect (its toggle). */
export const PRESS_ATTRIBUTE = 'data-dsh-aqua-press'

/** Glow radius, px — matches the official card. */
const GLOW_RADIUS = 180

/** Fallback glow color (the CSS var is normally provided by the stylesheet). */
const GLOW_FALLBACK = 'rgba(255, 255, 255, 0.16)'

/** Tilt magnitude at the pane edge, radians (≈1° — perceptible but gentle). */
const TILT_MAX = 0.0175

/** Tilt perspective distance, px (official value). */
const TILT_PERSPECTIVE = 800

/** Ease-back settle time (ms) — must outlast the CSS transform transition.
 *  The stylesheet runs the press at 300ms, so the inline transform survives a
 *  further 60ms before it is dropped; removing it earlier would cut the
 *  glide home short and snap the pane back. */
const SETTLE_MS = 360

/**
 * The sidebar column (lightningcss keeps the class substring). It tilts like the
 * other cards, but it owns two `position: fixed` guests — the desktop titlebar
 * chrome — so those are re-anchored into the card for the duration of a press.
 * See `liftFixedGuests` / `restoreFixedGuests`.
 */
const SIDEBAR_COLUMN = '[class*="sidebarCol"]'

/**
 * A `position: fixed` guest inside a pane. A live transform is a containing block
 * for these, so they are converted to `position: absolute` with their on-screen
 * box preserved, which keeps them exactly where they were while the pane rotates.
 */
const FIXED_GUEST = '[data-sidebar-toggle], [class*="railIn"] [class*="newSession"]'

/**
 * The right workbench card's seam. It can host the dockkit floating pane,
 * which the kit draws with `position: fixed` and positions from its own drag
 * math — the same trap as the sidebar, so a pane carrying one takes the glow
 * alone. See `tiltable`.
 */
const RIGHTBAR_COLUMN = '[data-dsh-details]'

/** A floated dockkit pane, fixed-positioned inside whichever card hosts it. */
const FLOATING_PANE = '[data-dockkit-host="float"]'

/**
 * The session panel (the floating "环境" card over the transcript). It is
 * `position: absolute` inside the transcript and owns `overflow-y: auto`, so
 * its press needs two guards — see `tiltable` and the panel's CSS.
 */
const SESSION_PANEL = 'aside[data-session-panel]'

/** A dialog sheet (settings, confirms, the image viewer's mask). */
const DIALOG = '[role="dialog"]'

/** A dialog that covers the viewport (the image viewer's mask). */
function fullViewport(dialog: HTMLElement): boolean {
  const rect = dialog.getBoundingClientRect()
  return rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2
}

/** A menu the panel opens from a row; the kit draws it `position: fixed`. */
const PANEL_MENU = '[role="menu"]'

/**
 * A main-area panel page (the plugin manager, scheduled tasks). Its class is
 * build-hashed, so the seam is the stable `data-plugin-panel` the host stamps on
 * the page's root `<section>`.
 */
const PLUGIN_PANEL = 'section[data-plugin-panel]'

/** The plugin manager's "add plugin" dropdown; `position: fixed` from its trigger. */
const PLUGIN_MENU = '[data-plugin-bar] [role="menu"], [data-plugin-panel] [role="menu"]'

/** The glow is live only while its gate attribute is on <html>. */
function glowGated(): boolean {
  return document.documentElement.hasAttribute(SPOTLIGHT_ATTRIBUTE)
}

/** The tilt is live only while its gate attribute is on <html>. */
function tiltGated(): boolean {
  return document.documentElement.hasAttribute(PRESS_ATTRIBUTE)
}

/** Hover tracking runs when EITHER effect is enabled. */
function hoverGated(): boolean {
  return glowGated() || tiltGated()
}

/** Whether the tilt may run on this pane right now. */
function tiltable(spot: HTMLElement): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  // The sidebar tilts like the other cards. Its two `position: fixed` titlebar
  // guests are re-anchored into the card for the duration of a press instead of
  // banning the tilt — see `liftFixedGuests`. One shape still stands still: while
  // the settings overlay is open it renders INSIDE this column, and a live
  // transform would trap that sheet at the column width.
  if (spot.matches(SIDEBAR_COLUMN) && spot.querySelector(DIALOG) !== null) return false
  // The workbench card tilts like the other glass, with one exception: a
  // floated dockkit pane is `position: fixed` and lives inside it, so a live
  // transform would re-anchor that pane into the card. It only mounts while
  // the operator tears a tab out, so the card stands still exactly then.
  if (spot.matches(RIGHTBAR_COLUMN) && spot.querySelector(FLOATING_PANE) !== null) return false
  // The session panel takes the same press as the other panes, with one
  // exception: while a row menu is open, a live transform would re-anchor that
  // `position: fixed` menu into the card. The menu only exists while it is
  // open, so the card stands still exactly then.
  if (spot.matches(SESSION_PANEL) && spot.querySelector(PANEL_MENU) !== null) return false
  // A dialog sheet tilts like the other glass. Two exceptions. The image
  // viewer's mask IS the whole viewport, so a transform there would swing the
  // window edges (and its `position: fixed` picture buttons along with it).
  // And a dialog carrying its own `position: fixed` guest — a menu opened from
  // a row inside it — re-anchors that guest, the same trap as the sidebar.
  if (spot.matches(DIALOG)) {
    if (fullViewport(spot)) return false
    if (spot.querySelector(PANEL_MENU) !== null) return false
  }
  // A main-area panel page takes the same press as the other glass cards, with
  // one exception: its toolbar opens a `position: fixed` menu from a trigger
  // inside the page, and a live transform would re-anchor that menu into the
  // card — the same trap as the sidebar. The menu only exists while it is open,
  // so the card stands still exactly then.
  if (spot.matches(PLUGIN_PANEL) && spot.querySelector(PLUGIN_MENU) !== null) return false
  return true
}

/** One hover session: geometry captured at entry, kept fresh by the feed. */
interface SpotSession {
  spot: HTMLElement
  /** The visible glass region in viewport space (cursor math). */
  visual: DOMRect
  /** The visible glass region in spot-local, UNtransformed space (glow
   *  geometry + tilt pivot). */
  local: { left: number; top: number; width: number; height: number }
  /** Glow overlay (null while the glow toggle is off). */
  glow: HTMLElement | null
}

/**
 * Attach the delegated pointer feeds. Everything is document-level: no
 * per-pane listeners, and the rAF merge collapses pointermove bursts to one
 * style write per frame.
 * @returns a disposer that drops listeners, overlays, and inline styles.
 */
export function startSpotlight(): () => void {
  /** The hovered pane (cleared on leave). */
  let current: HTMLElement | null = null
  /** Geometry for the hovered pane. */
  let session: SpotSession | null = null
  let raf = 0
  let refreshRaf = 0
  /** Panes currently carrying a JS-written transform (wipe only those). */
  const tilted = new WeakSet<HTMLElement>()
  /** Pending ease-back removal timers per pane (leave → neutral → cleanup). */
  const settle = new Map<HTMLElement, number>()

  /**
   * Guests lifted out of their pane, with where they came from.
   *
   * A `position: fixed` element resolves against the viewport — until an ancestor
   * carries a transform, at which point that ancestor becomes the containing block
   * and the element jumps. The sidebar's titlebar chrome is exactly that, and it
   * sits ABOVE the card in the reserved titlebar band, so re-anchoring it inside
   * the card both moves it and lets the card's `overflow: hidden` clip it away.
   *
   * The fix is to take the guest out of the pane entirely for the duration of the
   * press: it moves to `<body>`, keeps its `position: fixed`, and therefore keeps
   * resolving against the viewport exactly as it did before the transform existed.
   * It is put back where it came from once the press settles.
   */
  const lifted = new Map<HTMLElement, { parent: Node, next: Node | null, owner: HTMLElement }>()

  /**
   * Take every fixed guest of this pane out of it.
   *
   * Keyed per guest, not guarded on the map being empty. A single global
   * `if (lifted.size > 0) return` looks equivalent and is not: a quick
   * leave-then-enter can find the map still holding an earlier guest while this
   * pane's own button is back inside the pane, and the guard then skips the lift
   * entirely — the transform lands on a button that never left, which is the flash
   * that only showed up some of the time.
   */
  const liftFixedGuests = (spot: HTMLElement): void => {
    for (const guest of spot.querySelectorAll<HTMLElement>(FIXED_GUEST)) {
      if (lifted.has(guest)) continue
      if (window.getComputedStyle(guest).position !== 'fixed') continue
      const parent = guest.parentNode
      if (parent === null) continue
      lifted.set(guest, { parent, next: guest.nextSibling, owner: spot })
      document.body.appendChild(guest)
    }
  }

  /**
   * Put back the guests of `spot`, or every guest when called with no argument.
   *
   * Scoped by owner because a settle timer can fire while a DIFFERENT pane has
   * already started its own press: a global restore would pull that pane's button
   * home mid-rotation, which is the same flash seen from the other end.
   */
  const restoreFixedGuests = (spot?: HTMLElement): void => {
    for (const [guest, home] of [...lifted]) {
      if (spot !== undefined && home.owner !== spot) continue
      lifted.delete(guest)
      // React may have torn the row down while the pointer was inside; a node with
      // no home any more is simply dropped instead of being re-inserted.
      if (home.parent.isConnected) home.parent.insertBefore(guest, home.next)
      else guest.remove()
    }
  }

  /** Ease a pressed pane back to neutral, then drop the inline transform. */
  const easeBack = (spot: HTMLElement): void => {
    if (!tilted.has(spot)) return
    tilted.delete(spot)
    // Neutral transform lets the CSS transition glide the pane home; the
    // inline transform is removed after the flight (a residual transform
    // would keep the pane a containing block for fixed descendants).
    spot.style.transform =
      `perspective(${TILT_PERSPECTIVE}px) rotateX(0rad) rotateY(0rad) scale(1)`
    const id = window.setTimeout(() => {
      settle.delete(spot)
      // The transform is identity by now, so dropping it changes nothing on
      // screen — but `transition: transform` is still live, and removing the
      // property ANIMATES identity → none for another 300ms. Those frames still
      // have a computed transform, so the element stays a containing block: a
      // fixed guest put back at this instant is re-anchored to the pane's
      // top-left corner and only snaps back when the animation finishes (the
      // one-frame flash past the card's corner). Snapping the removal with the
      // transition disabled is what makes the release atomic.
      spot.style.setProperty('transition', 'none')
      spot.style.removeProperty('transform')
      spot.style.removeProperty('transform-origin')
      void spot.offsetWidth
      spot.style.removeProperty('transition')
      // Only this pane's guests: a timer can fire while another pane has already
      // begun its own press, and a global restore would yank that pane's button
      // home mid-rotation.
      restoreFixedGuests(spot)
    }, SETTLE_MS)
    settle.set(spot, id)
  }

  /** Drop every effect this controller wrote onto a pane. */
  const clearSpot = (spot: HTMLElement): void => {
    spot.removeAttribute(ON_ATTR)
    if (current === spot) {
      current = null
      session = null
    }
    const glow = spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)
    if (glow !== null) glow.style.removeProperty('background-image')
    // A frame queued before the pointer left would otherwise run after this
    // release and write a fresh tilt back onto the pane — with its guests already
    // on their way home, which is the same flash from the other direction.
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    easeBack(spot)
  }

  /** Capture (or refresh) the hover geometry; sets the glow overlay box. */
  const measure = (spot: HTMLElement): SpotSession => {
    const visual = visualRect(spot)
    const local = glassLocalRect(spot)
    // A replaced element (`<img>`) renders no children, so an injected glow
    // div inside it would never paint. The image viewer's picture is stamped
    // for its press; skip the overlay rather than append a dead node.
    const glow = glowGated() && !replacedElement(spot) ? ensureGlow(spot) : null
    if (glow !== null && !glassIsOwnBox(spot)) {
      glow.style.left = `${local.left}px`
      glow.style.top = `${local.top}px`
      glow.style.width = `${local.width}px`
      glow.style.height = `${local.height}px`
    }
    return { spot, visual, local, glow }
  }

  /** Write the glow gradient and/or the tilt transform for the pointer position. */
  const paint = (s: SpotSession, clientX: number, clientY: number): void => {
    if (raf !== 0) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const { spot, visual, local } = s
      // Over a gutter / padding region, not the glass — nothing to paint.
      if (!inside(visual, clientX, clientY)) {
        clearSpot(spot)
        return
      }
      let glow = s.glow
      if (glow === null && glowGated()) {
        // Toggle flipped on mid-hover: late-bind the glow overlay.
        s = session = measure(spot)
        glow = s.glow
      }
      if (glow !== null) {
        if (glowGated()) {
          // background-image only: the shorthand would wipe any CSS paint.
          glow.style.backgroundImage =
            `radial-gradient(${GLOW_RADIUS}px at ${clientX - visual.left}px ${clientY - visual.top}px, var(--dsh-aqua-spot-color, ${GLOW_FALLBACK}), transparent 70%)`
        } else {
          // Toggle flipped off mid-hover: drop the last radial so the
          // now-ungated div turns invisible immediately.
          glow.style.removeProperty('background-image')
        }
      }
      if (tiltGated() && tiltable(spot)) {
        // Normalized cursor offset from the glass center, clamped to ±0.5 —
        // the official card's formula, sign-verified against its inline
        // transform: cursor right ⇒ rotateY POSITIVE, cursor TOP ⇒ rotateX
        // POSITIVE — the edge under the cursor sinks, the far edge lifts.
        const dx = Math.min(0.5, Math.max(-0.5, (clientX - visual.left) / visual.width - 0.5))
        const dy = Math.min(0.5, Math.max(-0.5, (clientY - visual.top) / visual.height - 0.5))
        // The trajectory pane is far larger than the other glass — half the
        // magnitude there so the press stays gentle.
        const tiltMax = spot.hasAttribute('data-dsh-trajectory') ? TILT_MAX * 0.5 : TILT_MAX
        // Any `position: fixed` guest inside this pane is re-anchored BEFORE the
        // first transform lands, so it never has a frame in which to jump.
        liftFixedGuests(spot)
        // Rotate about the visible glass center (spot-local, untransformed).
        spot.style.transformOrigin =
          `${local.left + local.width / 2}px ${local.top + local.height / 2}px`
        spot.style.transform =
          `perspective(${TILT_PERSPECTIVE}px) rotateX(${tiltMax * -2 * dy}rad) rotateY(${tiltMax * 2 * dx}rad) scale(1.01)`
        tilted.add(spot)
      } else if (tilted.has(spot)) {
        // Tilt toggled off mid-hover (or a guarded pane): release only
        // transforms this controller wrote.
        easeBack(spot)
      }
    })
  }

  const onMove = (event: PointerEvent): void => {
    if (!hoverGated()) return
    const spot = closestSpot(event.target)
    if (spot === null || session?.spot !== spot) return
    paint(session, event.clientX, event.clientY)
  }

  const onOver = (event: PointerEvent): void => {
    if (!hoverGated()) return
    const spot = closestSpot(event.target)
    if (spot === null) return
    // The settings overlay renders INSIDE the sidebar column: while it is
    // open, the sidebar stays out of every hover effect.
    if (spot.matches(SIDEBAR_COLUMN) && document.querySelector('[role="dialog"]') !== null) return
    // Gutter/padding entries never start a session (and must not cancel a
    // pending ease-back settle), so the glass check comes first.
    const next = measure(spot)
    if (!inside(next.visual, event.clientX, event.clientY)) return
    // Re-entry during an ease-back: cancel the pending inline cleanup.
    const id = settle.get(spot)
    if (id !== undefined) {
      clearTimeout(id)
      settle.delete(spot)
    }
    spot.setAttribute(ON_ATTR, '')
    current = spot
    session = next
    paint(next, event.clientX, event.clientY)
  }

  const onOut = (event: PointerEvent): void => {
    const spot = closestSpot(event.target)
    if (spot === null || spot !== current) return
    // Moving between children keeps the effects live; leaving the visible
    // glass (including into the wrapper's gutters) clears them.
    if (session !== null && inside(session.visual, event.clientX, event.clientY)) return
    clearSpot(spot)
  }

  // The glow divs live with the panes through React re-renders; DOM/layout
  // changes also refresh the active hover session (coalesced).
  const keeper = startOverlayKeeper(() => {
    // Two panes host a `position: fixed` guest that mounts later than the
    // pane itself: the sidebar column carries the settings dialog, the
    // workbench card carries a dockkit floated pane. Neither tilts (see
    // `tiltable`), but a transform left behind by an earlier build, a hot
    // reload or a race would trap the guest inside the card — so it is
    // dropped with a SNAP, not a glide: removing the inline transform while
    // the CSS transition is live would keep the COMPUTED transform alive for
    // ~0.1s and re-trap the guest for those frames. Disabling the transition
    // around the removal makes the release instant.
    for (const spot of spotElements()) {
      const dialog = spot.matches(SIDEBAR_COLUMN) && spot.querySelector('[role="dialog"]') !== null
      const floated = spot.matches(RIGHTBAR_COLUMN) && spot.querySelector(FLOATING_PANE) !== null
      if (!dialog && !floated) continue
      spot.removeAttribute(ON_ATTR)
      const id = settle.get(spot)
      if (id !== undefined) {
        clearTimeout(id)
        settle.delete(spot)
      }
      tilted.delete(spot)
      spot.style.setProperty('transition', 'none')
      spot.style.removeProperty('transform')
      spot.style.removeProperty('transform-origin')
      void spot.offsetWidth
      spot.style.removeProperty('transition')
      if (current === spot) {
        current = null
        session = null
      }
    }
    if (session === null || refreshRaf !== 0) return
    refreshRaf = requestAnimationFrame(() => {
      refreshRaf = 0
      if (session !== null) session = measure(session.spot)
    })
  })

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerover', onOver, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    document.removeEventListener('pointerout', onOut)
    keeper()
    if (raf !== 0) cancelAnimationFrame(raf)
    if (refreshRaf !== 0) cancelAnimationFrame(refreshRaf)
    for (const id of settle.values()) clearTimeout(id)
    settle.clear()
    for (const spot of spotElements()) {
      spot.removeAttribute(ON_ATTR)
      if (tilted.has(spot)) {
        tilted.delete(spot)
        spot.style.removeProperty('transform')
        spot.style.removeProperty('transform-origin')
      }
    }
    // A guest still parked on `<body>` would outlive the theme layer and never go
    // home, so the whole map is flushed on teardown.
    restoreFixedGuests()
  }
}
