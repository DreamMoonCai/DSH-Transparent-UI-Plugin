import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The four surfaces the user pointed at with DevTools open, each of which had a
 * different reason for being wrong — which is exactly why they are pinned
 * separately instead of with one "the glass is applied" assertion.
 *
 * 1. The glow on a big pane. `GLOW_RADIUS` was a flat 180px, tuned on the
 *    official card. A main panel is several times that size, so the radial landed
 *    as a disc in the middle and stopped: the user's screenshot of the live DOM
 *    showed `radial-gradient(180px at 973px 5px, …)` inside an element hundreds
 *    of pixels wide.
 * 2. The press being clipped. The paint boundary was lifted off `.frame` and
 *    `.centerCol`, but `html, body` carry `overflow: hidden` from the app's base
 *    sheet and `#root` fills the window, so the sliver was cut one level up.
 * 3. The history rail's preview card. It is `role='tooltip'` with an inline
 *    `--turn-preview-center`; the tooltip rule caught it and left its own opaque
 *    `--dsw-alias-bg-layer-1` fill in place.
 * 4. The Cursor child-agent panel. It does read `--dsh-surface`, but it also
 *    hard-codes its radius, border and shadow as inline styles.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const spotlight = readFileSync(resolve(__dirname, '../src/client/spotlight.ts'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the glow reaches the whole pane, not its left half', () => {
  it('keeps the flat radius the effect was tuned on', () => {
    // Enlarging the radius was the wrong lever and is not the fix: the DevTools
    // reading showed the radial was clipped by the overlay's own box, so a bigger
    // disc changed nothing past that edge.
    expect(spotlight).toMatch(/const GLOW_RADIUS = 180/)
    expect(spotlight).not.toMatch(/GLOW_SPREAD/)
    expect(spotlight).toMatch(/radial-gradient\(\$\{GLOW_RADIUS\}px at /)
  })

  it('takes the overlay box back from the panel layout', () => {
    // Main panels lay their children out with
    // `.page > * { flex: none; width: 100%; max-width: 960px }`, and the glow div
    // IS one of those children. A pinned `width` overrides the `right: 0` that
    // `inset: 0` wrote, so the overlay stopped at 960px while the pane ran the
    // full window; past that line the cursor centre fell outside the element and
    // the right half never lit.
    const key = '[data-dsh-aqua][data-dsh-aqua-spotlight] [data-dsh-aqua-glow]'
    const chunk = flat.slice(flat.indexOf(key))
    const body = chunk.slice(chunk.indexOf('{') + 1, chunk.indexOf('}'))
    expect(body).toMatch(/position:\s*absolute/)
    expect(body).toMatch(/width:\s*auto/)
    expect(body).toMatch(/max-width:\s*none/)
  })
})

describe('the turn navigator preview is a pane, not a tooltip', () => {
  it('keys off the inline placement variable', () => {
    const hit = flat.match(/\[role='tooltip'\]\[style\*='--turn-preview-center'\]/)
    expect(hit, 'the preview card is the only tooltip carrying that variable').not.toBeNull()
  })

  it('gives it the card material in both schemes', () => {
    const rules = flat.split('}').filter(chunk => chunk.includes('--turn-preview-center'))
    const body = rules.join('}')
    expect(body).toMatch(/var\(--dsh-aqua-glass-card-light\)/)
    expect(body).toMatch(/var\(--dsh-aqua-glass-card-dark\)/)
  })

  it('blurs harder than the chips around it', () => {
    // A preview sits over running text; the sheet's own 14px let the transcript
    // read through. 1.4× is the multiplier the rest of the elevation family uses.
    const body = flat.slice(flat.indexOf('--turn-preview-center'))
    expect(body.slice(0, 600)).toMatch(/blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 1\.4\)\)/)
  })
})

describe('a third-party panel is polished past its own inline styles', () => {
  it('matches the Cursor panel by the variable it alone sets', () => {
    const hit = flat.match(/div\[style\*='--dsh-surface'\]/)
    expect(hit, 'the inline --dsh-surface background is the panel-only hook').not.toBeNull()
  })

  it('overrides the inline radius, border and shadow', () => {
    const chunk = flat.slice(flat.indexOf("div[style*='--dsh-surface']"))
    // Everything before the first brace is the selector, not a declaration.
    const body = chunk.slice(chunk.indexOf('{') + 1, chunk.indexOf('}'))
    // Inline styles lose only to !important, so each of the three must carry it.
    for (const property of ['border-radius', 'border:', 'box-shadow']) {
      const line = body.split(/;\s*/).map(part => part.trim()).find(part => part.startsWith(property))
      expect(line, property).toBeDefined()
      expect(line, property).toContain('!important')
    }
  })

  it('uses the page ink for its shadow, not pure black', () => {
    const chunk = flat.slice(flat.indexOf("div[style*='--dsh-surface']"))
    const body = chunk.slice(0, chunk.indexOf('}'))
    expect(body).toMatch(/rgba\(19, 45, 83/)
  })
})
