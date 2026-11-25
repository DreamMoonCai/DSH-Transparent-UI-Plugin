// @vitest-environment jsdom
/**
 * The left card tilts like the other cards.
 *
 * The ban existed because a transform is a containing block for every
 * `position: fixed` descendant, and this column owns two of them under a Windows
 * titlebar, both positioned against the viewport:
 *
 *     [data-windows-titlebar] .toggle                 { position: fixed; left: 12px }
 *     [data-windows-titlebar] .collapsed .newSession  { position: fixed; left: 48px }
 *
 * Rather than dropping the tilt, those guests are lifted out of the pane for the
 * duration of a press: each moves to `<body>`, keeps `position: fixed`, and so keeps
 * resolving against the viewport exactly as it did before the transform existed. It
 * is put back at its original position once the press settles.
 *
 * Re-anchoring them inside the pane does NOT work, and that is the shape of the bug
 * this file guards against: the two buttons sit ABOVE the card in the reserved
 * titlebar band, so an absolute box inside the card is both displaced and clipped
 * away by the card's `overflow: hidden`.
 *
 * One shape still stands still: the settings overlay renders INSIDE this column, and
 * a live transform would trap that sheet at the column width.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const controller = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

const CARD = "[data-dsh-float] [class*='sidebarCol']"

describe('the card tilts on the shared clock', () => {
  it('runs the same 300ms transform transition as the other panes', () => {
    const body = blockOf("[data-dsh-float][data-dsh-aqua-press] [class*='sidebarCol']")
    expect(body).not.toBeNull()
    expect(body).toMatch(/transition:\s*transform 0\.3s cubic-bezier\(0\.4, 0, 0\.2, 1\)/)
  })

  it('carries no press rule of its own beyond the transition', () => {
    // The shadow-press experiment is gone: a second `[data-spot-on]` recipe would
    // fight the tilt for the same hover marker.
    expect(flat).not.toMatch(/\[class\*='sidebarCol'\]\[data-spot-on\]/)
  })

  it('keeps the rest state untouched', () => {
    // Entering the card must not move it before the tilt starts.
    expect(blockOf(CARD)).toMatch(/0 10px 34px rgba\(19, 45, 83, 0\.16\)/)
  })
})

describe('the fixed guests survive the tilt', () => {
  it('names both titlebar guests as the elements to lift', () => {
    // `data-sidebar-toggle` is the host's own attribute on the collapse button; the
    // collapsed rail's new-session button only has the hashed rail class, so the
    // selector matches the subclass that survives minification.
    expect(controller).toContain('data-sidebar-toggle')
    expect(controller).toMatch(/railIn/)
  })

  it('lifts them out of the pane, not inside it', () => {
    // The buttons sit ABOVE the card in the titlebar band. Re-anchoring them inside
    // the card displaced them and the card's `overflow: hidden` clipped them away —
    // that was the observed bug. They go to `<body>` instead.
    expect(controller).toMatch(/document\.body\.appendChild\(guest\)/)
    expect(controller).not.toContain('guest.style.position = ')
    expect(controller).not.toContain("guest.style.position = 'absolute'")
  })

  it('lifts them before the first transform lands', () => {
    // Ordering is the invariant: lifting after the write leaves one frame in which
    // the buttons are already re-anchored by the live transform.
    const lift = controller.indexOf('liftFixedGuests(spot)')
    // The per-frame write, not the neutral one in `easeBack`.
    const write = controller.indexOf('perspective(${TILT_PERSPECTIVE}px) rotateX(${tiltMax')
    expect(lift).toBeGreaterThan(-1)
    expect(write).toBeGreaterThan(-1)
    expect(lift).toBeLessThan(write)
  })

  it('only lifts a guest that is actually fixed', () => {
    // A host that stops styling the button as `fixed` keeps its own behaviour.
    expect(controller).toMatch(/getComputedStyle\(guest\)\.position !== 'fixed'/)
  })

  it('puts each one back where it came from', () => {
    // The recorded anchor is the original parent plus its next sibling, so the
    // button returns to its own slot rather than to the end of the row.
    expect(controller).toContain('restoreFixedGuests')
    expect(controller).toMatch(/home\.parent\.insertBefore\(guest, home\.next\)/)
  })

  it('tolerates a row React tore down mid-press', () => {
    // A re-render while the pointer is inside removes the button from its home;
    // re-inserting it into a detached parent would leak the node.
    expect(controller).toMatch(/home\.parent\.isConnected/)
    expect(controller).toMatch(/guest\.remove\(\)/)
  })

  it('restores them only after the transform is gone', () => {
    // Restoring while the transition is still live re-anchors the guests for the
    // remaining frames and they jump.
    const restore = controller.indexOf('restoreFixedGuests()')
    const drop = controller.indexOf("spot.style.removeProperty('transform')")
    expect(restore).toBeGreaterThan(drop)
  })
})

describe('the settings sheet still stops the tilt', () => {
  it('guards the sidebar only while a dialog is inside it', () => {
    // The overlay renders inside this column, so a live transform would trap the
    // sheet at the column width. The guard is conditional, not a blanket ban.
    expect(controller).toMatch(/if \(spot\.matches\(SIDEBAR_COLUMN\) && spot\.querySelector\(DIALOG\) !== null\) return false/)
    expect(controller).not.toMatch(/if \(spot\.matches\(SIDEBAR_COLUMN\)\) return false/)
  })
})
