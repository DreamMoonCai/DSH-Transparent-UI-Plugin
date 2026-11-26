import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The press is `perspective(800px) rotateX/Y(±1°) scale(1.01)`. The rotation
 * lifts one edge toward the viewer and the projection magnifies that side by
 * `800 / (800 - z)`; on a card as wide as the centre column the lifted half is
 * ~800px from the pivot, so z ≈ 14px and that half grows ~14px, plus ~8px from
 * the 1% scale. The card's side margin is 16px, so the lifted edge runs past it —
 * and `.frame` and `.centerCol` both clip with `overflow: hidden`, which cut that
 * sliver off. Pressing from the far right lifted the LEFT edge, and the left edge
 * was the part that vanished.
 *
 * `overflow: clip` plus `overflow-clip-margin` is the fix: it moves the paint
 * boundary without creating a scroll container, so no scrollbar appears or
 * disappears and nothing reflows.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
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

/** Rules that lift the clipping boundary off the columns. */
const MARGIN = all.filter(rule => /overflow-clip-margin\s*:/.test(rule.body))

describe('the press may paint outside its column', () => {
  it('gives the columns a clip margin rather than a hidden box', () => {
    expect(MARGIN.length).toBeGreaterThan(0)
    const bodies = MARGIN.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/overflow:\s*clip/)
    expect(bodies).toMatch(/overflow-clip-margin:\s*\d+px/)
  })

  it('covers both the frame and the centre column', () => {
    const selectors = MARGIN.map(rule => rule.selector).join(' ')
    expect(selectors).toMatch(/\[data-dsh-frame\]\s*(,|$|\{)/)
    expect(selectors).toContain("centerCol")
  })

  it('leaves enough room for the projected lift', () => {
    // 14px of projection on a 1440px card plus 8px of scale. Anything under 24px
    // still clips the corner the user pointed at.
    for (const rule of MARGIN) {
      const match = /overflow-clip-margin:\s*(\d+)px/.exec(rule.body)
      expect(match, rule.selector).not.toBeNull()
      expect(Number(match![1])).toBeGreaterThanOrEqual(24)
    }
  })

  it('does not turn the columns into scroll containers', () => {
    // `overflow: hidden` would still allow programmatic scrolling, so a focus
    // call could shift the whole column sideways. `clip` cannot scroll at all.
    for (const rule of MARGIN) {
      expect(rule.body).not.toMatch(/overflow(-x|-y)?:\s*hidden/)
      expect(rule.body).not.toMatch(/overflow(-x|-y)?:\s*auto/)
      expect(rule.body).not.toMatch(/overflow(-x|-y)?:\s*scroll/)
    }
  })

  it('stays inside float mode', () => {
    // Compat mode keeps the stock geometry, which has no card to lift.
    for (const rule of MARGIN) {
      expect(rule.selector, rule.selector).toContain('[data-dsh-float]')
    }
  })
})
