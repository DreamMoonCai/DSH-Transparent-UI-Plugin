// @vitest-environment jsdom
/**
 * Glass on glass.
 *
 * Re-pointing the surface tokens made the panels inside a sheet translucent, but
 * a translucent wash is not glass: there is no blur behind it and no edge
 * catching light, so an account card or a balance card still reads as a flat grey
 * rectangle lying on the sheet.
 *
 * The seam is the class suffix. A CSS-module name keeps its local name after the
 * hash — `_6qcDqa_balanceCard` ends in `Card`, `_6qcDqa_card` ends in `_card` —
 * while the parts inside a card (`cardTop`, `cardTitle`, `cardCheckbox`) end
 * differently, which is what keeps a tint from landing behind a label.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Collapse whitespace so a wrapped selector still matches. */
const flat = aquaCss.replace(/\s+/g, ' ')

/** The declaration block of the first rule whose selector contains `needle`. */
function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

const CARD = "[data-dsh-aqua] body [role='dialog']:not([class*='backdrop']) :is([class$='Card'], [class$='_card'])"
const DARK_CARD = "[data-dsh-aqua] body[data-ds-dark-theme] [role='dialog']:not([class*='backdrop']) :is([class$='Card'], [class$='_card'])"
const HOVER_CARD = `${CARD}:is(:hover, :focus-within)`

describe('a panel inside a sheet is a layer of its own', () => {
  it('frosts what is behind it', () => {
    // A fill alone is a wash. Without a blur the panel is a flat rectangle on a
    // blurry plate, which is exactly what it looked like.
    expect(blockOf(CARD)).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('catches the light on its top edge', () => {
    expect(blockOf(CARD)).toMatch(/inset 0 1px 0 rgba\(255, 255, 255/)
  })

  it('lifts off the plate with a short shadow', () => {
    expect(blockOf(CARD)).toMatch(/0 1px 3px rgba\(19, 45, 83/)
  })

  it('rules a hairline of its own instead of the host stroke', () => {
    expect(blockOf(CARD)).toMatch(/border-color:/)
  })

  it('carries a dark recipe', () => {
    const dark = blockOf(DARK_CARD)
    expect(dark).not.toBeNull()
    expect(dark).toMatch(/color-mix\(in srgb/)
    expect(dark).toMatch(/backdrop-filter|box-shadow/)
  })
})

describe('a panel answers the pointer', () => {
  it('brightens and lifts under hover or focus', () => {
    const hover = blockOf(HOVER_CARD)
    expect(hover).not.toBeNull()
    expect(hover).toMatch(/background: color-mix/)
    expect(hover).toMatch(/0 2px 8px/)
  })

  it('transitions instead of snapping', () => {
    expect(blockOf(HOVER_CARD)).toMatch(/transition:/)
  })

  it('carries a dark hover too', () => {
    const dark = blockOf(`${DARK_CARD}:is(:hover, :focus-within)`)
    expect(dark).not.toBeNull()
    expect(dark).toMatch(/color-mix\(in srgb/)
  })
})

describe('the seam cannot repaint a card\'s insides', () => {
  it('matches only the card-level names', () => {
    // `cardTop`, `cardTitle` and `cardCheckbox` are parts inside a card: they end
    // in a capitalised word after `card`, not in `Card` or `_card`, so the two
    // `$=` suffixes skip them. A `*=` match would catch every one.
    for (const match of flat.matchAll(/[^{}]*:is\(\[class\$='Card'\][^{}]*\)[^{}]*\{/g)) {
      expect(match[0]).not.toMatch(/\[class\*='[^']*[Cc]ard/)
    }
  })

  it('stays inside the sheet, never global', () => {
    for (const match of flat.matchAll(/[^{}]*\[class\$='_?Card'\][^{}]*\{/g)) {
      expect(match[0]).toContain("[role='dialog']")
    }
  })
})
