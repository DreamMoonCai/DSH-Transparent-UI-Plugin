// @vitest-environment jsdom
/**
 * The right workbench card is the third floating pane (with the sidebar and
 * the header). It had three defects that all came from the same place — the
 * card was styled as a plain glass element and was never added to the
 * spotlight seam list, so it took neither the cursor glow nor the hover press,
 * and its content sat flush against the glass edge.
 *
 * These assertions pin the three halves of the fix:
 * - the card is stamped as a spotlight pane, so the glow/tilt machinery
 *   reaches it;
 * - the glass moved onto ::before (a `backdrop-filter` on the element would
 *   make it the containing block of the dockkit floating pane);
 * - the docked pane is inset into the card instead of being painted across
 *   the full column track.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')

/** Declarations of the first rule whose selector list contains `selector`. */
function declarationsOf(selector: string): string {
  // The rule may sit in a selector list, so the selector can be followed by
  // `,` instead of ` {`.
  let start = -1
  for (const tail of [' {', ',']) {
    const at = aquaCss.indexOf(`${selector}${tail}`)
    if (at >= 0 && (start < 0 || at < start)) start = at
  }
  if (start < 0) throw new Error(`missing rule: ${selector}`)
  const open = aquaCss.indexOf('{', start)
  const close = aquaCss.indexOf('}', open)
  return aquaCss.slice(open + 1, close)
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('right workbench card joins the floating panes', () => {
  it('stamps the details seam as a spotlight pane', () => {
    expect(stamper).toContain("{ attribute: 'data-dsh-aqua-spot', selector: '[data-dsh-details]', first: true }")
  })

  it('insets the card on all four sides like the sidebar', () => {
    const card = declarationsOf("[data-dsh-float] [data-dsh-details]")
    expect(card).toMatch(/margin:\s*12px/)
    expect(card).toMatch(/border-radius:\s*20px/)
  })

  it('sits the card in its own stacking context', () => {
    const card = declarationsOf("[data-dsh-float] [data-dsh-details]")
    expect(card).toMatch(/isolation:\s*isolate/)
    expect(card).toMatch(/position:\s*relative/)
  })
})

describe('right workbench glass lives on ::before', () => {
  it('keeps backdrop-filter off the card itself', () => {
    const card = declarationsOf("[data-dsh-float] [data-dsh-details]")
    expect(card).toMatch(/backdrop-filter:\s*none/)
    expect(card).not.toMatch(/backdrop-filter:\s*blur/)
    expect(card).toMatch(/background:\s*transparent/)
  })

  it('carries the frosted fill on the pseudo-element', () => {
    expect(declarationsOf("[data-dsh-float] [data-dsh-details]::before"))
      .toMatch(/backdrop-filter:\s*blur\(/)
    expect(declarationsOf("[data-dsh-float] body[data-ds-dark-theme] [data-dsh-details]::before"))
      .toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\)/)
  })
})

describe('docked pane is inset into the card', () => {
  it('releases the inline track width so the pane follows the inset box', () => {
    const pane = declarationsOf("[data-dsh-float] [data-dsh-details] [data-sidebar-right-panel='push']")
    expect(pane).toMatch(/width:\s*auto\s*!important/)
    expect(pane).toMatch(/inset:\s*10px 12px 12px/)
  })

  it('keeps the host inline geometry when the card is off', () => {
    document.documentElement.setAttribute('data-dsh-aqua', '')
    document.head.innerHTML = `<style>${aquaCss}</style>`
    document.body.innerHTML = '<div data-dsh-details><div data-sidebar-right-panel="push" style="width:420px"></div></div>'
    const pane = document.querySelector('[data-sidebar-right-panel]') as HTMLElement
    // Without the float gate the plugin must not touch the host's own width.
    expect(getComputedStyle(pane).width).toBe('420px')
  })
})

describe('the docked column keeps no hairline of its own', () => {
  // The kit separates the first docked column from the pane beside it with a
  // `border-left`. Inside the inset card there is no pane beside it, so the
  // hairline lands inside the glass and reads as an extra column.
  const rule = "[data-dsh-float] [data-dsh-details] [data-sidebar-right-panel='push'] [data-dockkit-host='dock'][data-dockkit-column='0'] > section"

  it('drops the border on the first docked column', () => {
    expect(declarationsOf(rule)).toMatch(/border-left:\s*0/)
  })

  it('scopes the rule to the docked panel so a floated pane keeps its chrome', () => {
    expect(aquaCss).toContain("[data-sidebar-right-panel='push'] [data-dockkit-host='dock']")
  })
})

describe('the pane surfaces carry no fill of their own', () => {
  // 0.2.3 emits `iH70Mq_tabHost` where 0.2.2 emitted `_tabHost_…`, so a
  // `[class*='_tabHost_']` selector silently stopped matching and the host's
  // `background: var(--dsw-alias-bg-base)` reappeared as a grey slab inside
  // the glass card. The seam is keyed off the dockkit attributes instead.
  const dockedPane = "[data-dsh-float] [data-dsh-details] [data-dockkit-host='dock'] > section"

  it('clears the docked pane background', () => {
    expect(declarationsOf(dockedPane)).toMatch(/background:\s*transparent/)
  })

  it('clears the empty-column placeholder background', () => {
    const empty = "[data-dsh-float] [data-dsh-details] [data-dockkit-empty]"
    expect(declarationsOf(empty)).toMatch(/background:\s*transparent/)
  })

  it('keys the pane seams off data attributes, not hashed class names', () => {
    // A class-name substring would break again the next time the host renames
    // its CSS modules.
    expect(aquaCss).not.toContain("[class*='_tabHost_']")
  })
})
