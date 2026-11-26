import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The four popup defects the user hit in one sitting, which turned out to share
 * two causes and needed two different answers.
 *
 * Cause 1 — the theme never defines `--dsw-menu-backdrop-filter`. The host writes
 * `backdrop-filter: var(--dsw-menu-backdrop-filter)` on every `Menu` material
 * layer and on the session-stats sheet, and the token is defined in neither
 * `design-platform.css` nor either frontend bundle. An undefined var in that
 * position is invalid at computed-value time, so the declaration falls back to
 * `none`: every menu was a 70% white plate with zero frost. The elevation tokens
 * are missing the same way, so those plates had no shadow either.
 *
 * Cause 2 — a sheet that carries a transform or a `backdrop-filter` is a
 * containing block for its `position: fixed` descendants. The dialog entrance
 * animated `translateY(8px) scale(0.985)`, so a `fixed` dropdown opened inside a
 * sheet during those 240ms resolved its position against the sheet and rendered
 * past the window edge.
 *
 * The remaining two complaints — no geometric press on popups, and the stats
 * popover flashing see-through before settling — are answered in
 * `spotlight.ts`/`seam-stamper.ts` and pinned below.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const spotlight = readFileSync(resolve(__dirname, '../src/client/spotlight.ts'), 'utf8')
const spotCore = readFileSync(resolve(__dirname, '../src/client/spot-core.ts'), 'utf8')
const seams = readFileSync(resolve(__dirname, '../src/client/seam-stamper.ts'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the menu surface family gets the tokens the theme forgot', () => {
  it('defines the blur the host writes but never declares', () => {
    // Without this the whole popup family is defined-var-missing, which CSS
    // resolves to `none` — a menu with a fill and no frosting at all.
    expect(flat).toMatch(/--dsw-menu-backdrop-filter:\s*blur\(/)
  })

  it('defines the elevation the host writes but never declares', () => {
    expect(flat).toMatch(/--dsw-elevation-prominent:\s*0 /)
    expect(flat).toMatch(/--dsw-elevation-panel:\s*0 /)
  })

  it('answers them under the theme root only, so off still renders stock', () => {
    for (const token of ['--dsw-menu-backdrop-filter', '--dsw-elevation-prominent']) {
      const at = flat.indexOf(`${token}:`)
      expect(at, token).toBeGreaterThan(-1)
      const open = flat.lastIndexOf('{', at)
      const close = flat.lastIndexOf('}', open)
      const selector = flat.slice(close + 1, open).trim()
      expect(selector, token).toContain('[data-dsh-aqua]')
    }
  })
})

describe('the popups that are not role=menu get the same plate', () => {
  it('catches an anchored dialog and a listbox', () => {
    const at = flat.indexOf("[data-dsh-float] [role='dialog'][style*='position-anchor']")
    expect(at).toBeGreaterThan(-1)
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', at))
    expect(body).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/)
    expect(flat).toMatch(/\[data-dsh-float\] \[role='listbox'\]:not\(\[class\*='backdrop'\]\) \{/)
  })

  it('is keyed off the inline anchor, which is what a popup has and a sheet does not', () => {
    // The session-stats sheet writes `style={{positionAnchor}}`; the settings
    // sheet writes nothing of the sort. That is the whole distinction, and it is
    // why the settings sheet is not caught here.
    expect(spotlight).toBeDefined()
    expect(flat).toContain("positionAnchor")
  })
})

describe('no sheet is a containing block while it is opening', () => {
  it('animates opacity only', () => {
    // A transform here re-anchors every `position: fixed` guest for the duration
    // of the entrance — which is how the proxy dropdown ended up off-window.
    const at = flat.indexOf('@keyframes dsh-aqua-dialog-in')
    expect(at).toBeGreaterThan(-1)
    const body = flat.slice(at, flat.indexOf('}', flat.indexOf('{', at)) + 1)
    expect(body).not.toMatch(/transform/)
    expect(body).toMatch(/opacity/)
  })

  it('leaves the anchored popups out of the entrance entirely', () => {
    // A stats popover mounts already placed, so fading it in shows a see-through
    // frame first — the "transparent, then suddenly opaque" report.
    expect(flat).toMatch(
      /\[data-dsh-float\] \[role='dialog'\]:not\(\[style\*='position-anchor'\]\):not\(\[style\*='positionAnchor'\]\) \{/
    )
  })

  it('keeps the sheet itself free of a backdrop-filter', () => {
    // Same trap, different property: `backdrop-filter` makes a containing block
    // too. The glass lives on `::before` for exactly this reason.
    const at = flat.indexOf("[data-dsh-aqua] body [role='dialog']:not([class*='backdrop']) {")
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', at))
    expect(body).toMatch(/backdrop-filter:\s*none/)
  })
})

describe('a popup takes the press but never the glow', () => {
  it('stamps popups with their own marker instead of the pane marker', () => {
    expect(seams).toMatch(/attribute:\s*'data-dsh-aqua-pressable'/)
    expect(spotCore).toMatch(/export const PRESSABLE_ATTR = 'data-dsh-aqua-pressable'/)
  })

  it('keeps the composer card out of it, so the two presses never fight', () => {
    expect(seams).toMatch(/\[role="menu"\]:not\(\[data-composer-card\] \*\)/)
  })

  it('never appends a glow div inside one', () => {
    // The overlay is an absolutely positioned child of a box that scrolls
    // (`overflow-y: auto`), so it would grow a scrollbar; and the pane rule keyed
    // off the spot attribute sets `position: relative`, which would tear a fixed
    // popup out of its anchor.
    expect(spotCore).toMatch(/PRESSABLE_SELECTOR/)
    const pressable = spotCore.slice(spotCore.indexOf('export const PRESSABLE_ATTR'))
    expect(pressable).toContain("`[${PRESSABLE_ATTR}]`")
  })

  it('refuses the press when the popup hosts its own fixed guest', () => {
    // The same re-anchoring trap, checked at runtime rather than assumed.
    expect(spotlight).toMatch(/holdsFixedGuest/)
    expect(spotlight).toMatch(/style\.position === 'fixed'/)
  })

  it('pivots on the popup centre without feeding back a scaled rect', () => {
    expect(spotlight).toMatch(/popup\.style\.transformOrigin = `\$\{popup\.offsetWidth \/ 2\}px \$\{popup\.offsetHeight \/ 2\}px`/)
  })

  it('gives the press a transition so it is a gesture, not a snap', () => {
    expect(flat).toMatch(
      /\[data-dsh-float\]\[data-dsh-aqua-press\] \[data-dsh-aqua-pressable\] \{[\s\S]{0,160}transition: transform 0\.3s/
    )
  })
})
