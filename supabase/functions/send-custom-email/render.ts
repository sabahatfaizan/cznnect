// Shared, restrained email layout for owner-sent Cznnect emails.
// Keep category delivery rules in index.ts; this file only renders the message.
export const CATEGORIES: Record<string, string> = {
  important: 'Important notices',
  updates: 'App updates',
  events: 'Events and gatherings',
  birthdays: 'Birthdays',
  plus: 'Cznnect+',
  direct: 'Direct message',
}
export const SITE = 'https://sabahatfaizan.github.io/cznnect/'

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function footerText(category: string): string {
  if (category === 'important') {
    return 'You have received this mandatory service announcement because it contains important information about your Cznnect account.'
  }
  if (category === 'direct') {
    return 'You have received this email because someone at Cznnect sent you a personal message.'
  }
  return 'You have received this email because you have a Cznnect account and are subscribed to ' +
    (CATEGORIES[category] ?? 'Cznnect') + ' emails. You can manage your email preferences in Cznnect under Settings, then Emails.'
}

function formatAddress(address: string): string {
  return address.split('|').map((line) => esc(line.trim())).filter(Boolean).join('<br>')
}

// Plain text in, safe HTML out. Blank lines create paragraphs; dash-led blocks become lists.
export function render(category: string, subject: string, body: string, name: string, postalAddress = '') {
  const safeName = esc(name || 'there')
  const blocks = body.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (lines.length && lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
      const items = lines.map((line) =>
        '<tr><td valign="top" style="padding:0 9px 7px 0;font-size:15px;line-height:1.6;color:#3c4043">•</td>' +
        '<td style="padding:0 0 7px;font-size:15px;line-height:1.6;color:#3c4043">' +
        linkify(esc(line.replace(/^\s*[-•*]\s+/, ''))) + '</td></tr>',
      ).join('')
      return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">' + items + '</table>'
    }
    return '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c4043">' +
      linkify(esc(block)).replace(/\n/g, '<br>') + '</p>'
  }).join('')

  const reason = footerText(category)
  const address = formatAddress(postalAddress)
  const addressHtml = address ? '<br>' + address : ''
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(subject) + '</title>' +
    '<style>@media(max-width:480px){.pad{padding-left:20px!important;padding-right:20px!important}.title{font-size:22px!important}}</style></head>' +
    '<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' +
    esc(body.replace(/\s+/g, ' ').slice(0, 110)) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr>' +
    '<td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e5e8;border-radius:8px">' +
    '<tr><td class="pad" style="padding:28px 32px 0;font-size:16px;font-weight:bold;letter-spacing:.3px;color:#202124">Cznnect</td></tr>' +
    '<tr><td class="pad" style="padding:24px 32px 8px">' +
    '<h1 class="title" style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:normal;color:#202124">' + esc(subject) + '</h1>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c4043">Hi ' + safeName + ',</p>' +
    blocks + '</td></tr>' +
    '<tr><td class="pad" style="padding:16px 32px 32px">' +
    '<a href="' + SITE + '" style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:6px">Open Cznnect</a>' +
    '</td></tr>' +
    '<tr><td style="padding:0 32px"><div style="border-top:1px solid #e3e5e8"></div></td></tr>' +
    '<tr><td class="pad" style="padding:28px 32px 32px;text-align:center;font-size:12px;line-height:1.7;color:#80868b">' +
    '<div style="font-size:15px;font-weight:bold;letter-spacing:.3px;color:#80868b;margin-bottom:12px">Cznnect</div>' +
    '&copy; ' + new Date().getFullYear() + ' Cznnect' + addressHtml + '<br><br>' +
    esc(reason) + (category === 'direct' ? '<br>You can reply directly to this email.' : '') +
    '</td></tr></table></td></tr></table></body></html>'

  const textAddress = postalAddress
    ? '\\n' + postalAddress.split('|').map((line) => line.trim()).filter(Boolean).join('\\n')
    : ''
  const text = 'Hi ' + (name || 'there') + ',\\n\\n' + subject + '\\n\\n' + body +
    '\\n\\nOpen Cznnect: ' + SITE + '\\n\\n© ' + new Date().getFullYear() + ' Cznnect' +
    textAddress + '\\n\\n' + reason + (category === 'direct' ? '\\nYou can reply directly to this email.' : '')
  return { html, text }
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\\/\\/[^\\s<]+/g, (match) => {
    const tail = match.match(/[.,;:!?)\\]]+$/)?.[0] ?? ''
    const url = tail ? match.slice(0, -tail.length) : match
    return '<a href="' + url + '" style="color:#1a56db;text-decoration:underline">' + url + '</a>' + tail
  })
}
