import { describe, expect, it } from 'vitest'
import { render } from '../../supabase/functions/send-custom-email/render'

describe('custom email template', () => {
  it('never lets typed text become HTML', () => {
    const { html } = render('updates', '<script>x</script>', 'a <b>bold</b> "move"', '<i>Ayesha</i>')
    expect(html).not.toContain('<script>x')
    expect(html).not.toContain('<b>bold</b>')
    expect(html).not.toContain('<i>Ayesha</i>')
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('turns dash lines into a list and web addresses into links', () => {
    const { html } = render('events', 'Picnic', '- Bring food\n- Bring chairs\n\nMap: https://example.com/map.', 'Sam')
    expect(html.match(/&#9679;/g)).toHaveLength(2)
    expect(html).toContain('href="https://example.com/map"')
    expect(html).toContain('</a>.')
  })

  it('cannot break out of a link with quote marks', () => {
    const { html } = render('updates', 'Hi', 'https://a.com/x"onmouseover="y', 'Sam')
    expect(html).not.toContain('"onmouseover=')
  })

  it('has the button, the signature and a plain-text version', () => {
    const { html, text } = render('direct', 'Hello', 'Hi there', 'Sam')
    expect(html).toContain('Open Cznnect')
    expect(html).toContain('Sabahat Faizan')
    expect(text).toContain('Open Cznnect: https://sabahatfaizan.github.io/cznnect/')
  })
})
