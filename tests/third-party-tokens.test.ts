import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A plugin that wants to sit on the page's material writes
 * `background: var(--dsh-surface, #1e1e24)`. DSH's own theme defines neither
 * `--dsh-surface` nor `--dsh-accent` — they are not in `design-platform.css` and
 * not in `dsh-client-ui-theme` — so the plugin fell back to its own dark
 * default and the Cursor pane came up a near-black rectangle in light mode.
 *
 * Answering those two variables is the whole job of a token layer: a pane asking
 * to join the page can, and one that hard-codes a colour still cannot. These
 * assertions pin that split, because "just clear it everywhere" would blank the
 * fills that a plugin legitimately owns.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
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

function bodiesOf(property: string): Rule[] {
  return all.filter(rule => new RegExp(`${property}\\s*:`).test(rule.body))
}

describe('the two variables a third-party pane reaches for', () => {
  it('defines --dsh-surface as the card material', () => {
    const hits = bodiesOf('--dsh-surface')
    expect(hits.length).toBeGreaterThan(0)
    const bodies = hits.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsh-surface:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(bodies).toMatch(/--dsh-surface:\s*var\(--dsh-aqua-glass-card-dark\)/)
  })

  it('defines --dsh-accent from the brand ink', () => {
    const bodies = bodiesOf('--dsh-accent').map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsh-accent:\s*var\(--dsw-alias-brand-primary\)/)
  })

  it('answers them only while the theme is on', () => {
    // Compat mode and the "off" switch must render the stock UI exactly, and the
    // stock UI is what has no value here — so these never reach `:root` alone.
    for (const rule of bodiesOf('--dsh-surface')) {
      expect(rule.selector, rule.selector).toContain('[data-dsh-aqua]')
    }
  })

  it('never forces a third-party pane transparent behind its back', () => {
    // Clearing --dsw-alias-bg-base inside a plugin's own container would blank
    // fills that plugin owns on purpose. The one global answer is the variable
    // above; anything else has to be scoped to a surface this sheet builds.
    const canvasClears = bodiesOf('--dsw-alias-bg-base')
    for (const rule of canvasClears) {
      const scoped =
        rule.selector.includes('[data-dsh-details]') ||
        rule.selector.includes('md-code-block') ||
        rule.selector.includes('dsh-timeline') ||
        /\[data-(diff|read|terminal)\]/.test(rule.selector)
      if (scoped) continue
      expect(rule.body).not.toMatch(/--dsw-alias-bg-base:\s*transparent/)
    }
  })
})
