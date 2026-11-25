// @vitest-environment jsdom
/**
 * The glow and the press belong to the card, not to a strip of buttons inside it.
 *
 * Two mistakes met here. The seam that stamps a spotlight pane used a bare
 * `header` selector, so on any page that replaces the main column with its own
 * panel it matched that panel's toolbar row instead of the conversation header —
 * the glow and the press landed on a 56px strip holding the "add plugin" button,
 * and the transform clipped that button against the card edge. And the panel
 * itself was never stamped at all, so the big card around the toolbar stayed
 * inert while its contents answered the pointer.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')
const controller = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')
const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** The stamper's array of seams, evaluated as data. */
function seams(): { attribute: string, selector: string, first?: boolean }[] {
  const body = /const SEAMS: readonly Seam\[\] = \[([\s\S]*?)\n\]/.exec(stamper)
  expect(body).not.toBeNull()
  const rows: { attribute: string, selector: string, first?: boolean }[] = []
  for (const match of body![1].matchAll(/\{\s*attribute: '([^']+)',\s*selector: '([^']*(?:\\'[^']*)*)'(?:,\s*first: true)?\s*\}/g)) {
    rows.push({ attribute: match[1], selector: match[2].replace(/\\'/g, "'"), first: true })
  }
  return rows
}

const spotSelectors = (): string[] =>
  seams().filter(seam => seam.attribute === 'data-dsh-aqua-spot').map(seam => seam.selector)

describe('the spotlight header seam cannot land on a panel toolbar', () => {
  it('qualifies the header selector', () => {
    const header = spotSelectors().find(selector => selector.startsWith('header'))
    expect(header).toBeDefined()
    // A bare `header` matches the toolbar a main-area panel draws for itself.
    expect(header).not.toBe('header')
  })

  it('excludes a header inside a main-area panel', () => {
    const header = spotSelectors().find(selector => selector.startsWith('header'))!
    expect(header).toContain("[data-plugin-panel] *")
  })
})

describe('the panel card itself answers the pointer', () => {
  it('stamps the plugin manager page root', () => {
    // `section[data-plugin-panel]` is the stable hook: the page's class names are
    // build-hashed, so keying off one of those would break on a rebuild.
    expect(spotSelectors()).toContain('section[data-plugin-panel]')
  })

  it('stamps only the first one, so a nested panel cannot double up', () => {
    const seam = seams().find(entry => entry.selector === 'section[data-plugin-panel]')
    expect(seam?.first).toBe(true)
  })
})

describe('the panel press has the same guard as the sidebar', () => {
  it('stands still while its own fixed menu is open', () => {
    // The toolbar's "add plugin" dropdown is `position: fixed` from a trigger
    // inside the page. A live transform re-anchors it into the card — the same
    // trap the sidebar and the workbench card already guard.
    expect(controller).toContain('const PLUGIN_PANEL')
    expect(controller).toMatch(/if \(spot\.matches\(PLUGIN_PANEL\) && spot\.querySelector\(PLUGIN_MENU\) !== null\) return false/)
  })

  it('still presses when no menu is open', () => {
    // The guard must be conditional: an unconditional `return false` would give
    // the panel the glow alone and the press would never happen.
    expect(controller).not.toMatch(/if \(spot\.matches\(PLUGIN_PANEL\)\) return false/)
  })
})

describe('the sheet card rules do not reach a main-area panel', () => {
  it('scopes every glass-on-glass card rule to a dialog', () => {
    for (const match of aquaCss.matchAll(/[^{}]*\[class\$='_?Card'\][^{}]*\{/g)) {
      expect(match[0]).toContain("[role='dialog']")
    }
  })
})
