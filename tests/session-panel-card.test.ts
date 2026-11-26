// @vitest-environment jsdom
/**
 * DSH 0.2.3 moved the environment card out of the right column into its own
 * absolutely positioned `aside[data-session-panel]` floating over the
 * transcript. The host paints it with `background: var(--dsw-alias-bg-layer-1)`
 * plus `box-shadow: var(--dsw-elevation-panel)` — an opaque slab — so it stayed
 * the one panel that never turned to glass while the sidebar, the header, the
 * composer and the workbench card all did.
 *
 * These assertions pin the card recipe and the two scheme variants, and guard
 * the host's own geometry: the aside is positioned and sized by the host from
 * the chat gutter, so anything that changes `top`, `right`, `width` or
 * `max-height` would break that layout.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Declarations of the first rule whose selector text equals `selector`. */
function declarationsOf(selector: string): string {
  const start = aquaCss.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`missing rule: ${selector}`)
  const open = aquaCss.indexOf('{', start)
  const close = aquaCss.indexOf('}', open)
  return aquaCss.slice(open + 1, close)
}

function mountPanel(attributes: { dark?: boolean, overlay?: boolean } = {}): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  if (attributes.dark === true) document.body.setAttribute('data-ds-dark-theme', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  const presentation = attributes.overlay === true ? 'overlay' : 'docked'
  document.body.innerHTML = `<main><aside data-session-panel="${presentation}"><section></section></aside></main>`
  return document.querySelector('[data-session-panel]') as HTMLElement
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('the environment card turns to glass', () => {
  it('paints the shared card fill, not the host slab', () => {
    // jsdom cannot evaluate `color-mix`, so the declarations are asserted
    // against the source rule and the live computed box separately.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(card).toMatch(/border-radius:\s*20px/)
    expect(card).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/)
    // The host slab and its elevation are replaced, not layered on.
    expect(card).not.toContain('--dsw-alias-bg-layer-1')
    expect(card).not.toContain('--dsw-elevation-panel')
    const style = getComputedStyle(mountPanel())
    expect(style.borderRadius).toBe('20px')
  })

  it('takes the dark scheme variant', () => {
    const card = declarationsOf('[data-dsh-float] body[data-ds-dark-theme] aside[data-session-panel]')
    expect(card).toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\)/)
    expect(card).toMatch(/inset 0 0 0 1px rgba\(148, 180, 220, 0\.32\)/)
  })

  it('draws its ring without touching the border box', () => {
    // The host reserves `border-right: 2px solid transparent` as the
    // scrollbar's lane and derives its right padding from it
    // (`8px - 2px - scrollbar-width`) under `scrollbar-gutter: stable`.
    // An `inset` shadow is painted against the PADDING box, so that 2px
    // transparent border pushed the ring 2px inside the real right edge and
    // left a bare column. The border is dropped and the 2px moved into the
    // padding, so the ring lands on the box the eye sees and the lane survives.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).toMatch(/border-right:\s*0/)
    expect(card).toMatch(/padding-right:\s*calc\(8px - var\(--dsh-scrollbar-width, 6px\)\)/)
    // No width/style/colour on any other edge — the ring is the inset shadow.
    expect(card).not.toMatch(/\bborder(-top|-bottom|-left|-width|-style|-color)?\s*:/)
    expect(card).toMatch(/inset 0 0 0 1px rgba\(19, 45, 83, 0\.26\)/)
  })

  it('keeps the scrollbar lane the host reserved', () => {
    // The lane is the difference between the host's padding and ours: both add
    // up to `8px - scrollbar-width`, so the scrollbar's gutter stays put.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).toMatch(/padding-right:\s*calc\(8px - var\(--dsh-scrollbar-width, 6px\)\)/)
  })

  it('keeps the overlay presentation denser than the docked one', () => {
    // The overlay sits over live text rather than beside it, so it uses the
    // sticky recipe: the same glass, at a higher alpha, so rows do not read
    // through it.
    const overlay = declarationsOf("[data-dsh-float] aside[data-session-panel='overlay']")
    expect(overlay).toMatch(/background:\s*var\(--dsh-aqua-glass-sticky-light\)/)
  })

  it('leaves the host geometry alone', () => {
    // The host positions the aside from the chat gutter and caps its height
    // against the composer; overriding any of those would detach it. The
    // property name is matched at a declaration start — `\b` would also hit
    // `padding-right`.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    const declares = (name: string): boolean => new RegExp(`(^|[\\s;])${name}\\s*:`).test(card)
    expect(declares('top')).toBe(false)
    expect(declares('right')).toBe(false)
    expect(declares('width')).toBe(false)
    expect(declares('max-height')).toBe(false)
    expect(declares('position')).toBe(false)
  })

  it('matches the real host hook, not a hashed class name', () => {
    // The module class is build-hashed (`_2ImnHa_panel` today); the data
    // attribute is part of the panel's public surface.
    expect(aquaCss).toContain('aside[data-session-panel]')
  })
})

describe('the panel takes the same press as the other panes', () => {
  const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')
  const controller = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')

  it('is stamped as a spotlight pane', () => {
    expect(stamper).toContain("{ attribute: 'data-dsh-aqua-spot', selector: 'aside[data-session-panel]', first: true }")
  })

  it('clips the x axis so the glow overlay cannot grow a scrollbar', () => {
    // The glow overlay is absolutely positioned, so `overflow-x: clip` is the
    // guard on the axis the card must not scroll — the sections still need the
    // vertical one.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).toMatch(/overflow-x:\s*clip/)
    // The sections still scroll vertically.
    expect(card).not.toMatch(/overflow-y:/)
  })

  it('keeps the host position while hosting the glow', () => {
    // The generic pane rule sets `position: relative`, which would replace the
    // host's `absolute` and drop the card into the transcript flow.
    const guard = declarationsOf('[data-dsh-aqua][data-dsh-aqua-spotlight] aside[data-session-panel]')
    expect(guard).toMatch(/position:\s*absolute/)
  })

  it('stands still while a row menu is open', () => {
    // That menu is `position: fixed` and lives inside the card, so a live
    // transform would re-anchor it — the same reason the sidebar never tilts.
    expect(controller).toContain("const PANEL_MENU = '[role=\"menu\"]'")
    expect(controller).toMatch(/if \(spot\.matches\(SESSION_PANEL\) && spot\.querySelector\(PANEL_MENU\) !== null\) return false/)
  })
})
