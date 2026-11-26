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

const BLOCK = (selector: string) =>
  selector.includes(':global(.md-code-block)') && !selector.includes('[data-ds-dark-theme]')

const BLOCK_DARK = (selector: string) =>
  selector.includes(':global(.md-code-block)') && selector.includes('[data-ds-dark-theme]')

const SHIKI = (selector: string) =>
  selector.includes(':global(.shiki)') && !selector.includes('[data-ds-dark-theme]')

describe('a code block in the transcript', () => {
  it('is found by the renderer’s literal class names', () => {
    // `md-code-block` is joined in by hand next to the hashed module class
    // (`ue(xt.block, 'md-code-block', …)`), so it survives a release.
    expect(bodiesFor(BLOCK).length).toBeGreaterThan(0)
    expect(bodiesFor(SHIKI).length).toBeGreaterThan(0)
  })

  it("escapes those names past the CSS-module transform", () => {
    // lightningcss rewrites every bare class selector in this file into
    // `<hash>_<local>`, which would turn `.md-code-block` into a class the
    // renderer never emits. `:global()` is the only way through.
    const outside = flat.replace(/:global\([^)]*\)/g, 'GLOBAL')
    expect(outside).not.toMatch(/(^|[\s,>+~])\.md-code-block(?![\w-])/)
    expect(outside).not.toMatch(/(^|[\s,>~])\.shiki(?![\w-])/)
  })

  it('clears the fills that land on all three layers', () => {
    // The block, its <pre> and the shiki <code> each paint
    // `--dsw-alias-markdown-code-block`; the banner wrap paints the canvas
    // colour. One token override clears the first family, the second clears the
    // banner.
    const bodies = bodiesFor(BLOCK).join(' ')
    expect(bodies).toMatch(/--dsw-alias-markdown-code-block:\s*transparent/)
    expect(bodies).toMatch(/--dsw-alias-bg-base:\s*transparent/)
  })

  it('reaches shiki’s inline background', () => {
    // The `<code>` carries `background: var(--shiki-background)` as an inline
    // style — a token override cannot touch it, only `!important` can.
    const bodies = bodiesFor(SHIKI)
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      expect(body).toMatch(/background:\s*transparent\s*!important/)
    }
  })

  it('carries its own material, so it reads as a pane', () => {
    const bodies = bodiesFor(BLOCK).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/--dsh-aqua-frost/)
    expect(bodies).toMatch(/border-radius:\s*16px/)
    expect(bodies).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.5\)/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('keeps the banner one notch above the block', () => {
    const bodies = bodiesFor(BLOCK).join(' ')
    const at = bodies.indexOf('--dsw-alias-markdown-code-block-banner:')
    expect(at).toBeGreaterThan(-1)
    const decl = bodies.slice(at, bodies.indexOf(';', at))
    expect(decl).toMatch(/color-mix\(/)
    expect(decl).toMatch(/calc\(20%/)
  })

  it('has a dark scheme on the same shape', () => {
    const bodies = bodiesFor(BLOCK_DARK).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
    expect(bodies).toMatch(/--dsw-alias-markdown-code-block-banner:\s*color-mix\(/)
  })

  it('stays in float mode, so compat keeps the stock slab', () => {
    const selectors = all
      .filter(rule => rule.selector.includes('md-code-block') || rule.selector.includes('.shiki'))
      .map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
    }
  })
})
