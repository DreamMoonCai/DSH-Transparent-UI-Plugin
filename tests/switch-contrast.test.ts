// @vitest-environment jsdom
/**
 * A checked switch must not paint its track the same colour as its thumb.
 *
 * The host renders `button[role='switch']` and paints the checked track with
 * `--dsw-alias-brand-primary`; plugins may render their own — the ticket assistant
 * uses a `div[role='switch']` with a hard-coded `#fff` thumb — but they read the same
 * token.
 *
 * This skin sets that token to the brand ink, which is near-white in dark mode
 * (`#EAF2FC`). A white thumb on a near-white track is the state, gone. Only a checked
 * switch is re-pointed, and only to the blue action fill, so branding elsewhere is
 * untouched.
 *
 * The selector carries no element name on purpose: the previous `button[role='switch']`
 * silently skipped every plugin that renders a `div`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const themeLayer = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-dsh-aqua')
})

function mountSwitch(tag: 'button' | 'div', checked: boolean): HTMLElement {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  document.body.innerHTML = `<${tag} role="switch" aria-checked="${checked}"><span></span></${tag}>`
  return document.querySelector('[role="switch"]') as HTMLElement
}

/** The selector text of the rule whose head starts with `needle`. */
function ruleSelector(needle: string): string | null {
  const at = aquaCss.indexOf(`${needle} {`)
  if (at < 0) return null
  return aquaCss.slice(at, at + needle.length)
}

describe('a checked switch takes the action blue', () => {
  it('re-points the token on any element carrying the role', () => {
    // No `button` in the selector: a plugin's `div[role='switch']` reads the same
    // custom property and must be covered.
    const selector = ruleSelector("[data-dsh-aqua] [role='switch'][aria-checked='true']")!
    expect(selector).toContain('[role=\'switch\']')
    expect(selector).not.toContain('button')
  })

  it('names no element-qualified switch rule', () => {
    // Comments are stripped first: the explanatory block above quotes the old
    // selector, and a plain scan would trip on its prose.
    const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of bare.matchAll(/[^{}\n][^{}]*\[role='switch'\][^{}]*\{/g)) {
      const head = match[0].slice(0, match[0].indexOf('{'))
      expect(head).not.toMatch(/button\s*\[role='switch'\]/)
    }
  })

  it('uses the action fill, not the brand ink', () => {
    const body = /\[data-dsh-aqua\] \[role='switch'\]\[aria-checked='true'\] \{([^}]*)\}/.exec(aquaCss)
    expect(body).not.toBeNull()
    expect(body![1]).toMatch(/--dsw-alias-brand-primary:\s*var\(--dsw-alias-button-primary-fill\)/)
  })

  it('resolves for a host button', () => {
    const track = mountSwitch('button', true)
    expect(getComputedStyle(track).getPropertyValue('--dsw-alias-brand-primary').trim())
      .toBe('var(--dsw-alias-button-primary-fill)')
  })

  it('resolves for a plugin div too', () => {
    // The ticket assistant's switch is a div; the old selector never reached it.
    const track = mountSwitch('div', true)
    expect(getComputedStyle(track).getPropertyValue('--dsw-alias-brand-primary').trim())
      .toBe('var(--dsw-alias-button-primary-fill)')
  })

  it('leaves an unchecked switch alone', () => {
    // Off has its own neutral track; re-pointing the token there would tint it.
    const track = mountSwitch('button', false)
    expect(getComputedStyle(track).getPropertyValue('--dsw-alias-brand-primary').trim()).toBe('')
  })
})

describe('the dark brand ink is the reason', () => {
  it('is near-white, so it cannot also be a track', () => {
    const line = themeLayer.split('\n').find(text => text.includes("'--dsw-alias-brand-primary':"))!
    expect(line).toBeDefined()
    // The dark half of the pair is what made a white thumb vanish.
    expect(line).toMatch(/dark:\s*'#EAF2FC'/)
  })

  it('gives the action fill a mid blue in both schemes', () => {
    const line = themeLayer.split('\n').find(text => text.includes("'--dsw-alias-button-primary-fill':"))!
    expect(line).toBeDefined()
    expect(line).toMatch(/light:\s*'#3F76D8'/)
    expect(line).toMatch(/dark:\s*'#4A7FD9'/)
  })
})
