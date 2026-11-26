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

const PANE = (selector: string) =>
  selector.includes('[data-dsh-details]') &&
  selector.includes('[data-dockkit-pane-body]') &&
  !selector.includes('[data-ds-dark-theme]')

const PANE_DARK = (selector: string) =>
  selector.includes('[data-dsh-details]') &&
  selector.includes('[data-dockkit-pane-body]') &&
  selector.includes('[data-ds-dark-theme]')

describe('a third-party pane inside the workbench card', () => {
  it('clears the canvas colour in the pane scope', () => {
    // dsh-github-flow paints its root with `var(--dsw-alias-bg-base)`, the
    // canvas colour, which this skin resolves to opaque #F4F8FD — the whole tab
    // became one plate filling the glass card. The token has to be cleared
    // where the pane lives.
    const bodies = bodiesFor(PANE).join(' ')
    expect(bodies).toMatch(/--dsw-alias-bg-base:\s*transparent/)
  })

  it('covers the docked host and the pane body, not just one of them', () => {
    // A plugin may mount its root on either box: the docked <section> is the
    // tab host, `[data-dockkit-pane-body]` is the div the pane renders into.
    const selectors = all.filter(rule => PANE(rule.selector)).map(rule => rule.selector).join(' ')
    expect(selectors).toContain('[data-dockkit-pane-body]')
    expect(selectors).toContain("[data-dockkit-host='dock']")
  })

  it('turns the layer tokens translucent in the same scope', () => {
    // The GitHub pane draws its own cards with bg-layer-1 and bg-layer-2; left
    // opaque they are white plates stacked on the glass.
    const bodies = bodiesFor(PANE).join(' ')
    for (const token of ['bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-module-platform']) {
      expect(bodies).toContain(`--dsw-alias-${token}: color-mix(`)
    }
    expect(bodies).toContain('--dsh-aqua-frost')
  })

  it('lands the layers in that order — a card still reads above the pane', () => {
    const bodies = bodiesFor(PANE).join(' ')
    const pct = (token: string) => {
      // The value nests parens (`rgb(255 255 255)` inside `color-mix`), so slice
      // from the token to its terminating semicolon and read the calc there.
      const at = bodies.indexOf(`--dsw-alias-${token}:`)
      if (at < 0) return null
      const decl = bodies.slice(at, bodies.indexOf(';', at))
      const match = /calc\((\d+)%/.exec(decl)
      return match === null ? null : Number(match[1])
    }
    const l1 = pct('bg-layer-1')
    const l2 = pct('bg-layer-2')
    const l3 = pct('bg-layer-3')
    expect(l1).not.toBeNull()
    expect(l2).not.toBeNull()
    expect(l3).not.toBeNull()
    expect(l1!).toBeGreaterThan(l2!)
    expect(l2!).toBeGreaterThan(l3!)
  })

  it('has a dark scheme on the same shape', () => {
    const bodies = bodiesFor(PANE_DARK).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
    expect(bodies).toContain('--dsw-alias-bg-layer-1: color-mix(')
  })

  it('never clears the canvas colour globally', () => {
    // The real canvas must keep its fill. Every rule that clears the token has
    // to be a glass surface's own scope — the workbench pane, a block card in
    // the transcript — and float mode only, so compat mode is untouched.
    const selectors = all
      .filter(rule => /--dsw-alias-bg-base:\s*transparent/.test(rule.body))
      .map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      const scoped =
        selector.includes('[data-dsh-details]') ||
        selector.includes('md-code-block') ||
        /\[data-(diff|read|terminal)\]/.test(selector)
      expect(scoped, `unscoped canvas clear: ${selector}`).toBe(true)
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
      expect(selector).not.toMatch(/^\s*(html|body|:root)\b/)
    }
  })

  it('keeps the ink and the hairlines on their own tokens', () => {
    // Only the surface family is re-pointed; label and border tokens are what
    // keep the text readable once the fill is gone.
    const bodies = bodiesFor(PANE).join(' ')
    expect(bodies).not.toContain('--dsw-alias-label-')
    expect(bodies).not.toContain('--dsw-alias-border-')
  })
})
