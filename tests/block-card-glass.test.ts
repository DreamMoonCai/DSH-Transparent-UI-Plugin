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

const BLOCK = (selector: string) =>
  /\[data-(diff|read|terminal)\]/.test(selector) &&
  !selector.includes('[data-ds-dark-theme]') &&
  !selector.includes(':first-child')

const BLOCK_DARK = (selector: string) =>
  /\[data-(diff|read|terminal)\]/.test(selector) &&
  selector.includes('[data-ds-dark-theme]') &&
  !selector.includes(':first-child')

describe('the block cards a tool call prints', () => {
  it('covers all three block primitives', () => {
    // DiffBlock, ReadBlock and the terminal block share one card class and one
    // fill; each carries its own marker attribute on the card root.
    const selectors = all.filter(rule => BLOCK(rule.selector)).map(rule => rule.selector).join(' ')
    for (const marker of ['[data-diff]', '[data-read]', '[data-terminal]']) {
      expect(selectors).toContain(marker)
    }
  })

  it('is not keyed off the markdown fence hook', () => {
    // `md-code-block` is the fenced-code renderer. These cards never carry it,
    // which is why the fence rule left them opaque.
    const selectors = all.filter(rule => BLOCK(rule.selector)).map(rule => rule.selector).join(' ')
    expect(selectors).not.toContain('md-code-block')
  })

  it('clears every fill the card paints', () => {
    // `.card` fills `--dsw-alias-markdown-code-block`; `.header` repeats it
    // through `--dsl-code-block-background`.
    const bodies = all.filter(rule => BLOCK(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsw-alias-markdown-code-block:\s*transparent/)
    expect(bodies).toMatch(/--dsl-code-block-background:\s*transparent/)
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('keeps the two sides of a diff distinguishable', () => {
    const bodies = all.filter(rule => BLOCK(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsw-alias-code-diff-added:\s*color-mix\(/)
    expect(bodies).toMatch(/--dsw-alias-code-diff-deleted:\s*color-mix\(/)
  })

  it('separates the header strip from the rows', () => {
    const bodies = all
      .filter(rule => /\[data-(diff|read|terminal)\]/.test(rule.selector) && rule.selector.includes(':first-child'))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/border-bottom:/)
  })

  it('re-tints for dark mode', () => {
    const bodies = all.filter(rule => BLOCK_DARK(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
    expect(bodies).toMatch(/--dsw-alias-code-diff-added:\s*color-mix\(/)
  })

  it('keeps the failed-call I/O plate one step lighter', () => {
    // A tool that fails prints an input/output card under the diff. It is a
    // second plate on the same fill, so it takes a lighter wash, not the card.
    const selectors = all
      .filter(rule => rule.selector.includes("[class*='ioCard']"))
      .map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
    }
  })

  it('only touches float mode', () => {
    const selectors = all
      .filter(rule => /\[data-(diff|read|terminal)\]/.test(rule.selector))
      .map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
    }
  })
})
