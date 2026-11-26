import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two surfaces that sit right on top of the composer and were left as opaque
 * plates.
 *
 * 1. Inline code in the update-notes panel. The chip rule deliberately carries NO
 *    `backdrop-filter`. A chip is an inline element and it wraps: `code` spanning
 *    two lines is two fragments, and Chromium pulls the element's own painted text
 *    into the blurred region for the fragment after the break, so half the sentence
 *    smeared. The fill and the highline are the whole effect anyway.
 *
 * 2. The queued-message dock. The host paints `.panel::before` with
 *    `var(--dsw-specific-menu)` — the menu family's 70% white, tuned to sit over
 *    arbitrary page content — and rounds it at `--dsw-radius-lg` (16px) because the
 *    stock composer card is 16px. In this skin the slab is 24px, so the stack's
 *    shoulders did not line up with the card beneath it.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

function ruleBody(selector: string): string {
  const at = flat.indexOf(selector)
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1)
  return flat.slice(flat.indexOf('{', at) + 1, flat.indexOf('}', at))
}

describe('the inline code chip', () => {
  const chip = ruleBody('html[data-dsh-float][data-dsh-aqua] :not(pre) > code')

  it('carries no backdrop-filter, because it wraps', () => {
    // The regression: a blurred inline element that breaks across lines blurs its
    // own text on the following fragment. This is the one mark in the prose that
    // must not have a filter.
    expect(chip).not.toMatch(/backdrop-filter/)
    expect(chip).not.toMatch(/(^|[\s;])filter\s*:/)
  })

  it('still reads as a chip: a fill, a hairline and a highline', () => {
    expect(chip).toMatch(/background-color:\s*color-mix\(/)
    expect(chip).toMatch(/border-color:/)
    expect(chip).toMatch(/box-shadow:\s*inset 0 1px 0/)
  })

  it('keeps a dark variant', () => {
    expect(flat).toContain(
      'html[data-dsh-float][data-dsh-aqua] body[data-ds-dark-theme] :not(pre) > code'
    )
  })
})

describe('the queued-message dock', () => {
  it('takes the card material instead of the menu wash', () => {
    // `[data-queue-dock]` is the host's own attribute on the dock's root div.
    const body = ruleBody("[data-dsh-float] [data-queue-dock] [class*='panel']::before")
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
  })

  it('matches the fused slab radius so the shoulders line up', () => {
    // The slab the dock sits on is 24px in this skin; the host rounds the dock at
    // 16px because the stock card is 16px. Anchored on the `{` so the `::before`
    // rule above it is not what gets read.
    const panel = ruleBody("[data-dsh-float] [data-queue-dock] [class*='panel'] {")
    expect(panel).toMatch(/border-radius:\s*24px 24px 0 0/)
    const slab = ruleBody('[data-dsh-float] [data-dsh-inputbar]:has([data-dsh-stats])')
    expect(slab).toMatch(/border-radius:\s*24px/)
  })

  it('has a dark counterpart', () => {
    expect(flat).toMatch(
      /\[data-dsh-float\] body\[data-ds-dark-theme\] \[data-queue-dock\] \[class\*='panel'\]::before/
    )
  })

  it('drops the opaque canvas chips onto the same material', () => {
    // `.F07MqG_file` and `.F07MqG_thumb` paint `var(--dsw-alias-bg-base)`.
    const body = ruleBody("[data-dsh-float] [data-queue-dock] :is([class*='file'], [class*='thumb'])")
    expect(body).toMatch(/background:\s*color-mix\(/)
  })
})
