import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../src/client/native-tip.ts'), 'utf8')

describe('the native tip module', () => {
  it('moves the title off the attribute', () => {
    // The platform draws `title` itself, outside the page's paint. Keeping it
    // and adding a chip would show two tips at once.
    expect(source).toContain("el.removeAttribute('title')")
    expect(source).toContain('TIP_LABEL_ATTR')
  })

  it('remembers the text so it can be restored', () => {
    expect(source).toContain("el.setAttribute(TIP_LABEL_ATTR, text)")
    expect(source).toContain("el.setAttribute('title', text)")
  })

  it('skips content fallbacks', () => {
    // A title on a link, an image or a container of prose is a fallback for
    // content the author could not shorten; replacing it with a chip would lose
    // text. An icon INSIDE a button is a child though, so the test cannot be
    // "has no children".
    expect(source).toContain("const SKIP_TAGS = new Set(['A', 'IMG', 'SVG'")
    expect(source).toContain('CONTENT_TAGS')
    expect(source).toContain('el.querySelector(CONTENT_TAGS)')
    expect(source).toContain('MAX_TIP_LENGTH')
  })

  it('still takes the label off an icon button', () => {
    // The copy button's own child is an <svg>, which is the normal shape of a
    // control, not a reason to skip it.
    expect(source).not.toContain('el.children.length > 0')
  })

  it('draws one element, reused', () => {
    expect(source).toContain('host.isConnected')
    expect(source).toMatch(/host = document\.createElement\('div'\)/)
  })

  it('clamps the tip into the viewport', () => {
    expect(source).toContain('window.innerWidth - box.width - margin')
    expect(source).toContain('above >= margin ? above : rect.bottom + margin')
  })

  it('hides on press and on scroll', () => {
    // A fixed tip left behind after the anchor moves would float over
    // unrelated content.
    expect(source).toContain("document.addEventListener('pointerdown', onDismiss, true)")
    expect(source).toContain("window.addEventListener('scroll', onDismiss, true)")
  })

  it('disposes into the stock browser tip', () => {
    // Off has to mean the stock UI exactly, so every listener comes off and
    // every moved attribute goes back.
    for (const event of ['pointerover', 'pointerout', 'focusin', 'focusout']) {
      expect(source).toContain(`document.removeEventListener('${event}', on`)
    }
    expect(source).toContain('window.removeEventListener(\'scroll\', onDismiss, true)')
    expect(source).toContain('host?.remove()')
  })

  it('re-scans after React remounts', () => {
    expect(source).toContain('new MutationObserver')
    expect(source).toContain('observer.disconnect()')
  })
})
