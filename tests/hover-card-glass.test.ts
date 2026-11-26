import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')

/** Strip comments so quoted selectors inside prose never reach an assertion. */
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

interface Rule {
  selector: string
  body: string
  at: number
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
          at: start,
        })
        start = -1
      }
    }
  }
  return found
}

const all = rules()

const PREVIEW = (selector: string) =>
  selector.includes('[data-changes-hover-preview]') && !selector.includes('[data-ds-dark-theme]')

const PREVIEW_DARK = (selector: string) =>
  selector.includes('[data-changes-hover-preview]') && selector.includes('[data-ds-dark-theme]')

const GENERIC = (selector: string) =>
  selector.includes('--dsh-hover-preview-fade') && !selector.includes('[data-ds-dark-theme]')

const GENERIC_DARK = (selector: string) =>
  selector.includes('--dsh-hover-preview-fade') && selector.includes('[data-ds-dark-theme]')

describe('the diff preview that opens over the transcript', () => {
  it('takes the fill off the plate', () => {
    // The preview paints `--dsw-alias-bg-layer-1`, a flat #FFFFFF in float mode.
    const bodies = all.filter(rule => PREVIEW(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsw-alias-bg-layer-1:\s*transparent/)
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('keeps the two sides of a comparison distinguishable', () => {
    // A diff without a green/red pair is not a diff. The tints stay, at a
    // quarter of their density.
    const bodies = all.filter(rule => PREVIEW(rule.selector)).map(rule => rule.body).join(' ')
    for (const token of ['file-diff-added-bg', 'file-diff-added-gutter', 'file-diff-deleted-bg', 'file-diff-deleted-gutter']) {
      const at = bodies.indexOf(`--dsw-alias-${token}:`)
      expect(at, token).toBeGreaterThan(-1)
      const decl = bodies.slice(at, bodies.indexOf(';', at))
      expect(decl, token).toMatch(/color-mix\(/)
      expect(decl, token).toMatch(/calc\(\d+%/)
    }
  })

  it('re-densifies the tints for dark mode', () => {
    // The host's dark tints are 16% of a bright green over near-black; keeping
    // the light percentages there would make the rows invisible.
    const bodies = all.filter(rule => PREVIEW_DARK(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsw-alias-file-diff-added-bg:\s*color-mix\(/)
  })

  it('keys off the host’s own attribute', () => {
    // `data-changes-hover-preview` is written by the deliverables component and
    // survives a module rename, unlike its hashed class names.
    expect(all.some(rule => rule.selector.includes('[data-changes-hover-preview]'))).toBe(true)
  })
})

describe('the generic hover card', () => {
  it('is not keyed off a class name', () => {
    // The primitive's local class name is just `card`, and its hash prefix
    // changes per build, so a substring would match half the page. The inline
    // `--dsh-hover-preview-fade` is written by the primitive on every variant.
    const selectors = all.filter(rule => GENERIC(rule.selector) || GENERIC_DARK(rule.selector)).map(rule => rule.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('--dsh-hover-preview-fade')
      expect(selector).not.toMatch(/class\*=/)
    }
  })

  it('replaces the near-black plate with the glass', () => {
    // `--dsw-alias-hovercard-bg` resolves to a solid bluish-850 in both schemes.
    const bodies = all.filter(rule => GENERIC(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix\(/)
    expect(bodies).toMatch(/backdrop-filter:/)
  })

  it('comes before the diff preview, so the specific rule wins', () => {
    // Both match the preview element, and they have the same specificity; only
    // source order separates them.
    const generic = all.find(rule => GENERIC(rule.selector))
    const preview = all.find(rule => PREVIEW(rule.selector))
    expect(generic).toBeDefined()
    expect(preview).toBeDefined()
    expect(generic!.at).toBeLessThan(preview!.at)
  })

  it('has a dark scheme', () => {
    const bodies = all.filter(rule => GENERIC_DARK(rule.selector)).map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/rgb\(226 236 250\)/)
  })
})
