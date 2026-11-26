// @vitest-environment jsdom
/**
 * The glow overlay's box has two possible owners.
 *
 * A pane whose glass is NOT its own box — the fused composer+stats wrapper, a
 * workbench card hosting a fullscreen panel — still needs the numbers: the glass
 * is a union or a child, so `inset: 0` on the overlay would cover the wrong area.
 * Those panes get an inline box from `glassLocalRect`.
 *
 * Every other pane IS its own glass, and for those the inline box was a second,
 * independent copy of a measurement the browser already holds. Written once at
 * hover-session start, it can go stale — and a stale box leaves the overlay too
 * small, so the radial fill ends on a straight edge partway across the pane. The
 * stylesheet's `inset: 0` follows every reflow for free, so those panes let it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { ensureGlow, glassIsOwnBox, GLOW_ATTR } from '../src/client/spot-core'

afterEach(() => {
  document.body.innerHTML = ''
})

function pane(markup = ''): HTMLElement {
  const element = document.createElement('section')
  element.innerHTML = markup
  document.body.append(element)
  return element
}

describe('which panes own their glow box', () => {
  it('a plain pane is its own glass', () => {
    expect(glassIsOwnBox(pane('<div class="content"></div>'))).toBe(true)
  })

  it('the fused composer spot is not', () => {
    // Its glass is the union of the composer card and the docked stats band; the
    // wrapper's own box includes side gutters that must stay unlit.
    expect(glassIsOwnBox(pane('<div data-composer-card></div>'))).toBe(false)
  })

  it('a fullscreen workbench card is not', () => {
    // The panel hangs leftward out of the card, so the glass is the panel.
    const card = pane('<div data-sidebar-right-panel="fullscreen"></div>')
    expect(glassIsOwnBox(card)).toBe(false)
  })

  it('the same card without a fullscreen panel is', () => {
    const card = pane('<div data-sidebar-right-panel="push"></div>')
    expect(glassIsOwnBox(card)).toBe(true)
  })
})

describe('the overlay box a plain pane receives', () => {
  it('drops any inline box so `inset: 0` owns it', () => {
    const spot = pane('<div class="content"></div>')
    const glow = ensureGlow(spot)
    expect(glow.getAttribute(GLOW_ATTR)).toBe('')
    expect(glow.style.left).toBe('')
    expect(glow.style.width).toBe('')
  })

  it('clears a box left behind by an earlier measurement', () => {
    const spot = pane('<div class="content"></div>')
    const glow = ensureGlow(spot)
    glow.style.left = '12px'
    glow.style.top = '10px'
    glow.style.width = '800px'
    glow.style.height = '40px'
    ensureGlow(spot)
    expect(glow.style.left).toBe('')
    expect(glow.style.top).toBe('')
    expect(glow.style.width).toBe('')
    expect(glow.style.height).toBe('')
  })

  it('never writes an inline box on the pane it is told to keep', () => {
    // The opposite case: a pane whose glass sits inside its own box keeps
    // whatever the controller measured, so the caller's values survive.
    const spot = pane('<div data-composer-card></div>')
    const glow = ensureGlow(spot)
    expect(glassIsOwnBox(spot)).toBe(false)
    expect(glow.style.width).toBe('')
  })
})
