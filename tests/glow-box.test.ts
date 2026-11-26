// @vitest-environment jsdom
/**
 * The glow overlay is `position: absolute; inset: 0`, so it resolves against the
 * pane's PADDING box. `glassLocalRect` is what writes its width and height, and
 * the two obvious measurements are both wrong:
 *
 * - `clientWidth`/`clientHeight` exclude the border, so the overlay stopped at
 *   the border's inner edge and a bare column stayed uncovered;
 * - they also exclude a `scrollbar-gutter: stable` lane, so on the environment
 *   card — which reserves one for its sections — the overlay stopped a further
 *   6px short down the right side. That is the "right column the glow never
 *   reaches" bug.
 *
 * The padding box is the border box minus the border widths: it includes the
 * scrollbar lane, and it is exactly what `inset: 0` resolves against.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { glassLocalRect } from '../src/client/spot-core'

const realGetComputedStyle = window.getComputedStyle

interface BoxModel {
  offsetWidth: number
  offsetHeight: number
  clientWidth: number
  clientHeight: number
  borders: [number, number, number, number]
}

/** An element that reports the given box model to `glassLocalRect`. */
function pane(box: BoxModel): HTMLElement {
  const element = document.createElement('aside')
  document.body.append(element)
  Object.defineProperty(element, 'offsetWidth', { value: box.offsetWidth, configurable: true })
  Object.defineProperty(element, 'offsetHeight', { value: box.offsetHeight, configurable: true })
  Object.defineProperty(element, 'clientWidth', { value: box.clientWidth, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: box.clientHeight, configurable: true })
  const [top, right, bottom, left] = box.borders
  window.getComputedStyle = (() => ({
    borderTopWidth: `${top}px`,
    borderRightWidth: `${right}px`,
    borderBottomWidth: `${bottom}px`,
    borderLeftWidth: `${left}px`,
  })) as unknown as typeof window.getComputedStyle
  return element
}

afterEach(() => {
  window.getComputedStyle = realGetComputedStyle
  document.body.innerHTML = ''
})

describe('the glow overlay fills the pane', () => {
  it('returns the padding box, not the client box', () => {
    // A pane with a 1px ring on the left/top and a 2px scrollbar lane on the
    // right. `clientWidth` here stands for the gutter-excluded width the old
    // code returned; the padding box is the full inner area.
    const card = pane({
      offsetWidth: 300,
      offsetHeight: 200,
      clientWidth: 290, // what `clientWidth` reports: borders AND gutter gone
      clientHeight: 190,
      borders: [1, 2, 1, 1],
    })
    const rect = glassLocalRect(card)
    expect(rect.left).toBe(0)
    expect(rect.top).toBe(0)
    expect(rect.width).toBe(297)
    expect(rect.height).toBe(198)
  })

  it('covers the scrollbar lane the host reserved', () => {
    // 6px is the host's `--dsh-scrollbar-width`; the overlay must span it or the
    // right column behind the scrollbar stays bare.
    const card = pane({
      offsetWidth: 360,
      offsetHeight: 400,
      clientWidth: 348, // 6px lane on each side gone from `clientWidth`
      clientHeight: 388,
      borders: [0, 0, 0, 0],
    })
    const rect = glassLocalRect(card)
    expect(rect.width).toBe(360)
    expect(rect.height).toBe(400)
  })

  it('is unaffected by a borderless pane', () => {
    const card = pane({
      offsetWidth: 120,
      offsetHeight: 80,
      clientWidth: 120,
      clientHeight: 80,
      borders: [0, 0, 0, 0],
    })
    const rect = glassLocalRect(card)
    expect(rect).toMatchObject({ left: 0, top: 0, width: 120, height: 80 })
  })
})
