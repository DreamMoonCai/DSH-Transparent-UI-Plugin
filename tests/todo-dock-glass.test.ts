// @vitest-environment jsdom
/**
 * The task panel (`section[data-testid='todo-panel']`) sits on the same seat as
 * the queued-message dock: directly above the composer, inside its dock slot.
 * The host paints `.DXuOLW_root` with `background: var(--dsw-specific-menu)` —
 * the menu family's 70% white, tuned to sit over arbitrary page content — and
 * adds `backdrop-filter: var(--dsw-menu-backdrop-filter)`. Over the composer's
 * own glass that reads as one more pale slab stacked on the card rather than a
 * pane of the same water, which is what the screenshot showed.
 *
 * The seam is the host's own `data-testid`, because the module class is
 * build-hashed and `DXuOLW_` will not survive the next release.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')

/** Declarations of the rule whose selector list contains `needle`. */
function blockOf(needle: string): string | null {
  const bare = aquaCss.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].includes(needle)) return match[2]
  }
  return null
}

function mount(): void {
  document.documentElement.setAttribute('data-dsh-aqua', '')
  document.documentElement.setAttribute('data-dsh-float', '')
  document.head.innerHTML = `<style>${aquaCss}</style>`
  document.body.innerHTML = `
    <div data-dsh-frame>
      <section data-testid="todo-panel" aria-label="tasks">
        <div class="host_body">
          <button type="button" class="host_header" aria-expanded="false">
            <span class="host_title">Tasks</span>
          </button>
        </div>
      </section>
    </div>`
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-dsh-aqua')
  document.documentElement.removeAttribute('data-dsh-float')
  document.body.removeAttribute('data-ds-dark-theme')
})

describe('the task dock is a pane of the glass', () => {
  it('keys off the host data-testid, not the hashed class', () => {
    expect(aquaCss).toContain("[data-testid='todo-panel']")
    expect(aquaCss).not.toContain('DXuOLW')
  })

  it('takes the card material instead of the menu fill', () => {
    const rule = blockOf("[data-testid='todo-panel']")
    expect(rule).not.toBeNull()
    expect(rule).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(rule).not.toMatch(/--dsw-specific-menu/)
  })

  it('blurs what is behind it', () => {
    // Without a filter the panel is a flat wash rather than glass.
    const rule = blockOf("[data-testid='todo-panel']")
    expect(rule).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur/)
  })

  it('carries a dark variant', () => {
    const rule = blockOf("[data-testid='todo-panel']")
    expect(aquaCss).toMatch(
      /body\[data-ds-dark-theme\] \[data-testid='todo-panel'\]\s*\{[^}]*--dsh-aqua-glass-card-dark/,
    )
    expect(rule).not.toBeNull()
  })

  it('reads as glass in the live tree', () => {
    mount()
    const style = getComputedStyle(document.querySelector("[data-testid='todo-panel']") as Element)
    expect(style.borderRadius).toBe('20px')
    expect(style.borderTopWidth).toBe('1px')
  })

  it('keeps the header transparent so the panel is the only fill', () => {
    // The collapsed header is a plain button with no fill of its own; a rule on
    // it would double-paint the strip.
    expect(aquaCss).not.toMatch(/\[data-testid='todo-panel'\]\s+\[class\*='header'\]\s*\{/)
  })
})
