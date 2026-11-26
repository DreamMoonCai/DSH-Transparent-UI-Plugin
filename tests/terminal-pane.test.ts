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

  it('replaces the opaque canvas fill with the secondary glass', () => {
    const bodies = bodiesFor(SCREEN).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/rgb\(255 255 255\)/)
    expect(bodies).toMatch(/--dsh-aqua-frost/)
    // The host value was the opaque canvas colour; it must not survive.
    expect(bodies).not.toMatch(/var\(--dsw-alias-bg-base\)/)
  })

  it('reads as an inset screen, not a flat panel', () => {
    const bodies = bodiesFor(SCREEN).join(' ')
    expect(bodies).toMatch(/border-radius:\s*14px/)
    expect(bodies).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.5\)/)
    expect(bodies).toMatch(/inset 0 0 0 1px rgba\(255, 255, 255, 0\.16\)/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('blurs behind the screen so the water still shows through', () => {
    const bodies = bodiesFor(SCREEN).join(' ')
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 0\.7\)\)/)
  })

  it('has a dark counterpart on the same shape', () => {
    const bodies = bodiesFor(SCREEN_DARK).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
    expect(bodies).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.06\)/)
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
