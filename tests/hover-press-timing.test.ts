// @vitest-environment jsdom
/**
 * The hover press writes its transform inline (spotlight.ts), so the glide is
 * a CSS transition the controller has to outlive: `easeBack` first writes a
 * neutral transform, then drops the inline one after SETTLE_MS. If the
 * stylesheet ran longer than that window the cleanup would cut the flight
 * short and the pane would snap home.
 *
 * A 300ms symmetric ease replaces the original 100ms poke: the press-in and
 * the eased return both settle instead of flashing.
 *
 * The press also scales its pane by 1.01, and the composer slab is as wide as
 * the content column — its right edge paints ~5px past the transcript
 * scrollport. A transform counts toward the scrollable overflow region, so the
 * stock `overflow-y: auto` grew a horizontal scrollbar, the bar took ~5px off
 * clientHeight, and the whole column jumped up 5px in one frame. That is a
 * layout change, which no transition can interpolate. The scrollport now
 * clips the x axis outright.
 *
 * These assertions pin the timing contract and the scrollbar guard.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const aquaCss = readFileSync(resolve(process.cwd(), 'src/client/aqua.module.css'), 'utf8')
const controller = readFileSync(resolve(process.cwd(), 'src/client/spotlight.ts'), 'utf8')

/** Milliseconds of the `transition` on the press rule. */
function pressTransitionMs(): number {
  const start = aquaCss.indexOf('[data-dsh-float][data-dsh-aqua-press] [data-dsh-aqua-spot] {')
  if (start < 0) throw new Error('missing press transition rule')
  const open = aquaCss.indexOf('{', start)
  const close = aquaCss.indexOf('}', open)
  const declarations = aquaCss.slice(open + 1, close)
  const match = /transition:\s*transform\s+([\d.]+)s/.exec(declarations)
  if (match === null) throw new Error('missing transform transition duration')
  return Math.round(Number(match[1]) * 1000)
}

function settleMs(): number {
  const match = /const SETTLE_MS = (\d+)/.exec(controller)
  if (match === null) throw new Error('missing SETTLE_MS')
  return Number(match[1])
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const attribute of ['data-dsh-aqua', 'data-dsh-float']) {
    document.documentElement.removeAttribute(attribute)
  }
})

describe('hover press settles instead of poking', () => {
  it('runs the press over 300ms', () => {
    expect(pressTransitionMs()).toBe(300)
  })

  it('eases in and out rather than front-loading the motion', () => {
    expect(aquaCss).toContain('transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);')
  })

  it('drops the inline transform after the transition finishes', () => {
    expect(settleMs()).toBeGreaterThan(pressTransitionMs())
  })
})

describe('the press cannot summon a horizontal scrollbar', () => {
  it('clips the transcript scrollport on the x axis', () => {
    document.documentElement.setAttribute('data-dsh-aqua', '')
    document.documentElement.setAttribute('data-dsh-float', '')
    document.head.innerHTML = `<style>${aquaCss}</style>`
    document.body.innerHTML = '<div data-phase="active"><div data-conversation-scroll></div></div>'
    const port = document.querySelector('[data-conversation-scroll]') as HTMLElement
    // `clip`, not `hidden`: hidden still allows programmatic scrolling, so
    // focusing the textarea could shift the column sideways.
    expect(getComputedStyle(port).overflowX).toBe('clip')
  })

  it('leaves the vertical axis scrollable', () => {
    document.documentElement.setAttribute('data-dsh-aqua', '')
    document.documentElement.setAttribute('data-dsh-float', '')
    document.head.innerHTML = `<style>${aquaCss}</style>`
    document.body.innerHTML = '<div data-phase="active"><div data-conversation-scroll></div></div>'
    const port = document.querySelector('[data-conversation-scroll]') as HTMLElement
    expect(getComputedStyle(port).overflowY).not.toBe('clip')
  })

  it('also clips the nested scroller 0.2.3 introduced', () => {
    // 0.2.2 put the hook on the scroller itself; 0.2.3 wraps it and scrolls a
    // nested element whose CSS-module class ends in `_scroll`. Names differ
    // per release, so the class SUFFIX is the seam — a module hash prefix can
    // change, the suffix the author wrote cannot.
    expect(aquaCss).toContain("[class$='_scroll']")
  })
})
