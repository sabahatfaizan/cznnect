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
    expect(html.match(/•/g)).toHaveLength(2)
    expect(html).toContain('href="https://example.com/map"')
    expect(html).toContain('</a>.')
  })

  it('cannot break out of a link with quote marks', () => {
    const { html } = render('updates', 'Hi', 'https://a.com/x"onmouseover="y', 'Sam')
    expect(html).not.toContain('"onmouseover=')
  })

  it('has the button, footer reason, address and a plain-text version', () => {
    const { html, text } = render('direct', 'Hello', 'Hi there', 'Sam', '12 Example Street | London, UK')
    expect(html).toContain('Open Cznnect')
    expect(html).toContain('12 Example Street<br>London, UK')
    expect(html).toContain('You have received this email because someone at Cznnect sent you a personal message.')
    expect(text).toContain('Open Cznnect: https://sabahatfaizan.github.io/cznnect/')
  })
})


describe('email footer rules', () => {
  it('keeps mandatory notices free of unsubscribe language', () => {
    const { html } = render('important', 'Service notice', 'A change is coming.', 'Sam')
    expect(html).toContain('mandatory service announcement')
    expect(html).not.toContain('unsubscribe')
  })

  it('explains how subscribers manage category preferences', () => {
    const { html } = render('updates', 'An update', 'A new feature is here.', 'Sam')
    expect(html).toContain('subscribed to App updates emails')
    expect(html).toContain('Settings, then Emails')
  })
})
