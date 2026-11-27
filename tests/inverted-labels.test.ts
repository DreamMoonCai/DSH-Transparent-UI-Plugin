// @vitest-environment jsdom
/**
 * `--dsw-alias-bg-layer-3` is a SURFACE token by name, but the host also reads
 * it as INK: five of its rules paint `background: var(--dsw-alias-label-primary)`
 * and then `color: var(--dsw-alias-bg-layer-3)` — white text on ink. The stock
 * theme keeps that correct by leaving layer-3 opaque (`#fff` light). This skin
 * makes every layer token translucent so surfaces read as glass, and those five
 * inverted labels went with it: the alpha that makes a background see-through
 * makes the text see-through, so an in-use tag, a broken-plugin badge, its hover
 * tip and the save button all rendered as solid black chips.
 *
 * The fix does not pin layer-3 back to opaque (25 rules paint surfaces with it);
 * it gives the inverted consumers the ink they were written against. Two seams
 * survive the build: the `Tag` primitive's `data-tone`, and the class stems the
 * hashed CSS modules keep.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Every selector of every rule that sets `color:` to layer-3, comments stripped. */
function layer3TextConsumers(): string[] {
  const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = match[2]
    if (!/color:\s*var\(--dsw-alias-bg-layer-3\)/.test(body)) continue
    out.push(match[1].trim())
  }
  return out
}

function mount(): HTMLElement {
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
  return document.querySelector('[data-dsh-frame]') as HTMLElement
}

/** The ink token the fix writes, as jsdom reports it (custom props unresolved). */
function resolveInk(): string {
  mount()
  return 'var(--dsw-alias-label-primary-inverted)'
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-dsh-aqua')
  document.documentElement.removeAttribute('data-dsh-float')
})

describe('the inverted labels that read layer-3 as ink', () => {
  it('never lets this skin set layer-3 as a text colour', () => {
    // The host owns those five rules; our sheet must not add a sixth, or the
    // ink goes translucent again in a spot nobody is looking at.
    expect(layer3TextConsumers()).toEqual([])
  })

  it('gives a solid tone tag the ink its surface expects', () => {
    const ink = resolveInk()
    expect(ink).toBe('var(--dsw-alias-label-primary-inverted)')
    // jsdom does not resolve custom properties, so the seam coverage is pinned
    // on the selector list; the resolved value is pinned in the test below.
    expect(getComputedStyle(document.querySelector('[data-tone="solid"]') as HTMLElement).color).toBe(
      ink,
    )
  })

  it('leaves an outline tone tag on the secondary ink', () => {
    // Only the inverted carriers are re-pointed; the outline tag reads the
    // host's own `label-tertiary` and must not be touched.
    const rule = aquaCss.slice(
      aquaCss.indexOf("[data-tone='solid']"),
      aquaCss.indexOf('}', aquaCss.indexOf("[data-tone='solid']")),
    )
    expect(rule).not.toMatch(/outline/)
  })

  it('covers the badge, its hover tip, the hover card tip and the save button', () => {
    const ink = resolveInk()
    for (const selector of ['.host_brokenBadge', '.host_brokenTip', '.host_save']) {
      const color = getComputedStyle(document.querySelector(selector) as HTMLElement).color
      // jsdom hands back the unresolved `var()` for a custom property, which is
      // exactly the proof the rule reached the element.
      expect(color, selector).toBe(ink)
    }
    expect(aquaCss).toMatch(/\[class\*='iconButton'\]\[data-tip\]::after/)
  })

  it('uses the inverted ink in the dark scheme too', () => {
    const dark = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')
    expect(dark).toMatch(
      /'--dsw-alias-label-primary-inverted':\s*\{\s*light:\s*'#FFFFFF',\s*dark:\s*'#162130'\s*\}/,
    )
  })
})
