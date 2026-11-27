// @vitest-environment jsdom
/**
 * A press grows a pane past its own box, and a transform counts toward the
 * scrollable overflow region of every ancestor. An ancestor whose `overflow` is
 * `auto` therefore gains a scrollbar the moment the pane grows — a bar that
 * appears BESIDE the card rather than on it, and that goes away again when the
 * pointer leaves. A pane too small to overflow its ancestor shows nothing, which
 * is why the bar only turned up on some surfaces and only at some angles.
 *
 * The fix clips the scrolling ancestors for the duration of the press and puts
 * their `overflow` back afterwards, with the scroll offset they had: `clip`
 * resets it, and losing a reader's place would be worse than the bar.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')

/** Body of the named arrow function, comments stripped. */
function bodyOf(name: string): string {
  const bare = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const start = bare.indexOf(`const ${name} = `)
  expect(start, `missing: ${name}`).toBeGreaterThanOrEqual(0)
  const open = bare.indexOf('{', bare.indexOf('=>', start))
  let depth = 0
  for (let i = open; i < bare.length; i += 1) {
    if (bare[i] === '{') depth += 1
    else if (bare[i] === '}') {
      depth -= 1
      if (depth === 0) return bare.slice(open, i + 1)
    }
  }
  throw new Error(`unbalanced body: ${name}`)
}

describe('a press does not summon a scrollbar beside the card', () => {
  it('clips a scrolling ancestor instead of leaving it scrollable', () => {
    const body = bodyOf('clipScrollers')
    expect(body).toMatch(/node\.style\.setProperty\('overflow',\s*'clip'\)/)
  })

  it('only touches ancestors that actually scroll', () => {
    // An `overflow: hidden` or `visible` ancestor cannot grow a bar, so writing
    // to it would be a needless layout change on every press.
    const body = bodyOf('clipScrollers')
    expect(body).toMatch(/=== 'auto'/)
    expect(body).toMatch(/=== 'scroll'/)
    expect(body).toMatch(/overflowX/)
    expect(body).toMatch(/overflowY/)
  })

  it('puts the overflow and the scroll offset back', () => {
    const body = bodyOf('restoreScrollers')
    expect(body).toMatch(/removeProperty\('overflow'\)|setProperty\('overflow',\s*saved\.overflow/)
    expect(body).toMatch(/scrollTop\s*=\s*saved\.top/)
    expect(body).toMatch(/scrollLeft\s*=\s*saved\.left/)
  })

  it('runs the clip before the transform is written', () => {
    const press = bodyOf('paint')
    const clipAt = press.indexOf('clipScrollers(')
    const transformAt = press.indexOf('spot.style.transform =')
    expect(clipAt).toBeGreaterThanOrEqual(0)
    expect(transformAt).toBeGreaterThan(clipAt)
  })

  it('releases on the same settle timer as the guests', () => {
    const ease = bodyOf('easeBack')
    expect(ease).toMatch(/restoreFixedGuests\(spot\)/)
    expect(ease).toMatch(/restoreScrollers\(spot\)/)
  })

  it('flushes every clipped scroller on teardown', () => {
    // A clipped box left behind would be unscrollable for the rest of the
    // session — worse than the bar this fixes.
    const tail = source.slice(source.lastIndexOf('restoreFixedGuests()'))
    expect(tail).toMatch(/restoreScrollers\(\)/)
  })

  it('scopes the release to the pane that owns the scroller', () => {
    // A settle timer can fire while another pane is already pressed; a global
    // release would un-clip that pane's ancestors mid-rotation.
    const body = bodyOf('clipScrollers')
    expect(body).toMatch(/owner:\s*spot/)
    expect(bodyOf('restoreScrollers')).toMatch(/saved\.owner !== spot/)
  })
})
