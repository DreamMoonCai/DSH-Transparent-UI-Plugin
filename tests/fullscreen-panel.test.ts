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

/** Rules that step the card itself out of the way. */
const CARD = (selector: string) =>
  selector.includes(':has([data-sidebar-right-panel=\'fullscreen\'])') &&
  !selector.includes(':before') &&
  !selector.includes('::before')

/** Rules on the fullscreen panel element. */
const PANEL = (selector: string) =>
  selector.includes("[data-sidebar-right-panel='fullscreen']") &&
  !selector.includes(':has(') &&
  !selector.includes('::before')

describe('the workbench panel in fullscreen', () => {
  it('lets the panel out of the card', () => {
    // The host grows the panel to `calc(100vw + 1px)` and relies on its own
    // `.rightbarCol { overflow: visible }`. This card clips, so the widened
    // panel was cut back to the card and only the strip nearest the right edge
    // stayed on screen — the content had switched, the surface had not.
    const bodies = all.filter(rule => CARD(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/overflow:\s*visible/)
    expect(bodies).toMatch(/margin:\s*0/)
    expect(bodies).toMatch(/border:\s*0/)
    expect(bodies).toMatch(/border-radius:\s*0/)
    expect(bodies).toMatch(/background:\s*(transparent|0 0)/)
  })

  it('drops its stacking context, so the panel can cover the frame', () => {
    // The card's `isolation: isolate` traps the panel's dock layer (40) inside
    // the card instead of letting it cover the frame.
    const bodies = all.filter(rule => CARD(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/isolation:\s*auto/)
  })

  it('hides its own glass while the panel is out', () => {
    const bodies = all
      .filter(rule => rule.selector.includes(":has([data-sidebar-right-panel='fullscreen'])") && rule.selector.includes('::before'))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/display:\s*none/)
  })

  it('sorts above the conversation instead of hiding behind it', () => {
    // The host ranks this presentation with `--dsh-dockkit-dock-layer: 40` on
    // the docked cell inside the panel. `isolation: isolate` on the panel trapped
    // that number inside it and left the panel at z-index auto, under the
    // composer's 8 — the conversation painted straight over the page. The panel
    // takes the rank itself, and must not open a stacking context of its own.
    const bodies = all.filter(rule => PANEL(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/z-index:\s*40/)
    expect(bodies).not.toMatch(/isolation:\s*isolate/)
  })

  it('keeps the glass on the panel rather than an opaque plate', () => {
    // Hiding the overlap with an opaque fill was the wrong layer: with the order
    // right, the conversation sits behind a blur, not legible through it.
    const bodies = all.filter(rule => PANEL(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/var\(--dsh-aqua-glass-card-light\)/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
    expect(bodies).not.toMatch(/background:\s*#[0-9a-f]{6}/i)
  })

  it('does not take over the host’s geometry', () => {
    // The host owns `absolute; top: 0; right: 0; bottom: 0`; a `position` from
    // this sheet would drop the panel into the column's flow.
    const bodies = all.filter(rule => PANEL(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).not.toMatch(/position:\s*(relative|absolute|fixed)/)
  })

  it('cuts the page contents from that ground', () => {
    // Rows and fields inside the page reach for the canvas or a surface layer;
    // left opaque they stack as plates on the page.
    const bodies = all
      .filter(rule =>
        rule.selector.includes("[data-sidebar-right-panel='fullscreen']") &&
        (rule.selector.includes('[data-dockkit-pane-body]') || rule.selector.includes("[data-dockkit-host='dock']")))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/--dsw-alias-bg-base:\s*transparent/)
    expect(bodies).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(/)
  })

  it('leaves the docked panel untouched', () => {
    // Every rule above is guarded by the fullscreen attribute; the pushed-in
    // card is what the theme is for and must keep its inset and its glass.
    for (const rule of all) {
      if (!rule.selector.includes(":has([data-sidebar-right-panel='fullscreen'])")) continue
      expect(rule.selector).toContain('data-sidebar-right-panel')
    }
    const docked = all
      .filter(rule => rule.selector === "[data-dsh-float] [data-dsh-details]")
      .map(rule => rule.body)
      .join(' ')
    expect(docked).toMatch(/margin:\s*12px/)
    expect(docked).toMatch(/overflow:\s*hidden/)
    expect(docked).toMatch(/isolation:\s*isolate/)
  })
})
