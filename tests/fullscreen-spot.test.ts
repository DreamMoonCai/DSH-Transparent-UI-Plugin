import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../src/client/spot-core.ts'), 'utf8')

describe('the spotlight geometry for a fullscreen workbench panel', () => {
  it('measures the panel, not the card', () => {
    // The host widens the panel to `calc(100vw + 1px)` and lets it hang leftward
    // out of the column track; the card keeps the track's width. Measuring the
    // card bounded the glow and the press to the right-hand strip.
    expect(source).toContain('[data-sidebar-right-panel="fullscreen"]')
    expect(source).toMatch(/const panel = spot\.querySelector<HTMLElement>\(FULLSCREEN_PANEL\)/)
    expect(source).toContain('return panel.getBoundingClientRect()')
  })

  it('does the same for the local box the glow is painted into', () => {
    // The overlay is `position: absolute; inset: 0` inside the pane, so its box
    // is the pane's padding box — which is the track, not the page.
    const glass = source.slice(source.indexOf('export function glassLocalRect'))
    expect(glass).toContain('FULLSCREEN_PANEL')
    expect(glass).toContain('box.left - own.left')
  })

  it('keeps the composer union first, so the fused slab is unaffected', () => {
    // A composer spot never hosts a fullscreen panel; the branch order keeps its
    // union of card + stats band intact.
    const visual = source.slice(source.indexOf('export function visualRect'), source.indexOf('export function glassLocalRect'))
    expect(visual.indexOf("spot.querySelector('[data-composer-card]')"))
      .toBeLessThan(visual.indexOf('FULLSCREEN_PANEL'))
  })
})
