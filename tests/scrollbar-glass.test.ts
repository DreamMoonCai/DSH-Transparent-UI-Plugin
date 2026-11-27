// @vitest-environment jsdom
/**
 * Scrollbars are a pane of the glass, not a control laid on top.
 *
 * The host already skins them: a 5px lane, a transparent track, a pill thumb
 * reading `--dsh-scrollbar-thumb`. This skin had pinned those four tokens to the
 * brand blue, so every bar read as a blue control floating over the glass. They
 * are neutral ink now, and the thumb carries the same specular sweep every other
 * surface here does.
 *
 * The lane width stays at the host's 5px on purpose: several surfaces derive
 * their padding from `--dsh-scrollbar-width` and from a reserved 2px border lane,
 * so widening the bar would shift the transcript and the composer off their grid.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const themeLayer = readFileSync(resolve(process.cwd(), 'src/client/theme-layer.ts'), 'utf8')

const flat = aquaCss.replace(/\s+/g, ' ')

function blockOf(needle: string): string | null {
  const at = flat.indexOf(needle)
  if (at < 0) return null
  const open = flat.indexOf('{', at)
  const close = flat.indexOf('}', open)
  return flat.slice(open + 1, close)
}

describe('the scrollbar tokens carry ink, never a hue', () => {
  const tokens = [
    '--dsw-alias-scrollbar-bg-l1',
    '--dsw-alias-scrollbar-bg-l2',
    '--dsw-alias-scrollbar-hover-l1',
    '--dsw-alias-scrollbar-hover-l2',
  ]

  it('drops the brand blue', () => {
    // `rgba(63, 118, 216, …)` is the business blue. On a bar it reads as a
    // control floating over the glass.
    for (const token of tokens) {
      const line = themeLayer.split('\n').find(text => text.includes(`'${token}'`))!
      expect(line).toBeDefined()
      expect(line).not.toMatch(/63, 118, 216/)
      expect(line).not.toMatch(/126, 164, 223/)
    }
  })

  it('keeps the four steps ordered', () => {
    // base < hover, and l1 < l2 within each pair, or the elevation stops
    // reading and a nested surface looks flatter than its parent.
    const alpha = (token: string): number => {
      const line = themeLayer.split('\n').find(text => text.includes(`'${token}'`))!
      return Number(/0\.(\d+)\)/.exec(line)![1]) / Math.pow(10, String(/0\.(\d+)\)/.exec(line)![1]).length)
    }
    expect(alpha('--dsw-alias-scrollbar-hover-l1')).toBeGreaterThan(alpha('--dsw-alias-scrollbar-bg-l1'))
    expect(alpha('--dsw-alias-scrollbar-bg-l2')).toBeGreaterThan(alpha('--dsw-alias-scrollbar-bg-l1'))
    expect(alpha('--dsw-alias-scrollbar-hover-l2')).toBeGreaterThan(alpha('--dsw-alias-scrollbar-hover-l1'))
  })
})

describe('the thumb catches the light', () => {
  it('sweeps a specular gradient down its length', () => {
    const thumb = blockOf('[data-dsh-aqua] ::-webkit-scrollbar-thumb')
    expect(thumb).not.toBeNull()
    expect(thumb).toMatch(/background-image:\s*linear-gradient\(\s*to bottom/)
    expect(thumb).toMatch(/rgba\(255, 255, 255/)
  })

  it('keeps the pill shape and the content-box clip', () => {
    const thumb = blockOf('[data-dsh-aqua] ::-webkit-scrollbar-thumb')
    expect(thumb).toMatch(/border-radius:\s*999px/)
    expect(thumb).toMatch(/background-clip:\s*content-box/)
  })

  it('deepens the ink on hover instead of changing hue', () => {
    const hover = blockOf('[data-dsh-aqua] ::-webkit-scrollbar-thumb:hover')
    expect(hover).not.toBeNull()
    expect(hover).toMatch(/var\(--dsh-scrollbar-thumb-hover\)/)
  })
})

describe('the track only appears under the pointer', () => {
  it('stays a lone pill at rest', () => {
    // No unconditional track rule: at rest the bar is one pill, which is what
    // makes it read as the glass being thicker there.
    expect(flat).not.toMatch(/\[data-dsh-aqua\] ::-webkit-scrollbar-track \{/)
  })

  it('reveals a groove on the hovered surface', () => {
    const track = blockOf('[data-dsh-aqua] *:hover::-webkit-scrollbar-track')
    expect(track).not.toBeNull()
    expect(track).toMatch(/color-mix\(in srgb/)
  })

  it('carries a dark groove', () => {
    expect(flat).toContain('[data-dsh-aqua] body[data-ds-dark-theme] *:hover::-webkit-scrollbar-track')
  })
})

describe('the lane width is left alone', () => {
  it('does not redefine --dsh-scrollbar-width', () => {
    // ConversationRoot and the composer seat derive their padding from it.
    expect(aquaCss).not.toMatch(/--dsh-scrollbar-width\s*:/)
  })

  it('does not restyle ::-webkit-scrollbar itself', () => {
    // Setting a width here would silently re-lay-out every scroller.
    expect(flat).not.toMatch(/\[data-dsh-aqua\] ::-webkit-scrollbar \{/)
  })
})
