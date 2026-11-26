// @vitest-environment jsdom
/**
 * An expanded "think" row paints a solid white bar across the flow.
 *
 * While the reasoning body scrolls, the host pins the disclosure header so its
 * collapse toggle stays reachable, and paints that pinned header with
 * `background: var(--dsw-alias-bg-base)` — the canvas colour, which this skin
 * resolves to an opaque `#F4F8FD`. Over a pane it reads as a paper strip with
 * the card's rounded edge cut across it.
 *
 * The host keeps the header sticky, so the fix is the sticky recipe the plugin
 * page's title band already uses: the card's own material at the sticky density
 * plus a doubled blur, so text sliding underneath stops being legible instead of
 * showing through a half-frosted band.
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

const header = "[data-dsh-float] [data-variant='think'][data-expanded] [data-open] [data-disclosure-header]"
const darkHeader = `[data-dsh-float] body[data-ds-dark-theme] ${header.slice('[data-dsh-float] '.length)}`

function mount(expanded: boolean, dark = false): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  if (dark) document.body.setAttribute('data-ds-dark-theme', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  document.body.innerHTML = `
    <div data-variant="think"${expanded ? ' data-expanded=""' : ''}>
      <div data-open="">
        <div data-disclosure-header="">思考</div>
        <div>reasoning body</div>
      </div>
    </div>`
  return document.querySelector('[data-disclosure-header]') as HTMLElement
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('the pinned reasoning header is a pane of the glass', () => {
  it('does not paint the canvas colour', () => {
    // `--dsw-alias-bg-base` is the opaque canvas fill the host reaches for.
    const body = declarationsOf(header)
    expect(body).not.toMatch(/background:\s*var\(--dsw-alias-bg-base\)/)
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
  })

  it('frosts hard enough that sliding text stops reading through it', () => {
    // The card's own 14px lets the body's glyphs ghost through a pinned band,
    // which reads as broken translucency rather than glass.
    expect(declarationsOf(header)).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 2\)\)/)
  })

  it('takes the dark scheme variant', () => {
    expect(declarationsOf(darkHeader)).toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\)/)
  })

  it('is keyed off the host state attributes, not a hashed class', () => {
    // The module class is build-hashed; `data-variant`/`data-expanded`/
    // `data-open`/`data-disclosure-header` are the host's own hooks.
    expect(aquaCss).toContain("[data-variant='think'][data-expanded] [data-open] [data-disclosure-header]")
  })

  it('claims the surface only while the row is expanded', () => {
    // A collapsed row renders no header of its own, so the rule carries the
    // expanded guard rather than styling every disclosure in the app.
    const collapsed = mount(false)
    expect(getComputedStyle(collapsed).background).not.toContain('--dsh-aqua-glass-card')
  })

  it('paints the glass on an expanded row', () => {
    // jsdom does not resolve `color-mix`, so assert the token the rule points at.
    const expandedRow = mount(true)
    expect(getComputedStyle(expandedRow).background).toContain('--dsh-aqua-glass-card-light')
  })
})
