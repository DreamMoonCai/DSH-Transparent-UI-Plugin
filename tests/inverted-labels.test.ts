// @vitest-environment jsdom
/**
 * `--dsw-alias-bg-layer-3` is a surface token by name, but the host also reads
 * it as INK: five of its rules paint `background: var(--dsw-alias-label-primary)`
 * and then `color: var(--dsw-alias-bg-layer-3)` — white text on ink. The stock
 * theme keeps that correct by leaving layer-3 opaque (`#fff` light). This skin
 * makes every layer token translucent so surfaces read as glass, and those five
 * inverted labels went with it: the alpha that makes a background see-through
 * makes the text see-through too, so an in-use tag, a broken-plugin badge, its
 * hover tip and the save button all rendered as near-black chips.
 *
 * The first attempt at this fix used `[data-dsh-float] [data-tone='solid']`,
 * which is (0,2,0) — exactly the weight of the host's own
 * `.URJjCq_tag[data-tone=solid]`. A tie is broken by injection order and the
 * host's sheet comes second, so the rule lost and the chip stayed dark. These
 * assertions pin the weight as well as the value.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Declarations of the rule whose selector list contains `needle`. */
function blockOf(needle: string): string | null {
  const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].includes(needle)) return match[2]
  }
  return null
}

function mount(): void {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  document.body.innerHTML = `
    <div data-dsh-frame>
      <span class="host_tag" data-tone="solid">in use</span>
      <span class="host_tag" data-tone="outline">built in</span>
      <span class="host_brokenBadge">broken</span>
      <span class="host_brokenTip">tip</span>
      <button class="host_iconButton" data-tip="retry">x</button>
      <button class="host_save">Save</button>
    </div>`
}

/** Weight of the selector carrying `needle`: attributes + classes, then elements. */
function weightOf(needle: string): [number, number] {
  const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const start = bare.indexOf(needle)
  expect(start, `selector not found: ${needle}`).toBeGreaterThanOrEqual(0)
  const listStart = bare.lastIndexOf('}', start) + 1
  const list = bare.slice(listStart, bare.indexOf('{', start))
  const rule = list
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.includes(needle)) as string
  const pairs = rule.match(/\[[^\]]*\]|\.[A-Za-z_-][\w-]*|::?[a-z-]+/g) ?? []
  const classes = pairs.filter((p) => !p.startsWith(':')).length
  const stripped = rule.replace(/\[[^\]]*\]|\.[A-Za-z_-][\w-]*|::?[a-z-]+/g, ' ')
  // Element names survive the strip, one per whitespace-separated token.
  const elements = stripped.split(/\s+/).filter((w) => /^[a-z][\w-]*$/.test(w)).length
  return [classes, elements]
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-dsh-aqua')
  document.documentElement.removeAttribute('data-dsh-float')
})

describe('the inverted labels that read layer-3 as ink', () => {
  it('never lets this skin set layer-3 as a text colour', () => {
    // The host owns those five rules; our sheet must not add a sixth, or the ink
    // goes translucent again in a spot nobody is looking at.
    const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      expect(match[2], match[1].trim()).not.toMatch(/color:\s*var\(--dsw-alias-bg-layer-3\)/)
    }
  })

  it('outweighs the host rule it has to beat', () => {
    // The host's own rule is `.URJjCq_tag[data-tone=solid]` = (0,2,0). Anything
    // at or below that loses the injection-order tie, which is exactly how the
    // first attempt failed.
    const [classes, elements] = weightOf("[data-tone='solid']")
    expect(classes).toBe(2)
    expect(elements).toBeGreaterThanOrEqual(1)
  })

  it('gives a solid tone tag the inverted ink', () => {
    mount()
    const color = getComputedStyle(document.querySelector('[data-tone="solid"]') as HTMLElement)
      .color
    // jsdom reports the unresolved custom property, which is the proof the rule
    // reached the element.
    expect(color).toBe('var(--dsw-alias-label-primary-inverted)')
  })

  it('covers the badge, its tip, the hover-card tip and the save button', () => {
    mount()
    for (const selector of ['.host_brokenBadge', '.host_brokenTip', '.host_save']) {
      const color = getComputedStyle(document.querySelector(selector) as HTMLElement).color
      expect(color, selector).toBe('var(--dsw-alias-label-primary-inverted)')
    }
    // The preset card's hover tip is a `::after` on a button, so it cannot be
    // read through getComputedStyle on an element — pin the seam instead.
    const tip = blockOf("[class*='iconButton'][data-tip]")
    expect(tip).toMatch(/var\(--dsw-alias-label-primary-inverted\)/)
  })

  it('leaves an outline tone tag on the secondary ink', () => {
    // Only the inverted carriers are re-pointed; the outline tag reads the
    // host's own `label-tertiary` and must not be touched.
    const rule = blockOf("[data-tone='solid']")
    expect(rule).not.toBeNull()
    expect(aquaCss).not.toMatch(/body \[data-tone='outline'\]/)
  })

  it('uses the inverted ink in the dark scheme too', () => {
    const palette = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')
    expect(palette).toMatch(
      /'--dsw-alias-label-primary-inverted':\s*\{\s*light:\s*'#FFFFFF',\s*dark:\s*'#162130'\s*\}/,
    )
  })
})
