import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two surfaces the transcript puts in the middle of prose, both of which were
 * painted with an opaque token and so stood out on the glass:
 *
 * 1. The inline code chip. Every `` `like this` `` is `:not(pre) > code` in the
 *    markdown body, and the renderer gives it
 *    `background-color: var(--dsw-alias-markdown-inline-code)` — `neutral-50`, an
 *    opaque warm grey — plus `border: .5px solid var(--dsw-alias-border-l1)`.
 *    On the glass that reads as a small grey ticket stuck to the page.
 * 2. The conversation view tabs (对话 / 轨迹). They are plain
 *    `button[role='tab']` inside `[data-conversation-tabs]`, drawn with nothing
 *    but a 2px underline under the open one, so on a glass column the two words
 *    float with a link's hairline instead of reading as a switch.
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

function rulesFor(needle: string): Rule[] {
  return all.filter(rule => rule.selector.includes(needle))
}

describe('the inline code chip is a pane of the same glass', () => {
  const chips = all.filter(rule => /:not\(pre\)\s*>\s*code/.test(rule.selector))

  it('skins the inline chip and not the code block', () => {
    // `pre > code` is a fenced block and carries its own rules; only the
    // inline split belongs here.
    expect(chips.length).toBeGreaterThan(0)
    for (const rule of chips) {
      expect(rule.selector, rule.selector).toMatch(/:not\(pre\)\s*>\s*code/)
    }
  })

  it('replaces the opaque fill with the frost family', () => {
    const bodies = chips.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/background-color:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(bodies).toMatch(/background-color:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
  })

  it('out-specifies the host rule it replaces', () => {
    // The host's selector is `.markdown :not(pre) > code` — a class plus a type,
    // in a wrapper. A `[data-dsh-float] :not(pre) > code` prefix ties on
    // specificity and loses on source order, so the grey plate would survive.
    for (const rule of chips) {
      const attrs = rule.selector.match(/\[[^\]]+\]/g) ?? []
      expect(attrs.length, rule.selector).toBeGreaterThanOrEqual(2)
      expect(rule.selector, rule.selector).toMatch(/^html\[/)
    }
  })

  it('keeps a hairline, so the chip still reads as code', () => {
    const bodies = chips.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/border-color:\s*rgba\(19, 45, 83/)
    expect(bodies).toMatch(/border-color:\s*rgba\(148, 180, 220/)
  })
})

describe('the conversation view tabs are a switch, not a link', () => {
  const tabs = rulesFor("[data-conversation-tabs] > [role='tab']")

  it('keys off the component attribute, not the hashed class', () => {
    expect(tabs.length).toBeGreaterThan(0)
    for (const rule of tabs) {
      expect(rule.selector, rule.selector).toContain('data-conversation-tabs')
    }
    // The class is a CSS-module hash (`an3WzG_viewTabs`) that moves each release.
    expect(flat).not.toMatch(/an3WzG_/)
  })

  it('gives the open tab a raised pane', () => {
    const selected = all.filter(
      rule => rule.selector.includes('data-conversation-tabs') && rule.selector.includes("aria-selected='true'"),
    )
    expect(selected.length).toBeGreaterThan(0)
    const bodies = selected.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/background:\s*color-mix/)
    expect(bodies).toMatch(/box-shadow:\s*[\s\S]*inset 0 1px 0 rgba\(255, 255, 255/)
  })

  it('answers the pointer on the closed ones', () => {
    const hover = all.filter(
      rule => rule.selector.includes('data-conversation-tabs') && rule.selector.includes(':hover'),
    )
    expect(hover.length).toBeGreaterThan(0)
    expect(hover.map(rule => rule.body).join(' ')).toMatch(/background:\s*color-mix/)
  })

  it('has a dark counterpart', () => {
    for (const rule of [...tabs, ...all.filter(r => r.selector.includes('data-conversation-tabs'))]) {
      if (rule.selector.includes('data-ds-dark-theme')) continue
      const dark = all.some(
        other => other.selector.includes('data-ds-dark-theme') && other.selector.includes(rule.selector.split(' [data-conversation-tabs]')[0]),
      )
      expect(dark, rule.selector).toBe(true)
    }
  })
})
