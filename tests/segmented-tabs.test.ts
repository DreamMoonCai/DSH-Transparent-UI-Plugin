// @vitest-environment jsdom
/**
 * Segmented tabs: the shared control, styled once.
 *
 * The host renders two of them — `src/SegmentedTabs` and `src/SegmentedControl` —
 * and both are the same shape: a `role='tablist'` container holding one
 * `span[aria-hidden]` that slides under the active tab plus one `role='tab'` button
 * per option. The plugin manager's 已安装 / 插件市场 pair, the tasks / channels /
 * timed set in the sidebar, and the model page's provider switch are all this
 * control, so one rule covers them.
 *
 * Their track and their sliding indicator are both painted with surface tokens
 * that are flat in float mode, so the whole control read as a white pill on a white
 * plate.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

const TRACK = "[data-dsh-float] [role='tablist']:not([data-dockkit-strip])"
const INDICATOR = "[data-dsh-float] [role='tablist']:not([data-dockkit-strip]) > span[aria-hidden='true']"
const DARK_INDICATOR = "[data-dsh-float] body[data-ds-dark-theme] [role='tablist']:not([data-dockkit-strip]) > span[aria-hidden='true']"

describe('the shared segmented control is glass', () => {
  it('gives the track a uniform neutral fill', () => {
    // The two implementations disagree on their track fill — `SegmentedTabs`
    // paints `--dsw-alias-bg-module-platform`, `SegmentedControl` paints
    // `--dsw-alias-interactive-bg-hover`, a blue ink — so the same control read as
    // a pale tray in the plugin page and a blue tray in the sidebar.
    const body = blockOf(TRACK)
    expect(body).toMatch(/background: color-mix\(in srgb, rgb\(19 45 83\)/)
  })

  it('gives the track a hairline and a light blur', () => {
    const body = blockOf(TRACK)
    expect(body).not.toBeNull()
    expect(body).toMatch(/box-shadow: inset 0 0 0 1px rgba\(19, 45, 83/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur/)
  })

  it('turns the sliding indicator into the raised pane', () => {
    // The indicator is the surface: a denser white fill, a specular top edge and
    // its own hairline, so it reads as a piece of glass in a groove.
    const body = blockOf(INDICATOR)
    expect(body).not.toBeNull()
    expect(body).toMatch(/background: color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.7\)/)
    expect(body).toMatch(/inset 0 0 0 1px rgba\(19, 45, 83/)
  })

  it('keeps the tabs themselves transparent', () => {
    // The indicator carries the surface; a fill on the button as well would
    // double up and the sliding pane would disappear behind it.
    const body = blockOf("[data-dsh-float] [role='tablist']:not([data-dockkit-strip]):has(> span[aria-hidden='true']) > [role='tab']")
    expect(body).not.toBeNull()
    expect(body).toMatch(/background:\s*transparent/)
  })

  it('carries a dark recipe for the indicator and the track', () => {
    expect(blockOf(DARK_INDICATOR)).not.toBeNull()
    expect(flat).toContain("[data-dsh-float] body[data-ds-dark-theme] [role='tablist']:not([data-dockkit-strip])")
  })
})

describe('the workbench tab strip is left alone', () => {
  it('excludes every dockkit strip from the shared rules', () => {
    // The workbench's tabs live in `[data-dockkit-strip]` and already have their
    // own chip recipe. Without the guard these rules would repaint them too.
    for (const match of flat.matchAll(/[^{}]*\[role='tablist'\]:not\(\[data-dockkit-strip\]\)[^{}]*\{/g)) {
      expect(match[0]).toContain('[data-dockkit-strip]')
    }
  })

  it('does not touch a tab inside a dockkit strip', () => {
    for (const match of flat.matchAll(/[^{}]*\[role='tab'\][^{}]*\{/g)) {
      if (match[0].includes('data-dockkit-strip')) continue
      // Any other tab rule must be scoped through the tablist guard.
      expect(match[0]).toContain("[role='tablist']")
    }
  })
})

describe('a plain row of buttons is not a segmented control', () => {
  it('guards every rule that styles the container itself', () => {
    // Both host implementations render `span[aria-hidden]` as the sliding pane, and
    // that span is what makes the control a track. Plenty of plugins put
    // `role='tablist'` on a plain row of buttons — the ticket assistant's page nav
    // is one — and they have no such child. Without the guard this rule drew a tray
    // and a hairline around those rows.
    //
    // Rules that target the indicator (`> span[aria-hidden='true']`) are exempt:
    // they can only match when that child exists.
    for (const match of flat.matchAll(/[^{}]*\[role='tablist'\][^{}]*\{([^}]*)\}/g)) {
      const selector = match[0].slice(0, match[0].indexOf('{'))
      if (selector.includes("> span[aria-hidden='true']")) continue
      expect(selector).toContain(":has(> span[aria-hidden='true'])")
    }
  })

  it('never paints a bare tablist container', () => {
    // The unguarded selector must not appear as a rule head on its own.
    const unguarded = /\[role='tablist'\](?:[^\s{]*):not\(\[data-dockkit-strip\]\)\s*\{/g
    for (const match of flat.matchAll(unguarded)) {
      expect(match[0]).not.toBe("[role='tablist']:not([data-dockkit-strip]) {")
    }
  })
})

describe('the seam is the ARIA role, never a hashed class', () => {
  it('keys off role and the aria-hidden indicator', () => {
    expect(flat).toContain("[role='tablist']")
    expect(flat).toContain("> span[aria-hidden='true']")
  })

  it('names no module class in these rules', () => {
    for (const match of flat.matchAll(/[^{}]*\[role='tablist'\][^{}]*\{/g)) {
      expect(match[0]).not.toMatch(/\[class[*^$]?=/)
    }
  })
})
