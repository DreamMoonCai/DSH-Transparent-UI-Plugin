// @vitest-environment jsdom
/**
 * DSH 0.2.3 moved the environment card out of the right column into its own
 * absolutely positioned `aside[data-session-panel]` floating over the
 * transcript. The host paints it with `background: var(--dsw-alias-bg-layer-1)`
 * plus `box-shadow: var(--dsw-elevation-panel)` — an opaque slab — so it stayed
 * the one panel that never turned to glass while the sidebar, the header, the
 * composer and the workbench card all did.
 *
 * These assertions pin the card recipe and the two scheme variants, and guard
 * the host's own geometry: the aside is positioned and sized by the host from
 * the chat gutter, so anything that changes `top`, `right`, `width` or
 * `max-height` would break that layout.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Declarations of the first rule whose selector text equals `selector`. */
function declarationsOf(selector: string): string {
  const start = aquaCss.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`missing rule: ${selector}`)
  const open = aquaCss.indexOf('{', start)
  const close = aquaCss.indexOf('}', open)
  return aquaCss.slice(open + 1, close)
}

function mountPanel(attributes: { dark?: boolean, overlay?: boolean } = {}): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  if (attributes.dark === true) document.body.setAttribute('data-ds-dark-theme', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  const presentation = attributes.overlay === true ? 'overlay' : 'docked'
  document.body.innerHTML = `<main><aside data-session-panel="${presentation}"><section></section></aside></main>`
  return document.querySelector('[data-session-panel]') as HTMLElement
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('the environment card turns to glass', () => {
  it('paints the shared card fill, not the host slab', () => {
    // jsdom cannot evaluate `color-mix`, so the declarations are asserted
    // against the source rule and the live computed box separately.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(card).toMatch(/border-radius:\s*20px/)
    expect(card).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/)
    // The host slab and its elevation are replaced, not layered on.
    expect(card).not.toContain('--dsw-alias-bg-layer-1')
    expect(card).not.toContain('--dsw-elevation-panel')
    const style = getComputedStyle(mountPanel())
    expect(style.borderRadius).toBe('20px')
  })

  it('takes the dark scheme variant', () => {
    const card = declarationsOf('[data-dsh-float] body[data-ds-dark-theme] aside[data-session-panel]')
    expect(card).toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\)/)
    expect(card).toMatch(/border-color:\s*rgba\(148, 180, 220, 0\.32\)/)
  })

  it('keeps the overlay presentation denser than the docked one', () => {
    // The overlay sits over live text rather than beside it, so it uses the
    // sticky recipe: the same glass, at a higher alpha, so rows do not read
    // through it.
    const overlay = declarationsOf("[data-dsh-float] aside[data-session-panel='overlay']")
    expect(overlay).toMatch(/background:\s*var\(--dsh-aqua-glass-sticky-light\)/)
  })

  it('leaves the host geometry alone', () => {
    // The host positions the aside from the chat gutter and caps its height
    // against the composer; overriding any of those would detach it.
    const card = declarationsOf('[data-dsh-float] aside[data-session-panel]')
    expect(card).not.toMatch(/\btop:/)
    expect(card).not.toMatch(/\bright:/)
    expect(card).not.toMatch(/\bwidth:/)
    expect(card).not.toMatch(/max-height:/)
    expect(card).not.toMatch(/position:/)
  })

  it('matches the real host hook, not a hashed class name', () => {
    // The module class is build-hashed (`_2ImnHa_panel` today); the data
    // attribute is part of the panel's public surface.
    expect(aquaCss).toContain('aside[data-session-panel]')
  })
})

describe('the panel presses without joining the spotlight panes', () => {
  const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')

  it('presses by shadow on hover', () => {
    const press = declarationsOf("[data-dsh-float] aside[data-session-panel]:hover")
    expect(press).toMatch(/box-shadow:/)
    // The outer spread shrinks so the card reads as closer to the page.
    expect(press).toMatch(/0 3px 10px/)
    // An inner ring carries the "pushed in" cue without moving anything.
    expect(press).toMatch(/inset 0 0 0 1px/)
  })

  it('animates the shadow on the shared press clock', () => {
    // The transition sits in its own rule (the fill rule comes first), so the
    // declaration is asserted against the sheet rather than one block.
    expect(aquaCss).toContain('transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);')
  })

  it('stays out of the spotlight pane list', () => {
    // The controller's generic pane rule sets `position: relative` to host the
    // glow layer, which overrode the host's `position: absolute` and dropped
    // the card into the transcript flow on the far left. The glow layer is
    // also sized from `offsetWidth`, and inside a card that owns
    // `overflow-y: auto` it met the padding edge and grew a horizontal
    // scrollbar. So the panel presses by shadow and takes neither.
    expect(stamper).not.toContain("selector: 'aside[data-session-panel]'")
    expect(aquaCss).not.toContain('aside[data-session-panel][data-spot-on]')
  })

  it('never sets position on the card', () => {
    // Any `position` here would replace the host's `absolute` and detach it.
    expect(aquaCss).not.toMatch(/aside\[data-session-panel\][^{]*\{[^}]*position:/)
  })
})
