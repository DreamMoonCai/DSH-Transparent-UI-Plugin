// @vitest-environment jsdom
/**
 * The workbench's tab chips sit inside the glass card, but the active one was
 * a flat opaque slab: the kit paints it with
 * `background: var(--dsw-alias-markdown-tag)`, which resolves to
 * `rgb(241, 243, 245)` in light mode — a grey sticker on top of the glass.
 *
 * The chip is now re-pointed at the card's own material, keyed off `role='tab'`
 * plus the kit's stable `data-dockkit-strip` attribute and `aria-selected`.
 * Module class names are never named: 0.2.3 hashed them once already.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

interface Rule {
  selector: string
  body: string
}

/** Flatten the stylesheet, dropping comments so they never glue onto a selector. */
function parseRules(): Rule[] {
  const rules: Rule[] = []
  let cursor = 0
  let start = 0
  while (cursor < aquaCss.length) {
    const char = aquaCss[cursor]
    if (char === '{') {
      const selector = aquaCss.slice(start, cursor).replace(/\/\*[\s\S]*?\*\//g, '').trim()
      let depth = 1
      let end = cursor + 1
      while (end < aquaCss.length && depth > 0) {
        if (aquaCss[end] === '{') depth += 1
        else if (aquaCss[end] === '}') depth -= 1
        end += 1
      }
      if (!selector.startsWith('@')) rules.push({ selector, body: aquaCss.slice(cursor + 1, end - 1) })
      cursor = end
      start = cursor
      continue
    }
    cursor += 1
  }
  return rules
}

const rules = parseRules()

/** Every rule whose selector list contains `selector` as one whole item. */
function rulesFor(selector: string): Rule[] {
  const wanted = selector.replace(/\s+/g, ' ').trim()
  return rules.filter(rule => rule.selector.split(',').some(item => item.replace(/\s+/g, ' ').trim() === wanted))
}

/** Bodies of every rule carrying `selector`, joined. */
function bodyOf(selector: string): string {
  return rulesFor(selector).map(rule => rule.body).join('\n')
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
})

describe('the active workbench tab is glass, not a slab', () => {
  const active = "[data-dsh-float] [data-dsh-details] [data-dockkit-strip] [role='tab'][aria-selected='true']"

  it('replaces the host fill with a translucent one', () => {
    const body = bodyOf(active)
    expect(body).toMatch(/background:/)
    // A bare colour would be another slab; the recipe must go through
    // `color-mix` with the frost knob like every other glass surface.
    expect(body).toMatch(/color-mix\(in srgb/)
    expect(body).toMatch(/--dsh-aqua-frost/)
  })

  it('frosts what is behind it', () => {
    expect(bodyOf(active)).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur/)
  })

  it('draws its own hairline instead of relying on the host chip', () => {
    const body = bodyOf(active)
    expect(body).toMatch(/box-shadow:/)
    expect(body).toMatch(/inset/)
  })
})

describe('the idle and hover chips stay quiet', () => {
  const idle = "[data-dsh-float] [data-dsh-details] [data-dockkit-strip] [role='tab']"
  const hover = "[data-dsh-float] [data-dsh-details] [data-dockkit-strip] [role='tab']:hover:not([aria-selected='true'])"

  it('leaves the idle chip to the card glass', () => {
    const body = bodyOf(idle)
    // No background of its own: the card underneath is the material.
    expect(body).not.toMatch(/background:/)
    expect(body).toMatch(/transition:/)
  })

  it('lifts a hovered chip just enough', () => {
    expect(bodyOf(hover)).toMatch(/color-mix\(in srgb/)
  })
})

describe('both schemes carry their own chip', () => {
  it('overrides the active chip in dark mode', () => {
    const dark = "[data-dsh-float] body[data-ds-dark-theme] [data-dsh-details] [data-dockkit-strip] [role='tab'][aria-selected='true']"
    expect(rulesFor(dark).length).toBeGreaterThan(0)
  })

  it('overrides the hover wash in dark mode', () => {
    const dark = "[data-dsh-float] body[data-ds-dark-theme] [data-dsh-details] [data-dockkit-strip] [role='tab']:hover:not([aria-selected='true'])"
    expect(rulesFor(dark).length).toBeGreaterThan(0)
  })
})

describe('the seam survives module renames', () => {
  /** Rules that positively target the strip, ignoring those that exclude it. */
  const stripRules = (): Rule[] =>
    rules.filter(rule => {
      // `:not([data-dockkit-strip])` is an exclusion, not a target: the shared
      // segmented-control rules use it to leave this strip alone.
      const positive = rule.selector.replace(/:not\([^)]*\[data-dockkit-strip\][^)]*\)/g, '')
      return positive.includes('dockkit-strip')
    })

  it('never names a hashed class', () => {
    for (const rule of stripRules()) {
      expect(rule.selector).not.toMatch(/\[class[*^$]?=/)
    }
  })

  it('scopes the chip to the workbench card', () => {
    for (const rule of stripRules()) {
      expect(rule.selector).toContain('[data-dsh-details]')
    }
  })
})
