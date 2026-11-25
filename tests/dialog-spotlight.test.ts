// @vitest-environment jsdom
/**
 * The settings sheet and the image viewer are `role='dialog'` portals on
 * <body>. Both were glass in this skin but neither was stamped as a spotlight
 * pane, so the cursor glow and the hover press stopped at their edge while
 * every card around them answered the pointer.
 *
 * Stamping them is not enough on its own — two shapes need guarding:
 * - the image viewer's `role='dialog'` IS the viewport-sized mask, so a
 *   transform would swing the window edges and carry its fixed picture buttons
 *   with it;
 * - a dialog that opens its own `position: fixed` menu re-anchors that menu
 *   into the sheet, the same trap the sidebar and the workbench card have.
 *
 * jsdom reports every element as 0x0, so the viewport test is exercised
 * through the geometry helper rather than by mounting a full-size dialog.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')
const controller = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-aqua-spotlight', 'data-dsh-aqua-press', 'data-ds-dark-theme']) {
    document.documentElement.removeAttribute(attribute)
  }
})

describe('dialogs join the spotlight panes', () => {
  it('stamps portal dialogs on <body>', () => {
    // The host portals them straight under <body>, or under a presentation
    // wrapper. Both shapes must be covered.
    expect(stamper).toContain('body > [role="dialog"]')
    expect(stamper).toContain('body > [role="presentation"] > [role="dialog"]')
  })
  it('keeps the dialog material on ::before', () => {
    // The glow overlay is a z-index -1 child of the pane. A fill painted on
    // the element itself would cover it, so the glass has to sit behind —
    // the same reason the cards moved theirs there.
    const element = /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\) \{([^}]*)\}/.exec(aquaCss)
    expect(element).not.toBeNull()
    expect(element![1]).toMatch(/background:\s*transparent/)
    expect(element![1]).toMatch(/isolation:\s*isolate/)

    const glass = /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\)::before \{([^}]*)\}/.exec(aquaCss)
    expect(glass).not.toBeNull()
    expect(glass![1]).toMatch(/backdrop-filter:\s*blur\(50px\)/)
    expect(glass![1]).toMatch(/z-index:\s*-1/)
  })

  it('overrides the fill for the dark scheme', () => {
    expect(aquaCss).toContain("[data-dsh-aqua] body[data-ds-dark-theme] [role='dialog']:not([class*='backdrop'])::before")
  })
})

describe('the image viewer keeps its own backdrop', () => {
  // Its `role='dialog'` is the full-viewport dim, not a plate. Washing it with
  // the sheet fill turned the whole window into a sheet of glass — that was
  // the reported bug. The picture inside is the surface that answers instead.
  it('excludes the backdrop from every rule that paints', () => {
    // Corner-radius and font rules may still match it; a fill or a blur may
    // not, or the dim gets washed over.
    for (const match of aquaCss.matchAll(/\[[^{}]*\[role='dialog'\][^{}]*\]\s*\{([^}]*)\}/g)) {
      const body = match[1]
      if (!/background|backdrop-filter/.test(body)) continue
      expect(match[0]).toContain("[class*='backdrop']")
    }
  })

  it('stamps the picture instead of the dim', () => {
    expect(stamper).not.toContain('body > [role="dialog"], body > [role="presentation"] > [role="dialog"]')
    expect(stamper).toContain('[class*="backdrop"] img')
  })

  it('skips the glow overlay on a replaced element', () => {
    // An <img> renders no children, so an injected div inside it never paints.
    expect(controller).toContain('replacedElement')
    expect(controller).toMatch(/glowGated\(\) && !replacedElement\(spot\)/)
  })
})

describe('a dialog keeps its own positioning', () => {
  it('leaves the pane rule free of a :not() guard', () => {
    // The generic pane rule must stay at 0,3,0. A `:not([role='dialog'])` guard
    // raises it to 0,4,0 and out-ranks the session panel's own
    // `position: absolute` at 0,3,1, which drops that card into the transcript
    // flow — it lands on the far left.
    const generic = /\[data-dsh-aqua\]\[data-dsh-aqua-spotlight\] \[data-dsh-aqua-spot\] \{([^}]*)\}/
      .exec(aquaCss)
    expect(generic).not.toBeNull()
    expect(generic![1]).toMatch(/position:\s*relative/)

    const paneRule = /\[data-dsh-aqua\]\[data-dsh-aqua-spotlight\] \[data-dsh-aqua-spot\]([^{]*)\{/
      .exec(aquaCss)
    expect(paneRule![1]).not.toContain(':not(')

    // The session panel's override must out-rank the generic rule.
    const panel = /\[data-dsh-aqua\]\[data-dsh-aqua-spotlight\] aside\[data-session-panel\] \{([^}]*)\}/
      .exec(aquaCss)
    expect(panel).not.toBeNull()
    expect(panel![1]).toMatch(/position:\s*absolute/)
  })

  it('does not tilt a viewport-sized dialog', () => {
    // The mask covers the window, so rotating it swings the window edges and
    // re-anchors its fixed picture buttons.
    expect(controller).toContain('function fullViewport')
    expect(controller).toMatch(/if \(fullViewport\(spot\)\) return false/)
  })

  it('does not tilt a dialog that opened its own fixed menu', () => {
    expect(controller).toMatch(/if \(spot\.matches\(DIALOG\)\) \{[\s\S]*PANEL_MENU[\s\S]*return false/)
  })
})
