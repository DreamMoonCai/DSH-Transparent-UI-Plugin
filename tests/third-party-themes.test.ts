import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two plugins the user pointed at, which turned out to need opposite advice.
 *
 * Neither writes its own palette. `dshmarket` paints from `--dsw-alias-bg-layer-1/2`,
 * `--dsw-alias-bg-base` and its own `--dshm-sticky-bg`; `dsh-cost-meter` renders a
 * native `<dialog class="cm-stat-dialog">` filled with `--dsw-alias-bg-layer-2`.
 * All of those resolve to flat hex in float mode, which is why both read as white
 * slabs on top of the glass. So the fix is the workbench card's fix: re-point the
 * tokens in the scope each plugin mounts in, and its rows become panes of the
 * same material without naming a single hashed class.
 *
 * The hooks are deliberately stable: `data-dsh-market-root` is the market's own
 * marker on its outermost div, and `cm-stat-dialog` is a plain string class the
 * cost meter passes to `createPortal`, not a CSS-module name.
 */
const css = readFileSync(resolve(__dirname, '../src/client/aqua.module.css'), 'utf8')
const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')

function ruleBody(selector: string): string {
  const at = flat.indexOf(selector)
  expect(at, `missing rule: ${selector}`).toBeGreaterThan(-1)
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

describe('the plugin market joins the glass', () => {
  it('re-points the layer tokens the market paints from', () => {
    const body = ruleBody("[data-dsh-float] [data-dsh-market-root],")
    expect(body).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/--dsw-alias-bg-layer-2:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/--dsw-alias-bg-module-platform/)
  })

  it('leaves the canvas colour alone, because the cost meter reads it literally', () => {
    // `cm-input:is(select) :is(option, optgroup)` paints
    // `rgb(from var(--dsw-alias-bg-base) r g b / 1)`; transparent would turn
    // that dropdown black. Neither plugin paints the canvas colour directly, so
    // there is nothing to gain by clearing it.
    const body = ruleBody("[data-dsh-float] [data-dsh-market-root],")
    expect(body).not.toMatch(/--dsw-alias-bg-base:/)
  })

  it('covers the market sticky band, which falls back to the canvas colour', () => {
    // `.nUhMVa_stickyHead { background: var(--dshm-sticky-bg, var(--dsw-alias-bg-base, #fff)) }`
    // — the fallback is the canvas colour, so the band's own variable has to be
    // answered for it to read as frosted rather than as the stock page fill.
    const body = ruleBody("[data-dsh-float] [data-dsh-market-root],")
    expect(body).toMatch(/--dshm-sticky-bg:/)
    expect(body).toMatch(/--dshm-stuck-bg:/)
  })

  it('gives that band a blur so rows sliding under it stay readable', () => {
    const body = ruleBody("[data-dsh-float] [data-dsh-market-root] [class*='stickyHead']")
    expect(body).toMatch(/backdrop-filter:\s*blur\(calc\(var\(--dsh-aqua-blur, 14px\) \* 1\.2\)\)/)
  })

  it('has a dark counterpart one step dimmer', () => {
    const body = ruleBody(
      '[data-dsh-float] body[data-ds-dark-theme] [data-dsh-market-root],'
    )
    expect(body).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(in srgb, rgb\(226 236 250\)/)
    expect(body).toMatch(/--dshm-sticky-bg:/)
  })
})

describe('the session cost sheet joins the glass', () => {
  it('re-points the layer tokens the sheet and its cards paint from', () => {
    // The dialog fills itself with layer-2; the budget cards, quota detail,
    // pricing nav, price cards and bbox readouts inside it fill with layer-1.
    const body = ruleBody('[data-dsh-float] body :global(dialog.cm-stat-dialog)')
    expect(body).toMatch(/--dsw-alias-bg-layer-1:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).toMatch(/--dsw-alias-bg-layer-2:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    expect(body).not.toMatch(/--dsw-alias-bg-base:/)
  })

  it('scopes the fill to the glass, with a dark variant', () => {
    const at = flat.indexOf('dialog.cm-stat-dialog')
    expect(at).toBeGreaterThan(-1)
    const tail = flat.slice(at)
    expect(tail).toMatch(
      /background:\s*var\(--dsh-aqua-glass-card-light\)[\s\S]{0,240}backdrop-filter:\s*blur\(var\(--dsh-aqua-blur, 14px\)\)/
    )
    const darkAt = flat.indexOf('[data-dsh-float] body[data-ds-dark-theme] :global(dialog.cm-stat-dialog)')
    expect(darkAt).toBeGreaterThan(-1)
    expect(flat.slice(darkAt)).toMatch(/background:\s*var\(--dsh-aqua-glass-card-dark\)/)
  })
})

describe('the hooks survive a hash rename', () => {
  it('uses the market marker attribute, not a module class', () => {
    expect(flat).toContain('[data-dsh-market-root]')
    expect(flat).not.toMatch(/nUhMVa_/)
  })

  it('also answers the portal the market moves its layers into', () => {
    // The market's dialogs, lightbox and any floating layer are portalled into
    // its own `div[data-dsh-market-portal]`, appended to <body> — outside the
    // `data-dsh-market-root` subtree, so the token re-point above never reached
    // them and those layers kept painting the opaque canvas colour.
    expect(ruleBody('[data-dsh-float] [data-dsh-market-root],')).toMatch(
      /--dsw-alias-settings-card-fill:/
    )
    expect(flat).toContain('[data-dsh-float] [data-dsh-market-portal],')
    expect(flat).toContain('[data-dsh-float] body[data-ds-dark-theme] [data-dsh-market-portal],')
  })

  it('declares the market card fill literally instead of inheriting the alias', () => {
    // `--dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2)` is expanded
    // where the theme declares it, so an opaque pixel travels down and no
    // re-point of layer-2 reaches the card. Same reason the body block writes it
    // out again.
    const body = ruleBody('[data-dsh-float] [data-dsh-market-root],')
    const line = /--dsw-alias-settings-card-fill:\s*([^;]+);/.exec(body)
    expect(line).not.toBeNull()
    expect(line![1]).not.toContain('var(--dsw-alias-bg-layer-2)')
    expect(line![1]).toMatch(/color-mix\(in srgb, rgb\(255 255 255\)/)
  })

  it('clears the statistics wrapper the dialog body renders', () => {
    // The sheet stayed white with every section already glass, because the
    // wrapper they sit in is `.cm-stat` — a full-bleed plate inside the dialog,
    // 945×963 in the reported case — painting from the same alpha-flattened
    // pair. It is not a card, so it is cleared rather than filled: the dialog
    // already carries the glass and a second plate would rebuild the slab.
    const body = ruleBody(
      "[data-dsh-float] body [role='dialog']:not([class*='backdrop']) :global(.cm-stat)"
    )
    expect(body).toMatch(/background:\s*transparent\s*!important/)
    expect(body).toMatch(/--cm-surface:\s*color-mix\(in srgb, rgb\(255 255 255\)/)
    // The treemap draws label fills and strokes from --cm-bg, so it must stay
    // a colour rather than become transparent.
    expect(body).not.toMatch(/--cm-bg:/)
  })

  it('glasses the plugin buttons that read the host elevated fill', () => {
    // `.cm-btn` paints from `--dsw-alias-button-elevated-fill`, which resolves
    // to #fff and that this skin never touches. The trigger mounts in the
    // conversation header action slot, outside any dialog, so a dialog-scoped
    // rule cannot reach it — `data-cm-display` is the plugin's own marker on
    // that element.
    expect(ruleBody("[data-dsh-float] :global(button.cm-btn)[data-cm-display]")).toMatch(
      /background:\s*var\(--dsh-aqua-glass-card-light\)/
    )
    // The sheet's own buttons are descendants of a dialog, and the action
    // buttons (`.primary`) keep the brand fill.
    expect(flat).toContain(":global(.cm-btn):not(:global(.primary))")
    expect(flat).toMatch(/\[data-cm-sidebar-card\]/)
  })

  it('names the two rows that read the canvas colour instead of clearing it', () => {
    // `--dsw-alias-bg-base` has to stay opaque in the cost scopes: the plugin
    // paints the platform's select dropdown with `rgb(from … / 1)` off that
    // token, and a translucent value renders that list on black. So the two
    // rows that read it are named, and no cost-scoped rule clears the token.
    expect(flat.indexOf(":global(.cm-pricing-nav-item.active)")).toBeGreaterThan(-1)
    const costScopes = [
      "[data-dsh-float] :is(",
      "[data-dsh-float] body [role='dialog']:not([class*='backdrop']) :global(.cm-stat)",
    ]
    for (const scope of costScopes) {
      const body = ruleBody(scope)
      expect(body).not.toMatch(/--dsw-alias-bg-base:\s*transparent/)
    }
  })

  it('wraps the cost dialog class in :global() so the CSS-module pass leaves it alone', () => {
    // lightningcss rewrites every bare class selector; `dialog.cm-stat-dialog`
    // compiled to `dialog._4y1oNG_cm-stat-dialog` and stopped matching anything,
    // because that class is a plain string in the plugin, not a module name.
    const uses = [...flat.matchAll(/dialog\.cm-stat-dialog/g)].length
    const globals = [...flat.matchAll(/:global\(dialog\.cm-stat-dialog\)/g)].length
    expect(globals).toBeGreaterThan(0)
    expect(uses).toBe(globals)
  })
})
