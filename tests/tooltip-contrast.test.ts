// @vitest-environment jsdom
/**
 * A tooltip is a dark chip, not a pane of the glass.
 *
 * The host's tooltip class is `hxWHXa_bubble`, so the chat-bubble rule
 * (`[class*='bubble']`) matched it and handed the tip a 42% white fill. Its label
 * keeps `--dsw-alias-tooltip-label`, which is white in both schemes, so white text
 * landed on a white wash — the tip was unreadable.
 *
 * The bubble recipe now excludes `[role='tooltip']`, and the tooltip keeps its own
 * token surface.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const themeLayer = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
})

function mountTooltip(): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  // The host's real markup: a span whose class ends in `bubble`.
  document.body.innerHTML = '<span class="hxWHXa_bubble" role="tooltip">更多操作</span>'
  return document.querySelector('[role="tooltip"]') as HTMLElement
}

describe('the tooltip keeps its own surface', () => {
  it('is excluded from every float-mode chat-bubble rule', () => {
    // Four bubble rules in float mode: light, dark, and the two video-wallpaper
    // variants. A bare `[class*='bubble']` catches the host's `hxWHXa_bubble`.
    // Compat mode has its own token layer and is out of scope here.
    const heads = [...flat.matchAll(/[^{}]*\[data-dsh-float\][^{}]*\[class\*='bubble'\][^{}]*\{/g)]
      .map(match => match[0])
    expect(heads.length).toBeGreaterThan(0)
    for (const head of heads) {
      expect(head).toContain(":not([role='tooltip'])")
    }
  })

  it('gets no white wash', () => {
    // The 42% white fill was what made white text disappear.
    const track = mountTooltip()
    expect(getComputedStyle(track).background).not.toMatch(/rgba?\(255,\s*255,\s*255/)
  })

  it('carries no border and no blur of ours', () => {
    // Every float-mode tooltip rule, joined: the small-atoms one only sets the
    // radius, the surface one clears the border and the blur.
    const bodies = [...flat.matchAll(/\[data-dsh-float\] \[role='tooltip'\] \{([^}]*)\}/g)]
      .map(match => match[1])
      .join(' ')
    expect(bodies).toMatch(/border:\s*0/)
    expect(bodies).toMatch(/backdrop-filter:\s*none/)
  })

  it('still gets a shadow so it reads above the glass', () => {
    const bodies = [...flat.matchAll(/\[data-dsh-float\] \[role='tooltip'\] \{([^}]*)\}/g)]
      .map(match => match[1])
      .join(' ')
    expect(bodies).toMatch(/box-shadow:/)
  })
})

describe('the tooltip label is white, which is why the fill had to go', () => {
  it('comes from the host token we never override', () => {
    // `--dsw-alias-tooltip-label` resolves to the white anchor in both schemes; the
    // skin overrides only the background, so the ink stays white.
    expect(themeLayer).toContain("'--dsw-alias-tooltip-bg'")
    expect(themeLayer).not.toContain("'--dsw-alias-tooltip-label'")
  })

  it('gives the background a dark value in both schemes', () => {
    const line = themeLayer.split('\n').find(text => text.includes("'--dsw-alias-tooltip-bg'"))!
    expect(line).toBeDefined()
    // `#13243E` light / `#162130` dark, both near-black.
    expect(line).toMatch(/#13243E/i)
    expect(line).toMatch(/#162130/i)
  })
})

describe('the chat bubbles are unaffected', () => {
  it('still takes the frosted fill', () => {
    const body = blockOf("[data-dsh-float] [class*='bubble']:not([role='tooltip'])")
    expect(body).not.toBeNull()
    expect(body).toMatch(/background: color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur/)
  })
})
