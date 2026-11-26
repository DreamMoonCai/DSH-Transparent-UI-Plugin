import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The token layer, and the level it has to be written at.
 *
 * Every surface token this skin re-points is declared by the host inside a
 * `body { … }` block: `--dsw-menu-surface-fill: #fcfdfeb3`,
 * `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)`,
 * `--dsw-specific-menu`, `--dsw-elevation-*`, and
 * `--dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2)`. An inherited
 * value never beats a declaration on the element itself, so a copy written on
 * `<html>` (which is what `[data-dsh-aqua]` selects) lost every time: the
 * popups kept the host's 70% white over a blur nobody could see, which is why
 * four rounds of selector work changed nothing about them.
 *
 * Two consequences are pinned here, because both are easy to undo by accident:
 *
 * 1. The menu family and the settings-card alias are declared on `body`.
 * 2. The alias is declared with a literal fill, not with
 *    `var(--dsw-alias-bg-layer-2)`. A `var()` in a custom property is
 *    substituted at the element that declares it, so an alias declared on
 *    `body` resolves layer-2 against the body's own opaque `#fff` and hands
 *    that flat white down to every card that reads the alias — no matter what
 *    the card's own scope does with layer-2.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\r\n/g, '\n')

function ruleBody(selector: string): string {
  const at = flat.indexOf(selector)
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1)
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

/** The body of the block that declares `declaration`, found from the declaration. */
function blockWith(declaration: string): string {
  const at = flat.indexOf(declaration)
  expect(at, `missing declaration: ${declaration}`).toBeGreaterThan(-1)
  const open = flat.lastIndexOf('{', at)
  expect(open, `no opening brace before: ${declaration}`).toBeGreaterThan(-1)
  const close = flat.indexOf('}', at)
  return flat.slice(open + 1, close)
}

describe('the menu token family is declared where the host declares it', () => {
  it('puts the blur on body, not on the html element', () => {
    const body = blockWith('--dsw-menu-backdrop-filter:')
    expect(body).toMatch(/--dsw-menu-backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 1\.5\)\)/)
    // The block has to be a body rule: an html-level copy can never win.
    const open = flat.lastIndexOf('{', flat.indexOf('--dsw-menu-backdrop-filter:'))
    const prelude = flat.slice(Math.max(0, open - 40), open)
    expect(prelude).toContain('body')
    // ...and the html-level block must not carry it.
    const html = ruleBody('[data-dsh-aqua] {')
    expect(html).not.toMatch(/--dsw-menu-backdrop-filter/)
    expect(html).not.toMatch(/--dsw-menu-surface-fill/)
  })

  it('answers the fill the primitive paints its material layer from', () => {
    const body = blockWith('--dsw-menu-surface-fill:')
    expect(body).toMatch(/--dsw-menu-surface-fill:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/--dsw-specific-menu:\s*var\(--dsw-menu-surface-fill\)/)
    expect(body).toMatch(/--dsw-alias-menu-group-header-fill:/)
  })

  it('supplies the elevation the sheet and the menus read', () => {
    const body = blockWith('--dsw-elevation-prominent:')
    expect(body).toMatch(/--dsw-elevation-prominent:\s*0 16px 44px/)
    expect(body).toMatch(/--dsw-elevation-panel:\s*0 8px 28px/)
  })

  it('has a dark counterpart on body', () => {
    const dark = flat.indexOf('[data-dsh-aqua] body[data-ds-dark-theme] {')
    expect(dark).toBeGreaterThan(-1)
    const body = flat.slice(dark, flat.indexOf('}', dark))
    expect(body).toMatch(/--dsw-menu-surface-fill:\s*color-mix\(in srgb, rgb\(28 32 42\)/)
    expect(body).toMatch(/--dsw-elevation-prominent:\s*0 16px 44px rgba\(2, 6, 14, 0\.55\)/)
  })
})

describe('the settings-card alias carries a literal fill', () => {
  it('re-declares the alias instead of letting body resolve it against opaque layer-2', () => {
    const body = blockWith('--dsw-alias-settings-card-fill:')
    const line = /--dsw-alias-settings-card-fill:\s*([^;]+);/.exec(body)
    expect(line, 'the alias has to be declared').not.toBeNull()
    // A `var(--dsw-…)` here would be substituted on body, against the opaque
    // layer-2 the host also holds there — the exact bug this rule exists to
    // fix. `var(--dsh-aqua-frost)` is the local knob and is expected.
    expect(line![1]).not.toMatch(/var\(--dsw-/)
    expect(line![1]).toMatch(/color-mix\(in srgb, rgb\(255 255 255\)/)
  })

  it('has a dark value with no theme token either', () => {
    const dark = flat.indexOf('[data-dsh-aqua] body[data-ds-dark-theme] {')
    const body = flat.slice(dark, flat.indexOf('}', dark))
    const line = /--dsw-alias-settings-card-fill:\s*([^;]+);/.exec(body)
    expect(line).not.toBeNull()
    expect(line![1]).not.toMatch(/var\(--dsw-/)
  })
})

describe('a menu keeps one plate, not two', () => {
  it('skips the surface that already carries the primitive material layer', () => {
    // The primitive puts `data-menu-material="translucent"` on the surface
    // element and paints `--dsw-menu-surface-fill` on a z-index -1 child. A
    // second wash on the surface itself stacks 62% over 62% and reads opaque.
    const body = ruleBody("[data-dsh-float] [role='menu']:not([data-menu-material])")
    expect(body).toMatch(/background:\s*color-mix/)
    expect(flat).toContain("[data-dsh-float] [data-composer-card] [role='menu']:not([data-menu-material])")
  })

  it('leaves a self-painted list alone only when it is the primitive', () => {
    // The exclusion is an attribute, so a plugin menu (the proxy picker is a
    // bare `role='listbox'`) still takes the rule below.
    expect(flat).toContain("[data-dsh-float] [role='listbox']:not([class*='backdrop'])")
  })
})

describe('an open dropdown keeps the viewport as its containing block', () => {
  it('drops the blur from a card that holds one', () => {
    // `backdrop-filter` makes the card the containing block for its
    // `position: fixed` descendants. The proxy page renders its picker as a
    // `position: fixed` `role='listbox'` inside such a card, so with the blur
    // on, the list was re-anchored to the card and clipped by the scroller.
    const at = flat.indexOf(":is([class$='Card'], [class$='_card']):not(")
    expect(at).toBeGreaterThan(-1)
    const head = flat.slice(at, at + 200)
    expect(head).toMatch(/\[role='listbox'\]/)
    expect(head).toMatch(/\[role='menu'\]/)
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', flat.indexOf('{', at)))
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 0\.6\)\)/)
  })
})

describe('the cost plugin flattens alpha, so its plates are named', () => {
  it('out-ranks the relative-colour fill with importance', () => {
    // `.cm-section` (and eleven siblings) declares its fill twice, the second
    // time as `background: rgb(from var(--dsw-alias-bg-layer-2, …) r g b / 1)`.
    // The `/ 1` pins the alpha inside the declaration, so only importance
    // reaches past it.
    const at = flat.indexOf(':global(.cm-section)')
    expect(at).toBeGreaterThan(-1)
    const chunk = flat.slice(at, at + 2400)
    expect(chunk).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\) !important/)
    expect(chunk).toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\) !important/)
  })

  it('leaves the class stems unhashed', () => {
    // These are plain strings in the plugin's injected sheet, not module names.
    expect(flat).toContain(':global(.cm-card)')
    expect(flat).toContain(':global(.cm-budget)')
    expect(flat).toContain(':global(.cm-simple-summary)')
  })
})

describe('a popover over rows is denser than a card', () => {
  it('gives the date picker the sticky recipe, not the card one', () => {
    const at = flat.indexOf("[class*='datePopover']")
    expect(at).toBeGreaterThan(-1)
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', flat.indexOf('{', at)))
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-sticky-light\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 2\)\)/)
  })
})
