import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two surfaces the transcript puts in the middle of prose, both of which were
 * painted with an opaque token and so stood out on the glass:
 *
 * 1. The inline code chip. Every `` `like this` `` is `:not(pre) > code` in the
 *    markdown body, and the renderer gives it
 *    `background-color: var(--dsw-alias-markdown-inline-code)` — `neutral-50`, an
 *    opaque warm grey — plus `border: .5px solid var(--dsw-alias-border-l1)`.
 *    On the glass that reads as a small grey ticket stuck to the page.
 * 2. The 查看 pill a tool call shows at its foot. It is
 *    `button[class*='inspectButton']` painted
 *    `background: var(--dsw-alias-bg-base)` — the canvas colour, opaque — inside
 *    a 999px capsule with a hairline, so it reads as a chip of paper.
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

describe('the inline code chip is a pane of the same glass', () => {
  const chips = all.filter(rule => /:not\(pre\)\s*>\s*code/.test(rule.selector))

  it('skins the inline chip and not the code block', () => {
    // `pre > code` is a fenced block and carries its own rules; only the
    // inline split belongs here.
    expect(chips.length).toBeGreaterThan(0)
    for (const rule of chips) {
      expect(rule.selector, rule.selector).toMatch(/:not\(pre\)\s*>\s*code/)
    }
  })

  it('replaces the opaque fill with the frost family', () => {
    const bodies = chips.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/background-color:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(bodies).toMatch(/background-color:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
  })

  it('out-specifies the host rule it replaces', () => {
    // The host's selector is `.markdown :not(pre) > code` — a class plus a type,
    // in a wrapper. A `[data-dsh-float] :not(pre) > code` prefix ties on
    // specificity and loses on source order, so the grey plate would survive.
    for (const rule of chips) {
      const attrs = rule.selector.match(/\[[^\]]+\]/g) ?? []
      expect(attrs.length, rule.selector).toBeGreaterThanOrEqual(2)
      expect(rule.selector, rule.selector).toMatch(/^html\[/)
    }
  })

  it('keeps a hairline, so the chip still reads as code', () => {
    const bodies = chips.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/border-color:\s*rgba\(19, 45, 83/)
    expect(bodies).toMatch(/border-color:\s*rgba\(148, 180, 220/)
  })
})

describe('the 查看 pill is a pane of the glass too', () => {
  const pills = all.filter(rule => rule.selector.includes("button[class*='inspectButton']"))

  it('matches the stem the host keeps across releases', () => {
    expect(pills.length).toBeGreaterThan(0)
    for (const rule of pills) {
      expect(rule.selector, rule.selector).toContain('[data-dsh-float]')
    }
    // The hashes move; the stem does not. The rule must key off the stem alone —
    // pinning a hash would break on the next host build.
    for (const match of flat.matchAll(/\[class\*='([^']+)'\]/g)) {
      if (match[1].includes('inspect')) expect(match[1]).toBe('inspectButton')
    }
  })

  it('does not plate the icon-only and link-shaped siblings', () => {
    // `M4PAiq_inspect` is a 24px borderless icon button and `YcWBLa_inspect` is
    // styled as a link; a fill on either would change their shape, not their
    // material.
    expect(flat).not.toMatch(/\[class\*='_inspect'\]/)
  })

  it('gives it the frost fill and keeps the host shape', () => {
    const bodies = pills.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(bodies).toMatch(/background:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
    // Shape, padding and the hover-reveal opacity belong to the host.
    expect(bodies).not.toMatch(/border-radius/)
    expect(bodies).not.toMatch(/padding/)
    expect(bodies).not.toMatch(/opacity:\s*[01]/)

    // The reveal itself must survive: the pill is invisible until the row is
    // hovered, and something has to carry that.
    expect(pills.some(rule => /opacity 100ms/.test(rule.body))).toBe(true)
  })
})
