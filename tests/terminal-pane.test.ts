import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')

/** Strip comments so quoted selectors inside prose never reach an assertion. */
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

interface Rule {
  selector: string
  body: string
}

function rules(): Rule[] {
  const found: Rule[] = []
  let depth = 0
  let start = -1
  for (let index = 0; index < flat.length; index += 1) {
    const char = flat[index]
    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        const head = flat.slice(0, start)
        const open = head.lastIndexOf('}')
        found.push({
          selector: head.slice(open + 1).trim(),
          body: flat.slice(start + 1, index),
        })
        start = -1
      }
    }
  }
  return found
}

const all = rules()

function bodiesFor(predicate: (selector: string) => boolean): string[] {
  return all.filter(rule => predicate(rule.selector)).map(rule => rule.body)
}

const SCREEN = (selector: string) =>
  selector.includes('[data-sidebar-terminal]') &&
  selector.includes(':has(> :global(.xterm))') &&
  !selector.includes('[data-ds-dark-theme]')

const SCREEN_DARK = (selector: string) =>
  selector.includes('[data-sidebar-terminal]') &&
  selector.includes(':has(> :global(.xterm))') &&
  selector.includes('[data-ds-dark-theme]')

const VIEWPORT = (selector: string) =>
  selector.includes('[data-sidebar-terminal]') && selector.includes(':global(.xterm-viewport)')

describe('the terminal pane keeps its own sheet of glass', () => {
  it('finds the screen by structure, not by the hashed class', () => {
    // The screen's class name is build-hashed (`_70dcBq_screen` / `_4y1oNG_screen`
    // depending on the release), so it must be matched through xterm's own child.
    expect(bodiesFor(SCREEN).length).toBeGreaterThan(0)
  })

  it("escapes xterm's own class names past the CSS-module transform", () => {
    // `tsdown` runs this file through lightningcss with `cssModules`, which
    // rewrites EVERY bare class selector into `<hash>_<local>`. A bare `.xterm`
    // therefore compiled to `._4y1oNG_xterm` — a class xterm never puts on its
    // element — so the rule was inert and the terminal kept its opaque sheet.
    // xterm's names must arrive through `:global()`; the host's own sheet does
    // the same for `:global(.xterm-viewport)`.
    for (const name of ['.xterm', '.xterm-viewport']) {
      // Blank out the escaped occurrences first, so only a bare one can match.
      const outside = flat.replace(/:global\([^)]*\)/g, 'GLOBAL')
      const bare = new RegExp(`(^|[\\s,>+~])\\${name}(?![\\w-])`)
      expect(outside).not.toMatch(bare)
    }
    expect(flat).toContain(':global(.xterm)')
    expect(flat).toContain(':global(.xterm-viewport)')
  })

  it('gives xterm an opaque colour — a translucent one turns the canvas black', () => {
    // The pane feeds xterm its theme background from
    // `getComputedStyle(screen).backgroundColor`, and the host builds xterm with
    // the default `allowTransparency: false`. Under that option xterm composites
    // a translucent colour onto black, so a `color-mix(... , transparent)` fill
    // turned the whole terminal into a black rectangle. An opaque rgb()/hex is
    // the only kind it accepts, and a computed `color(srgb …)` would not parse.
    const bodies = bodiesFor(SCREEN).join(' ')
    const paints = [...bodies.matchAll(/background:\s*([^;]+);/g)].map(match => match[1].trim())
    expect(paints.length).toBeGreaterThan(0)
    for (const paint of paints) {
      // An opaque hex or rgb() with no alpha channel, and no token hop that
      // could resolve to something translucent later.
      expect(paint, `translucent screen fill: ${paint}`).toMatch(/^(#[0-9a-f]{6}|rgb\(\s*\d+ \d+ \d+\s*\))$/i)
    }
    expect(bodies).not.toMatch(/var\(--dsw-alias-bg-base\)/)
  })

  it('reads as an inset screen, not a flat panel', () => {
    const bodies = bodiesFor(SCREEN).join(' ')
    expect(bodies).toMatch(/border-radius:\s*14px/)
    expect(bodies).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.62\)/)
    expect(bodies).toMatch(/inset 0 0 0 1px rgba\(19, 45, 83, 0\.1\)/)
    expect(bodies).toMatch(/overflow:\s*hidden/)
  })

  it('has a dark counterpart on the same shape', () => {
    const bodies = bodiesFor(SCREEN_DARK).join(' ')
    expect(bodies).toMatch(/background:\s*#[0-9a-f]{6}/)
    expect(bodies).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.07\)/)
  })

  it('stops xterm from painting the fill a second time', () => {
    // The pane feeds xterm its theme background from the wrapper's computed
    // colour, and xterm writes that onto the viewport as an inline style. Only
    // `!important` reaches past it; without this the blur is covered.
    const bodies = bodiesFor(VIEWPORT)
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      expect(body).toMatch(/background:\s*transparent\s*!important/)
    }
  })

  it('leaves the rows, the scrollbar and the selection alone', () => {
    // Only the paint is dropped. Nothing else in the pane may be re-styled here,
    // or the terminal's own chrome (status bar, tab, menu) loses its material.
    const touched = all
      .filter(rule => rule.selector.includes('[data-sidebar-terminal]'))
      .map(rule => rule.selector)
    for (const selector of touched) {
      expect(selector).not.toMatch(/\.xterm-(rows|scroll-area|selection|helper)/)
    }
  })

  it('is scoped to float mode, so compat mode keeps the stock sheet', () => {
    const touched = all
      .filter(rule => rule.selector.includes('[data-sidebar-terminal]'))
      .map(rule => rule.selector)
    expect(touched.length).toBeGreaterThan(0)
    for (const selector of touched) {
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
    }
  })
})
