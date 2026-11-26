import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A third-party page in the MAIN slot, and the modal it opens from there.
 *
 * `dsh-github-flow` registers `main` and renders `.dsh-github-panel`, a div that
 * paints `background: var(--dsw-alias-bg-base, #fff)` over the full column. It
 * is not `section[data-plugin-panel]` — only the plugin manager and the
 * scheduled-tasks page use that marker — so the floating-card rule never reached
 * it and the whole tab stayed an opaque plate, in the main area and in the
 * right-hand pane alike. The modal it opens is its own `role='dialog'` rendered
 * inside the page rather than portalled to `body`, so none of the sheet rules
 * saw that either.
 *
 * The host hook is `data-global-panel` on `[class*='mainPanel']`: the layout sets
 * it only while a plugin page is showing instead of the conversation.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\r\n/g, '\n')

function ruleBody(selector: string): string {
  const at = flat.indexOf(selector)
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1)
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

describe('a page in the main slot joins the glass', () => {
  it('clears the canvas colour on the host panel wrapper', () => {
    // The wrapper exists exactly while a plugin page is showing, so the
    // conversation never matches it.
    const body = ruleBody("[data-dsh-float] [class*='mainPanel'][data-global-panel] {")
    expect(body).toMatch(/--dsw-alias-bg-base:\s*transparent/)
    expect(body).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/--dsw-alias-bg-layer-2:/)
    expect(body).toMatch(/--dsw-alias-settings-card-fill:/)
  })

  it('has a dark counterpart', () => {
    const body = ruleBody("[data-dsh-float] body[data-ds-dark-theme] [class*='mainPanel'][data-global-panel] {")
    expect(body).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
  })

  it('clears the page roots that paint the canvas colour themselves', () => {
    // Both are plain class strings in the plugin's injected sheet, so the
    // CSS-module pass would hash them without `:global`.
    expect(flat).toContain(':global(.dsh-github-panel)')
    expect(flat).toContain(':global(.dsh-github-rightbar-container)')
  })

  it('gives the page root the same card box the plugin manager gets', () => {
    const at = flat.indexOf("[class*='mainPanel'][data-global-panel] > :is(")
    expect(at).toBeGreaterThan(-1)
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', flat.indexOf('{', at)))
    expect(body).toMatch(/border-radius:\s*20px/)
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/)
  })
})

describe("the plugin's own modal is not a DSH dialog", () => {
  it('paints the dialog from the sheet material', () => {
    const at = flat.indexOf(':global(.dsh-github-modal-dialog)')
    expect(at).toBeGreaterThan(-1)
    const body = flat.slice(flat.indexOf('{', at), flat.indexOf('}', flat.indexOf('{', at)))
    expect(body).toMatch(/background:\s*var\(--dsh-aqua-glass-card-light\)/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/)
  })

  it('covers the help, PR, issue and run dialogs too', () => {
    for (const name of ['help-dialog', 'pr-modal-dialog', 'issue-modal-dialog', 'run-modal-dialog']) {
      expect(flat).toContain(`:global(.dsh-github-${name})`)
    }
  })

  it('keeps the scrim but drops its blur', () => {
    // A filtered ancestor is a containing block for the plugin's
    // `position: fixed` dropdowns, which is how its branch and repo pickers get
    // re-anchored and clipped.
    const body = ruleBody('[data-dsh-float] :global(.dsh-github-modal-overlay)')
    expect(body).toMatch(/backdrop-filter:\s*none/)
  })
})
