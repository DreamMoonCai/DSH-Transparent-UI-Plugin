// @vitest-environment jsdom
/**
 * Native `<select>` renders its popup in a browser-owned layer, so a plain
 * `background` override on the element never reached the list — opening a
 * route picker dropped a solid white sheet with square corners onto the glass.
 *
 * Raising the element to `appearance: base-select` moves the picker into the
 * page, which exposes `::picker(select)`, `option` and `::checkmark`. The rules
 * below skin those, keyed off the plugin's own `[data-dsh-aqua]` root so they
 * ride the same enable switch as every other surface.
 *
 * jsdom has no `::picker()`, so these assertions read the stylesheet text: the
 * contract is that each piece of the picker is covered and that the rules stay
 * inside the `@supports` guard, which keeps browsers without customizable
 * selects on the stock control.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

interface Rule {
  /** Selector text exactly as authored (may be a comma-separated list). */
  selector: string
  /** Declaration block, braces excluded. */
  body: string
  /** Enclosing at-rules, outermost first. */
  guards: string[]
}

/**
 * Flatten the stylesheet into rules. Nested at-rules are tracked so a caller
 * can tell a top-level rule from one inside `@supports`.
 */
function parseRules(): Rule[] {
  const rules: Rule[] = []
  const guards: string[] = []
  let cursor = 0
  let selectorStart = 0

  while (cursor < aquaCss.length) {
    const char = aquaCss[cursor]
    if (char === '{') {
      // Comments sit between the previous rule and this selector, so they
      // arrive glued to the front of the text.
      const selector = aquaCss.slice(selectorStart, cursor).replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (selector.startsWith('@')) {
        guards.push(selector)
        cursor += 1
        selectorStart = cursor
        continue
      }
      let depth = 1
      let end = cursor + 1
      while (end < aquaCss.length && depth > 0) {
        if (aquaCss[end] === '{') depth += 1
        else if (aquaCss[end] === '}') depth -= 1
        end += 1
      }
      rules.push({ selector, body: aquaCss.slice(cursor + 1, end - 1), guards: [...guards] })
      cursor = end
      selectorStart = cursor
      continue
    }
    if (char === '}') {
      guards.pop()
      cursor += 1
      selectorStart = cursor
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

/** Declarations of the first rule carrying `selector`. */
function declarationsOf(selector: string): string {
  const [rule] = rulesFor(selector)
  if (rule === undefined) throw new Error(`missing rule: ${selector}`)
  return rule.body
}

/** Bodies of every rule that defines `token`. */
function tokenDeclarations(token: string): string[] {
  return rules.filter(rule => rule.body.includes(`${token}:`)).map(rule => rule.body)
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-dsh-aqua')
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('native selects render their picker in the page', () => {
  it('raises the element and its picker to base-select', () => {
    // Both halves are required: the element alone leaves the popup in the
    // browser's own layer, where no page rule reaches it.
    const targets = rulesFor('[data-dsh-aqua] select')
    expect(targets.some(rule => /appearance:\s*base-select/.test(rule.body))).toBe(true)
    expect(declarationsOf('[data-dsh-aqua] select::picker(select)')).toBeDefined()
    expect(rulesFor('[data-dsh-aqua] select::picker(select)').some(rule => /appearance:\s*base-select/.test(rule.body)))
      .toBe(true)
  })

  it('keeps the rewrite behind an @supports guard', () => {
    // Without customizable selects the declaration is ignored and the stock
    // control must survive untouched.
    const guarded = rulesFor('[data-dsh-aqua] select::picker(select)')
    expect(guarded.length).toBeGreaterThan(0)
    expect(guarded.every(rule => rule.guards.some(guard => guard.includes('appearance: base-select')))).toBe(true)
  })
})

describe('the picker takes the same glass as the other floating surfaces', () => {
  it('frosts the picker panel', () => {
    const panel = rulesFor('[data-dsh-aqua] select::picker(select)')
      .map(rule => rule.body)
      .join('\n')
    expect(panel).toMatch(/backdrop-filter:/)
  })

  it('gives the picker its own rounded plate', () => {
    const panel = rulesFor('[data-dsh-aqua] select::picker(select)')
      .map(rule => rule.body)
      .join('\n')
    expect(panel).toMatch(/border-radius:\s*16px/)
    expect(panel).toMatch(/box-shadow:/)
  })

  it('keeps a gap from the trigger instead of welding the plates', () => {
    const panel = rulesFor('[data-dsh-aqua] select::picker(select)')
      .map(rule => rule.body)
      .join('\n')
    expect(panel).toMatch(/margin-block:\s*6px/)
  })

  it('clears the picker backdrop', () => {
    // The picker paints over its own page-sized backdrop; the stock dim would
    // darken the whole transcript for a dropdown.
    expect(declarationsOf('[data-dsh-aqua] select::backdrop')).toMatch(/background:\s*transparent/)
  })
})

describe('the options read as rows of the skin', () => {
  it('rounds and pads each option', () => {
    const option = declarationsOf('[data-dsh-aqua] select option')
    expect(option).toMatch(/border-radius:\s*9px/)
    expect(option).toMatch(/padding:/)
  })

  it('marks hover and the current choice', () => {
    expect(declarationsOf('[data-dsh-aqua] select option:hover')).toMatch(/background:/)
    expect(declarationsOf('[data-dsh-aqua] select option:checked')).toMatch(/background:/)
  })

  it('pushes the tick to the right edge', () => {
    const checkmark = declarationsOf('[data-dsh-aqua] select option::checkmark')
    expect(checkmark).toMatch(/margin-inline-start:\s*auto/)
    expect(checkmark).toMatch(/order:\s*1/)
  })
})

describe('both schemes carry their own select palette', () => {
  it('defines the light values on the root attribute', () => {
    const light = tokenDeclarations('--dsh-aqua-select-panel')
    expect(light.length).toBeGreaterThan(0)
    expect(light[0]).toMatch(/--dsh-aqua-select-panel:/)
  })

  it('overrides them under the dark attribute', () => {
    const dark = rulesFor('[data-dsh-aqua] body[data-ds-dark-theme]')
    expect(dark.length).toBeGreaterThan(0)
    expect(dark.some(rule => rule.body.includes('--dsh-aqua-select-panel:'))).toBe(true)
  })
})

describe('the trigger adopts the skin', () => {
  it('replaces the stock control chrome', () => {
    const trigger = rulesFor('[data-dsh-aqua] select')
      .map(rule => rule.body)
      .join('\n')
    expect(trigger).toMatch(/border-radius:/)
    expect(trigger).toMatch(/background:/)
    expect(trigger).toMatch(/padding:/)
  })

  it('rotates the chevron while the picker is open', () => {
    expect(declarationsOf('[data-dsh-aqua] select:open::picker-icon')).toMatch(/rotate:\s*180deg/)
  })
})

describe('the picker carries the same press as the panes', () => {
  // `::picker()` is a pseudo-element: the controller cannot measure it, so the
  // press is the material's own — a scale-up on open and a tighter shadow
  // under the pointer, the shadow-press the session panel already uses.
  const pickerBody = (): string => rulesFor('[data-dsh-aqua] select::picker(select)')
    .map(rule => rule.body)
    .join('\n')

  it('rises from a smaller scale when it opens', () => {
    expect(aquaCss).toContain('@starting-style')
    const starting = rules.find(rule => rule.guards.some(guard => guard.startsWith('@starting-style')))
    expect(starting).toBeDefined()
    expect(starting!.body).toMatch(/scale:\s*0\.96/)
  })

  it('rides the same 300ms clock as the panes', () => {
    expect(pickerBody()).toMatch(/transition:[\s\S]*0\.3s cubic-bezier\(0\.4, 0, 0\.2, 1\)/)
  })

  it('animated the scale and the shadow, not just the colour', () => {
    const body = pickerBody()
    expect(body).toMatch(/transition:[\s\S]*scale/)
    expect(body).toMatch(/transition:[\s\S]*box-shadow/)
  })

  it('presses the rows the pointer lands on', () => {
    expect(declarationsOf('[data-dsh-aqua] select option:hover')).toMatch(/scale:\s*0\.985/)
  })
})

describe('other plugins\' popups press the same way', () => {
  // Command lists, model pickers and popover cards come from other plugins as
  // `position: fixed` layers. They keep their geometry and their own entry
  // animation; only the elevation moves, on the same clock.
  const pressed = [
    "[data-dsh-float][data-dsh-aqua-press] [role='menu']",
    "[data-dsh-float][data-dsh-aqua-press] [role='listbox']",
    '[data-dsh-float][data-dsh-aqua-press] [data-radix-popper-content-wrapper]',
  ]

  it('presses menus, listboxes and popper cards', () => {
    for (const selector of pressed) {
      expect(declarationsOf(selector)).toMatch(/transition:\s*box-shadow/)
      expect(declarationsOf(`${selector}:hover`)).toMatch(/box-shadow:/)
    }
  })

  it('gates the whole family on the press switch', () => {
    // One toggle turns the cards and every popup off together.
    for (const selector of pressed) {
      expect(selector.startsWith('[data-dsh-float][data-dsh-aqua-press]')).toBe(true)
    }
  })
})
