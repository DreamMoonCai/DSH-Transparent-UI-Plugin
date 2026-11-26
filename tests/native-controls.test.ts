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

function bodiesFor(predicate: (selector: string) => boolean): string[] {
  return all.filter(rule => predicate(rule.selector)).map(rule => rule.body)
}

const CONTROL = (selector: string) =>
  selector.includes("input[type='checkbox']") &&
  selector.includes("input[type='radio']") &&
  !selector.includes('[data-ds-dark-theme]') &&
  !selector.includes(':checked')

const CHECKED = (selector: string) =>
  selector.includes("input[type='checkbox']") &&
  selector.includes(':checked') &&
  !selector.includes('[data-ds-dark-theme]')

const CONTROL_DARK = (selector: string) =>
  selector.includes("input[type='checkbox']") &&
  selector.includes('[data-ds-dark-theme]') &&
  !selector.includes(':checked')

describe('native checkboxes and radios', () => {
  it('takes the box away from the platform', () => {
    // A checked box is a solid #0078D4 square drawn by the browser; without
    // `appearance: none` no other declaration has any effect.
    const bodies = bodiesFor(CONTROL).join(' ')
    expect(bodies).toMatch(/appearance:\s*none/)
    expect(bodies).toMatch(/-webkit-appearance:\s*none/)
  })

  it('gives it the skin’s own surface', () => {
    const bodies = bodiesFor(CONTROL).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
    expect(bodies).toMatch(/border-radius:\s*4px/)
  })

  it('outranks the inline metrics several plugins set', () => {
    // dsh-unlag ships `style={{ margin: 0 }}` on its inputs and others set
    // width/height inline; only `!important` keeps the box on the skin.
    const bodies = bodiesFor(CONTROL).join(' ')
    expect(bodies).toMatch(/width:\s*15px\s*!important/)
    expect(bodies).toMatch(/height:\s*15px\s*!important/)
    expect(bodies).toMatch(/margin:\s*0\s*!important/)
  })

  it('paints the checked state with the action fill', () => {
    const bodies = bodiesFor(CHECKED).join(' ')
    expect(bodies).toMatch(/background:\s*var\(--dsw-alias-button-primary-fill\)/)
  })

  it('draws the tick in the inverted ink, not a hard-coded white', () => {
    const bodies = all
      .filter(rule => rule.selector.includes("input[type='checkbox']:checked::after"))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/var\(--dsw-alias-label-primary-inverted\)/)
  })

  it('draws the radio as a circle with a dot', () => {
    const radioBodies = all
      .filter(rule => rule.selector.endsWith("input[type='radio']"))
      .map(rule => rule.body)
      .join(' ')
    expect(radioBodies).toMatch(/border-radius:\s*50%/)
    const radioSelectors = all.map(rule => rule.selector).join(' ')
    expect(radioSelectors).toContain("input[type='radio']:checked::after")
  })

  it('has a dark scheme on the same shape', () => {
    const bodies = bodiesFor(CONTROL_DARK).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
  })

  it('keeps a visible focus ring', () => {
    const bodies = all
      .filter(rule => rule.selector.includes(':focus-visible'))
      .filter(rule => rule.selector.includes("input[type='checkbox']"))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/outline:/)
  })

  it('only touches float mode', () => {
    const selectors = all
      .filter(rule => rule.selector.includes("input[type='checkbox']"))
      .map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('[data-dsh-float]')
      expect(selector).not.toContain('[data-dsh-compat]')
    }
  })
})
