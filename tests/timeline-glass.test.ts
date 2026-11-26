import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `@deepseek-ai/dsh-timeline` renders one `<div class="dsh-timeline">` into the
 * centre column and paints its board from `--dsw-alias-bg-base` — the canvas
 * colour, which this theme resolves to an opaque `#F4F8FD`. So the fourth main
 * panel stayed a paper sheet while the other three were glass.
 *
 * Its stylesheet is a package stylesheet, not a CSS module, so its selectors keep
 * the plain class names and are reachable with `:global()`.
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

const TIMELINE = all.filter(rule => rule.selector.includes('dsh-timeline'))

describe('the history timeline joins the glass', () => {
  it('wraps the class in :global() so the loader cannot rename it', () => {
    // lightningcss rewrites every bare class selector in this file. A plain
    // `.dsh-timeline` would compile to `<hash>_dsh-timeline` and match nothing —
    // the same trap that left the terminal rules inert.
    for (const rule of TIMELINE) {
      expect(rule.selector, rule.selector).toContain(':global(.dsh-timeline)')
    }
  })

  it('makes the root the floating card', () => {
    const bodies = TIMELINE.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/var\(--dsh-aqua-glass-card-light\)/)
    expect(bodies).toMatch(/backdrop-filter:\s*blur\(/)
    expect(bodies).toMatch(/border-radius:\s*20px/)
  })

  it('has a dark counterpart', () => {
    const bodies = all
      .filter(rule => rule.selector.includes('dsh-timeline') && rule.selector.includes('data-ds-dark-theme'))
      .map(rule => rule.body)
      .join(' ')
    expect(bodies).toMatch(/var\(--dsh-aqua-glass-card-dark\)/)
  })

  it('re-points the canvas colour instead of clearing it globally', () => {
    // The board's blocks are drawn as `color-mix(... 8%, bg-base)`; clearing the
    // base alone would erase them. The scope re-points it, so only this board
    // changes and the page canvas keeps its fill.
    const clears = all.filter(rule => /--dsw-alias-bg-base:\s*transparent/.test(rule.body) && rule.selector.includes('dsh-timeline'))
    expect(clears.length).toBeGreaterThan(0)
    const bodies = TIMELINE.map(rule => rule.body).join(' ')
    expect(bodies).toMatch(/--dsw-alias-bg-layer-1:/)
    expect(bodies).toMatch(/--dsw-alias-bg-layer-2:/)
    expect(bodies).toMatch(/--dsw-specific-sidebar-fill:/)
  })

  it('keeps a fill on the blocks that must stay readable', () => {
    const blocks = all
      .filter(rule => rule.selector.includes('timeline-block'))
      .map(rule => rule.body)
      .join(' ')
    expect(blocks).toMatch(/background:/)
    expect(blocks).not.toMatch(/background:\s*transparent/)
  })

  it('leaves the board scrollable', () => {
    // The timeline is taller than the column by design. Hiding the root would
    // clip everything below the fold, which is the plugin-page mistake again.
    const root = all.find(rule => /:global\(\.dsh-timeline\)\s*(,|$)/.test(rule.selector) && /background:/.test(rule.body))
    expect(root).toBeDefined()
    expect(root!.body).not.toMatch(/overflow:\s*hidden/)
  })
})
