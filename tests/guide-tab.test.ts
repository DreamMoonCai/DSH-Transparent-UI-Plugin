// @vitest-environment jsdom
/**
 * The guide tab is the "start page" of the right column: a muted compass over a
 * column of capsule buttons, each one a door into a pane type.
 *
 * Two defects, both from the stock sheet's assumptions:
 *
 * - the capsules are painted `background: var(--dsw-alias-bg-layer-1)`, which in
 *   float mode resolves to an opaque `#FFFFFF` — six white cards stacked on a
 *   glass pane;
 * - the compass reads `--dsw-specific-guide-hero`, which the host points at
 *   `--dsw-static-neutral-200` (`rgb(229, 229, 229)`): a watermark tuned for a
 *   solid sheet, which on a pale glass pane is invisible.
 *
 * The capsules are the second level under the pane, so they take the
 * secondary-glass recipe the forge rows already use. The compass takes the
 * pane's own ink at a watermark alpha, so it stays a mark rather than a control.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Declarations of the first rule whose selector list contains `selector`. */
function declarationsOf(selector: string): string {
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

const entry = '[data-dsh-float] [data-sidebar-right-guide] :is(button, [data-sidebar-right-guide-entry])'
const entryHover = `${entry}:hover`
const darkEntry = `[data-dsh-float] body[data-ds-dark-theme] [data-sidebar-right-guide] :is(button, [data-sidebar-right-guide-entry])`
const darkHover = `${darkEntry}:hover`
const ghost = '[data-dsh-float] [data-sidebar-right-guide] [data-sidebar-right-guide-entry] button'
const compass = "[data-dsh-float] [data-sidebar-right-guide] > span[aria-hidden='true']"
const darkCompass = "[data-dsh-float] body[data-ds-dark-theme] [data-sidebar-right-guide] > span[aria-hidden='true']"

function mount(): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  // All three capsule shapes the column actually renders. Every capsule sits
  // inside its own `entryCell` wrapper, so the capsule is a child of a child of
  // the column: the shipped guide's entry IS the button, the terminal's is a
  // `div` wrapping an absolutely positioned ghost button, and the "more tools"
  // one is a bare button inside the menu wrapper.
  document.body.innerHTML = `
    <aside data-sidebar-right-panel="push">
      <div data-sidebar-right-guide>
        <span aria-hidden="true"><svg width="56" height="56"></svg></span>
        <div><button type="button" data-sidebar-right-guide-entry="files">工作区文件</button></div>
        <div>
          <div data-sidebar-right-guide-entry="terminal">
            <button type="button">新建终端</button>
          </div>
        </div>
        <div><button type="button" aria-haspopup="menu">更多工具</button></div>
      </div>
    </aside>`
  return document.querySelector('[data-sidebar-right-guide]') as HTMLElement
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('the guide capsules are glass on glass', () => {
  it('replaces the opaque layer fill with a translucent one', () => {
    const body = declarationsOf(entry)
    expect(body).not.toMatch(/background:\s*var\(--dsw-alias-bg-layer-1\)/)
    expect(body).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
  })

  it('scales the fill by the frost knob', () => {
    expect(declarationsOf(entry)).toMatch(/var\(--dsh-aqua-frost, 1\)/)
  })

  it('carries the top highline and hairline the nested rows use', () => {
    const body = declarationsOf(entry)
    expect(body).toMatch(/inset 0 1px 0 rgba\(255, 255, 255/)
    expect(body).toMatch(/inset 0 0 0 1px rgba\(255, 255, 255/)
  })

  it('frosts what is behind it', () => {
    expect(declarationsOf(entry)).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 0\.6\)\)/)
  })

  it('lifts under the pointer on the shared clock', () => {
    const hover = declarationsOf(entryHover)
    expect(hover).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\) calc\(52%/)
    expect(hover).toMatch(/0 2px 10px rgba\(19, 45, 83, 0\.1\)/)
    expect(hover).toMatch(/scale:\s*1\.005/)
  })

  it('animates the lift rather than snapping it', () => {
    expect(declarationsOf(entry)).toMatch(/transition:[\s\S]*scale 0\.2s cubic-bezier\(0\.4, 0, 0\.2, 1\)/)
  })

  it('takes the dark scheme on the fill, the border and the lift', () => {
    expect(declarationsOf(darkEntry)).toMatch(/background:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
    expect(declarationsOf(darkEntry)).toMatch(/border-color:\s*rgba\(148, 180, 220, 0\.18\)/)
    expect(declarationsOf(darkHover)).toMatch(/0 2px 10px rgba\(2, 6, 14, 0\.36\)/)
  })
})

describe('the guide compass is visible again', () => {
  it('drops the watermark grey the host points at', () => {
    // `--dsw-specific-guide-hero` resolves to `rgb(229, 229, 229)`.
    expect(declarationsOf(compass)).not.toMatch(/--dsw-specific-guide-hero/)
  })

  it('draws on the pane ink at a watermark alpha', () => {
    expect(declarationsOf(compass)).toMatch(/color:\s*color-mix\(in srgb, var\(--dsw-alias-label-primary\) 16%, transparent\)/)
  })

  it('thickens a little in the dark scheme, where the ink inverts', () => {
    expect(declarationsOf(darkCompass)).toMatch(/var\(--dsw-alias-label-primary\) 22%/)
  })
})

describe('both seams are the host attributes', () => {
  it('keys off data-sidebar-right-guide, not a hashed module class', () => {
    // The module class is build-hashed (`p2k40q_guide` today).
    expect(aquaCss).toContain('[data-sidebar-right-guide]')
    expect(aquaCss).not.toContain('p2k40q_')
  })

  it('leaves the stock sheet alone outside float mode', () => {
    // Every rule is gated, so the stock opaque capsule survives in compat mode.
    expect(declarationsOf(entry).length).toBeGreaterThan(0)
    expect(/^\[data-sidebar-right-guide\]/m.test(aquaCss)).toBe(false)
  })

  it('styles the real capsule in the DOM', () => {
    const guide = mount()
    const capsule = guide.querySelector('button') as HTMLElement
    expect(getComputedStyle(capsule).background).toContain('color-mix')
  })

  it('covers every capsule shape, not just the ones that are a bare button', () => {
    // The terminal capsule is a `div` with an absolutely positioned ghost button
    // inside it; keying the rule off `button` alone matched the ghost and left
    // the real capsule white — the one white card in the column.
    const guide = mount()
    const terminal = guide.querySelector("[data-sidebar-right-guide-entry='terminal']") as HTMLElement
    expect(getComputedStyle(terminal).background).toContain('color-mix')
  })

  it('clears the ghost button so the capsule has one fill, not two', () => {
    const body = declarationsOf(ghost)
    expect(body).toMatch(/background:\s*transparent/)
    expect(body).toMatch(/backdrop-filter:\s*none/)
    expect(body).toMatch(/box-shadow:\s*none/)
  })

  it('paints the three shapes identically', () => {
    // Two capsules with different markup must not read as different materials.
    const guide = mount()
    const capsules = [...guide.querySelectorAll('[data-sidebar-right-guide-entry], button')]
      .filter(node => node.closest('[data-sidebar-right-guide]') === guide)
    expect(capsules.length).toBeGreaterThan(1)
  })
})
