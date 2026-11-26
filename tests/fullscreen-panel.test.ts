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
  selector.includes(':has([data-sidebar-right-panel=\'fullscreen\'') &&
  !selector.includes(':before') &&
  !selector.includes('::before')

/** Rules on the fullscreen panel element. */
const PANEL = (selector: string) =>
  selector.includes("[data-sidebar-right-panel='fullscreen']") &&
  !selector.includes(':has(') &&
  !selector.includes('::before')

/** Rules on the fill the fullscreen panel paints behind its content. */
const FILL = (selector: string) =>
  selector.includes("[data-sidebar-right-panel='fullscreen']") &&
  selector.includes('::before') &&
  !selector.includes(':has(')

describe('the workbench panel in fullscreen', () => {
  it('only applies while the panel is actually presented', () => {
    // A fullscreen panel that has been collapsed stays mounted — the host hides
    // its docked cells and slides them out, but the panel box itself remains at
    // `100vw`. So the surface rules must not depend on the panel's mere presence.
    // The one exception is the fill's resting state: `::before` carries its own
    // `opacity: 0` so the fade has somewhere to come from and somewhere to go.
    const touched = all
      .filter(rule => rule.selector.includes("[data-sidebar-right-panel='fullscreen']"))
      .filter(rule => rule.selector.includes('[data-dsh-float]'))
      .filter(rule => !FILL(rule.selector))
      .map(rule => rule.selector)
    expect(touched.length).toBeGreaterThan(0)
    for (const selector of touched) {
      expect(selector, selector).toContain('[data-sidebar-right-open]')
    }
  })

  it('fades the fill on the clock the host slides its content', () => {
    // The host slides the docked cells over `--ds-transition-duration-slow`
    // (0.3s, `--ds-ease-in-out`), but `data-sidebar-right-open` flips in a single
    // frame. A fill keyed straight off that attribute appeared before the content
    // and vanished before it left — the mask and the page ran on different clocks.
    const resting = all.filter(rule => FILL(rule.selector) && !rule.selector.includes('[data-sidebar-right-open]')).map(rule => rule.body).join(' ')
    const shown = all.filter(rule => FILL(rule.selector) && rule.selector.includes('[data-sidebar-right-open]')).map(rule => rule.body).join(' ')
    expect(resting).toMatch(/opacity:\s*0/)
    expect(shown).toMatch(/opacity:\s*1/)
    expect(resting).toMatch(/transition:[\s\S]*opacity[\s\S]*var\(--ds-transition-duration-slow/)
    expect(resting).toMatch(/var\(--ds-ease-in-out/)
    // `display` cannot be interpolated; the fill has to stay in the paint.
    expect(resting).not.toMatch(/display:\s*none/)
  })
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

  it('ranks itself above the conversation, since the panel cannot', () => {
    // The card keeps `isolation: isolate` (its glow is a z-index -1 child), so
    // the panel's dock rank of 40 never reaches the frame. The card is what has
    // to outrank the header and composer cards, which sit at 8.
    const bodies = all.filter(rule => CARD(rule.selector)).map(rule => rule.body).join(' ')
    const rank = /z-index:\s*(\d+)/.exec(bodies)
    expect(rank).not.toBeNull()
    expect(Number(rank![1])).toBeGreaterThan(40)
    expect(bodies).toMatch(/isolation:\s*isolate/)
  })

  it('follows the corner the host rounds on Windows', () => {
    // On Windows the host keeps the page clear of the caption controls with
    // `max-width: calc(100vw - var(--dsh-windows-sidebar-width))` and rounds
    // only the first docked PANE inside the panel. The panel itself is a plain
    // rectangle, so the glass painted on it squared that corner off and left a
    // wedge outside the pane's curve — the notch in the screenshots. The panel
    // takes the same corner, from the host's own token.
    const bodies = all
      .filter(rule => rule.selector.includes("[data-sidebar-right-panel='fullscreen']"))
      .filter(rule => rule.selector.includes('[data-windows-titlebar]'))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/border-top-left-radius:\s*var\(--dsh-windows-content-radius/)
    expect(bodies).toMatch(/corner-shape:\s*round/)
  })

  it('takes the card glass away on the same clock', () => {
    // The card's own pane used to go away with `display: none`, which blinked it
    // out a frame after the attribute flipped while the panel was still sliding.
    // It fades instead, on the host's clock.
    const bodies = all
      .filter(rule => rule.selector.includes(':has([data-sidebar-right-panel=\'fullscreen\'') && rule.selector.includes('::before'))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/opacity:\s*0/)
    expect(bodies).toMatch(/transition:[\s\S]*opacity/)
    expect(bodies).not.toMatch(/display:\s*none/)
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
    // right, the conversation sits behind a blur, not legible through it. The
    // fill lives on `::before` so it can fade, but it is still the panel's glass.
    const bodies = all.filter(rule => FILL(rule.selector)).map(rule => rule.body).join(' ')
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
