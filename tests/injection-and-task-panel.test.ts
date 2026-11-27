import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two surfaces the user pointed at with screenshots, both of which turned out to
 * be the same mistake: a plate that paints itself and that none of the existing
 * rules named.
 *
 * - The plugin market's task popover (`.nUhMVa_opPanel`) hung over the page at
 *   48% white with no blur, so the cards underneath stayed legible as text.
 * - A context injection's expanded body is not a fenced code block even though
 *   it uses the same token: `ContextInjectionRow.module.css` gives its own
 *   `.body` a `background: var(--dsw-alias-markdown-code-block)`, so every
 *   `.md-code-block` rule walked past it.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

function ruleBody(selector: string): string {
  const at = flat.indexOf(selector)
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1)
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

describe('the market task panel is a popover, not a card', () => {
  it('takes the sticky recipe so rows behind it turn to tone', () => {
    const body = ruleBody("[data-dsh-float] [class*='opPanel']:not([class*='opPanelTitle'])")
    // Without a blur of its own the panel is only a wash: 48% white over text
    // still shows the text.
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-sticky-light\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 2\)\)/)
  })

  it('excludes the title span that shares the class stem', () => {
    // `opPanelTitle` is a span inside the panel head; a bare substring match
    // would give it a second frame and a shadow.
    expect(flat).toContain("[class*='opPanel']:not([class*='opPanelTitle'])")
  })

  it('keeps the running aggregate a step denser than the panel', () => {
    const body = ruleBody("[data-dsh-float] [class*='opPanel'] [class*='opAggregate']")
    expect(body).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).not.toMatch(/opRow/)
  })

  it('has a dark counterpart', () => {
    expect(flat).toContain(
      "[data-dsh-float] body[data-ds-dark-theme] [class*='opPanel']:not([class*='opPanelTitle'])"
    )
    expect(ruleBody("[data-dsh-float] body[data-ds-dark-theme] [class*='opPanel']:not([class*='opPanelTitle'])"))
      .toMatch(/background:\s*var\(--dsh-aqua-glass-sticky-dark\)/)
  })
})

describe('a context injection body is its own plate', () => {
  it('is keyed to the host attribute, not to a fenced code block', () => {
    // The class is build-hashed; `data-context-injection-body` is stamped by
    // ContextInjectionRow on exactly that div.
    expect(flat).toContain('[data-dsh-float] [data-context-injection-body]')
    expect(flat).not.toMatch(/md-code-block[^{]*\[data-context-injection-body\]/)
  })

  it('clears the code-block token before painting its own fill', () => {
    // Otherwise the token resolves to the opaque markdown-code-block colour and
    // the new background is painted over an opaque sibling value.
    const body = ruleBody('[data-dsh-float] [data-context-injection-body]')
    expect(body).toMatch(/--dsw-alias-markdown-code-block:\s*transparent/)
    expect(body).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 0\.6\)\)/)
  })

  it('has a dark counterpart', () => {
    const body = ruleBody('[data-dsh-float] body[data-ds-dark-theme] [data-context-injection-body]')
    expect(body).toMatch(/background:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
  })
})
