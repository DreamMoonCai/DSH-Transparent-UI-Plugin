// @vitest-environment jsdom
/**
 * Secondary glass: a surface inside a card.
 *
 * The panels that host secondary rows — the environment card's change-request
 * list, the plugin manager's entry cards, the shortcuts reference, the trajectory
 * tables — all paint their nested surfaces with the shared
 * `--dsw-alias-bg-module-platform` token (85 rules across 46 host files), and the
 * forge rows additionally declare `--forge-card-surface` from it. That token was
 * a flat `#FFFFFF`, so every nested row landed as a white slab on the card it sits
 * in.
 *
 * This is the generic fix rather than a per-plugin one: the token is the host's
 * own second-level surface, so softening it lifts every consumer at once. What a
 * fill alone cannot do is catch the light, so the forge rows get the same top
 * highline and hairline the cards use.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeLayer = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')
const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

describe('the module-platform token is translucent', () => {
  /** The float-mode declaration (the first one in the file). */
  const line = (): string => themeLayer.split('\n').find(text => text.includes("'--dsw-alias-bg-module-platform':"))!
  const body = (): string => themeLayer.split('\n').filter(text => text.includes("'--dsw-alias-bg-module-platform':")).join('\n')

  it('no longer paints a flat white', () => {
    // Every secondary panel inside a card reads this token. A hex value makes all
    // of them opaque plates.
    for (const row of body().split('\n')) {
      expect(row).not.toMatch(/light: '#FFFFFF'/)
    }
  })

  it('carries an alpha in both schemes', () => {
    expect(line()).toMatch(/rgba\(/)
    const declarations = body()
    expect(declarations.match(/rgba\(/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps a dark value that is a pale ink, not navy', () => {
    // A dark navy fill would vanish against the dark card; the pale ink at low
    // alpha is what reads as a raised pane there.
    expect(line()).toMatch(/dark: 'rgba\(226, 236, 250/)
  })
})

describe('the menu surface is translucent too', () => {
  it('drops the flat value', () => {
    // Popovers, the queue dock, the todo panel, the goal bar, the Cordis panel
    // and the forge step cards all paint it. They already declare their own
    // `--dsw-menu-backdrop-filter`; a flat fill made that blur invisible.
    const row = themeLayer.split('\n').find(text => text.includes("'--dsw-specific-menu':"))!
    expect(row).toMatch(/rgba\(/)
  })
})

describe('a nested row catches the light', () => {
  const row = '[data-dsh-float] [data-forge-panel] [data-forge-change]'
  const dark = '[data-dsh-float] body[data-ds-dark-theme] [data-forge-panel] [data-forge-change]'

  it('gets a top highline and a hairline', () => {
    const body = blockOf(row)
    expect(body).not.toBeNull()
    expect(body).toMatch(/inset 0 1px 0 rgba\(255, 255, 255/)
    expect(body).toMatch(/inset 0 0 0 1px rgba\(255, 255, 255/)
  })

  it('carries a dark recipe', () => {
    expect(blockOf(dark)).not.toBeNull()
  })

  it('is keyed off the host attributes, never a hashed class', () => {
    for (const match of flat.matchAll(/[^{}]*\[data-forge-change\][^{}]*\{/g)) {
      expect(match[0]).not.toMatch(/\[class[*^$]?=/)
    }
  })

  it('leaves the row hover to the host', () => {
    // The host paints `--dsw-alias-interactive-bg-hover` on hover and on expand.
    // It still reads on a translucent fill, so no override of ours should shadow it.
    expect(flat).not.toMatch(/\[data-forge-change\]:hover\s*\{/)
  })
})
