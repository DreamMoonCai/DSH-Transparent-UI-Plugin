// @vitest-environment jsdom
/**
 * The "edited N files" card in the transcript.
 *
 * It is a self-contained card the conversation prints after a turn writes to
 * disk: a header row with an icon tile and the change counts, then one line per
 * file. The host paints the card with `--dsw-alias-bg-layer-1` (a flat `#FFFFFF`
 * in float mode) and its header with `--dsw-alias-card-fill` (`neutral-50`), so
 * it landed as a white slab on the conversation's glass.
 *
 * The card now takes the same material as the floating panes, and its two inner
 * surfaces are re-pointed in its own scope so the header band and the icon tile
 * read as one step deeper instead of as two more slabs.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const stamper = readFileSync(resolve(process.cwd(), 'src/client/seam-stamper.ts'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

const CARD = '[data-dsh-float] [data-changed-files]'
const DARK_CARD = '[data-dsh-float] body[data-ds-dark-theme] [data-changed-files]'

describe('the edited-files card is glass', () => {
  it('frosts what is behind it', () => {
    expect(blockOf(CARD)).toMatch(/backdrop-filter:\s*blur\(/)
  })

  it('catches the light on its top edge', () => {
    expect(blockOf(CARD)).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.5\)/)
  })

  it('keeps the card fill but clears the layer slab', () => {
    const body = blockOf(CARD)!
    // The card's own fill is `--dsw-alias-bg-layer-1`; left alone it is #FFFFFF.
    expect(body).toContain('--dsw-alias-bg-layer-1: transparent')
    expect(body).toMatch(/background: var\(--dsh-aqua-glass-card-light\)/)
  })

  it('re-points the header band and the icon tile', () => {
    // The header paints `--dsw-alias-card-fill` (neutral-50); the icon tile
    // paints `--dsw-alias-card-tile-fill`. Both are opaque in float mode.
    const body = blockOf(CARD)!
    expect(body).toContain('--dsw-alias-card-fill:')
    expect(body).toContain('--dsw-alias-card-fill-hover:')
    expect(body).toContain('--dsw-alias-card-tile-fill:')
    for (const line of body.split(';').filter(text => /--dsw-alias-card-(fill|tile-fill|fill-hover):/.test(text))) {
      expect(line).toMatch(/color-mix\(in srgb/)
    }
  })

  it('carries a dark recipe', () => {
    const dark = blockOf(DARK_CARD)
    expect(dark).not.toBeNull()
    expect(dark).toMatch(/var\(--dsh-aqua-glass-card-dark\)/)
    expect(dark).toContain('--dsw-alias-card-fill:')
  })
})

describe('the card answers the pointer', () => {
  it('is stamped as a spotlight pane', () => {
    // `data-changed-files` is the host's own attribute on the card root; the
    // module class is build-hashed.
    expect(stamper).toContain("[data-changed-files]")
    expect(stamper).toMatch(/attribute: 'data-dsh-aqua-spot', selector: '\[data-changed-files\]'/)
  })

  it('stamps only the first one', () => {
    // A transcript can hold several such cards; only the topmost is the live one
    // and a second stamp would double the glow overlay inside the same tree.
    expect(stamper).toMatch(/selector: '\[data-changed-files\]', first: true/)
  })
})

describe('the header keeps its own corner', () => {
  it('rounds the top of the header band', () => {
    // The card clips its contents, but the header's own hover fill would show a
    // square corner against the rounded card if it were left alone.
    const body = blockOf('[data-dsh-float] [data-changed-files] > :first-child')
    expect(body).not.toBeNull()
    expect(body).toMatch(/border-radius: 16px 16px 0 0/)
  })
})
