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

describe('the sheet paints its contents from its own material', () => {
  // The dialog's rows carry solid surface tokens: a selected nav row uses
  // `--dsw-alias-bg-layer-1`, a segmented control sits on
  // `--dsw-alias-bg-module-platform`, an input on `--dsw-alias-bg-layer-3`.
  // In float mode those are flat hex values, so every row landed as an opaque
  // plate on the glass. The sheet clears them in its own scope.
  const sheet = "[data-dsh-aqua] body [role='dialog']:not([class*='backdrop'])"
  const darkSheet = "[data-dsh-aqua] body[data-ds-dark-theme] [role='dialog']:not([class*='backdrop'])"

  const tokens = [
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-layer-3',
    '--dsw-alias-bg-module-platform',
    '--dsw-alias-button-ghost-active-fill',
    // The nav's selected row skips the layer tokens entirely: the settings
    // panel paints it with this pair, which the float palette pins to a flat
    // `#DEE9F8`. Missing them was why the first attempt showed no change.
    '--dsw-specific-sidebar-nav-item-active',
    '--dsw-specific-sidebar-nav-item-active-accent',
  ]

  it('re-points every solid surface token to a translucent one', () => {
    const body = /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\) \{([^}]*)\}/.exec(aquaCss)
    expect(body).not.toBeNull()
    for (const token of tokens) {
      expect(body![1]).toContain(`${token}:`)
      // Every value must go through color-mix with the frost knob; a bare hex
      // would be another slab.
      const line = body![1].split('\n').find(text => text.includes(`${token}:`))!
      expect(line).toMatch(/color-mix\(in srgb/)
      expect(line).toMatch(/--dsh-aqua-frost/)
    }
  })

  it('carries a dark palette for the same tokens', () => {
    const dark = /\[data-dsh-aqua\] body\[data-ds-dark-theme\] \[role='dialog'\]:not\(\[class\*='backdrop'\]\) \{([^}]*)\}/
      .exec(aquaCss)
    expect(dark).not.toBeNull()
    for (const token of tokens) expect(dark![1]).toContain(`${token}:`)
  })

  it('leaves the ink and hairlines alone', () => {
    // Only surface fills are re-pointed; a row still needs its own label colour
    // and its own border, or the sheet turns into flat text on a blur.
    const body = /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\) \{([^}]*)\}/.exec(aquaCss)
    expect(body![1]).not.toContain('--dsw-alias-label')
    expect(body![1]).not.toContain('--dsw-alias-border')
  })

  it('covers the nav token the settings panel actually reads', () => {
    // The panel's selected row is `.AnXs9G_navCell.AnXs9G_active` with
    // `background: var(--dsw-specific-sidebar-nav-item-active)`. It never
    // touches bg-layer-*, so overriding those alone changed nothing.
    const body = /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\) \{([^}]*)\}/.exec(aquaCss)
    expect(body![1]).toContain('--dsw-specific-sidebar-nav-item-active:')
  })
})

describe('the selected nav row out-reads the idle one', () => {
  // The skin separates surfaces by how much light they catch, never by hue: a
  // selected session, a pressed card and the composer's recess all work that
  // way. A blue pill read as a foreign element.
  const current = "[data-dsh-aqua] body [role='dialog']:not([class*='backdrop']) nav button[aria-current='true']"
  const currentBody = (): string =>
    /\[data-dsh-aqua\] body \[role='dialog'\]:not\(\[class\*='backdrop'\]\) nav button\[aria-current='true'\] \{([^}]*)\}/
      .exec(aquaCss)![1]

  it('separates the row by brightness, not by a hue', () => {
    const body = currentBody()
    // A white pane one step above the sheet.
    expect(body).toMatch(/background:\s*color-mix\(in srgb, rgb\(255 255 255\) calc\(\d+%/)
    // No brand blue anywhere in the recipe: the skin has no tinted selection.
    expect(body).not.toMatch(/rgb\(63 118 216\)/)
  })

  it('catches the light on its top edge', () => {
    expect(currentBody()).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.7\d\)/)
  })

  it('lifts off the plate with a short shadow', () => {
    expect(currentBody()).toMatch(/0 1px 2px rgba\(19, 45, 83/)
  })

  it('draws no second ring', () => {
    // The host autofocuses this row (`data-modal-autofocus` puts it in the
    // modal's focus order), so it already draws the focus ring. An extra inset
    // ring stacked into a double outline.
    expect(currentBody()).not.toMatch(/inset 3px 0 0/)
  })

  it('raises the label weight', () => {
    expect(currentBody()).toMatch(/font-weight:\s*600/)
  })

  it('leaves hover to the host', () => {
    // `.AnXs9G_navCell:hover` paints `--dsw-alias-interactive-bg-hover`, an 8%
    // ink wash that reads on both schemes. A white wash of our own was nothing
    // over a white glass plate, and the hover feedback disappeared. The selected
    // row out-specifies that rule by attribute, so the mark survives the cursor.
    expect(aquaCss).not.toMatch(/nav button:not\(\[aria-current='true'\]\):hover/)
  })

  it('keys the state off aria-current, never a hashed class', () => {
    expect(aquaCss).toContain("nav button[aria-current='true']")
    for (const match of aquaCss.matchAll(/\[[^{}]*nav button\[aria-current='true'\][^{}]*\]\s*\{/g)) {
      expect(match[0]).not.toMatch(/\[class[*^$]?=/)
    }
  })

  it('carries a dark recipe too', () => {
    const dark = /\[data-dsh-aqua\] body\[data-ds-dark-theme\] \[role='dialog'\]:not\(\[class\*='backdrop'\]\) nav button\[aria-current='true'\] \{([^}]*)\}/
      .exec(aquaCss)
    expect(dark).not.toBeNull()
    expect(dark![1]).toMatch(/color-mix\(in srgb/)
  })
})
