// Professional, email-client-safe Cznnect template. Keep category ids aligned with src/lib/emailCategories.ts.
export const CATEGORIES: Record<string, string> = {
  important: 'Important notices', updates: 'App updates', events: 'Events and gatherings', birthdays: 'Birthdays', plus: 'Cznnect+',
  direct: 'Direct message',
}
export const SITE = 'https://sabahatfaizan.github.io/cznnect/'
export const ADDRESS_LINES = ['Chattogram 4217, Bangladesh', 'Brooklyn, NY 10018, USA']
export const PREFERENCES_URL = SITE
export const PRIVACY_URL = 'https://sabahatfaizan.github.io/cznnect/privacy.html'
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function footerText(category: string): string {
  if (category === 'important') return 'You have received this mandatory service announcement to update you about important changes to your Cznnect account.'
  if (category === 'direct') return 'You have received this email because someone at Cznnect sent you a personal message.'
  return 'You have received this email because you are subscribed to ' + (CATEGORIES[category] ?? 'Cznnect') + ' emails. Manage your preferences in Cznnect under Settings, then Emails.'
}

export const ACCENTS: Record<string, [string, string]> = {
  important: ['#b91c1c', '#f87171'], updates: ['#1d4ed8', '#60a5fa'], events: ['#6d28d9', '#a78bfa'],
  birthdays: ['#be185d', '#f9a8d4'], plus: ['#a16207', '#fbbf24'], direct: ['#0f766e', '#5eead4'],
}
const BLUE = '#1a56db'

function linkify(escaped: string, colour: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const tail = m.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = tail ? m.slice(0, -tail.length) : m
    return `<a href="${url}" style="color:${colour};text-decoration:underline">${url}</a>${tail}`
  })
}

export function render(category: string, subject: string, body: string, name: string, postalAddress = '') {
  const accent = (ACCENTS[category] ?? ['#111827', '#4b5563'])[0]
  const para = 'margin:0 0 16px;font-size:15px;line-height:1.65;color:#3c4043'
  const blocks = body.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      const items = lines.map((l) => `<tr><td valign="top" style="padding:0 10px 8px 0;font-size:15px;line-height:1.6;color:#3c4043">•</td><td class="txt" style="padding:0 0 8px;font-size:15px;line-height:1.6;color:#3c4043">${linkify(esc(l.replace(/^\s*[-•*]\s+/, '')), BLUE)}</td></tr>`).join('')
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${items}</table>`
    }
    return `<p class="txt" style="${para}">${linkify(esc(block), BLUE).replace(/\n/g, '<br>')}</p>`
  }).join('')
  const footer = footerText(category)
  const label = category === 'direct' ? 'Message' : (CATEGORIES[category] ?? 'Cznnect')
  const switchable = category !== 'important' && category !== 'direct'
  const year = new Date().getFullYear()
  const link = 'color:#5f6368;text-decoration:underline;font-weight:bold'
  const links = [
    `<a href="${SITE}" style="${link}">Open Cznnect</a>`,
    ...(switchable ? [`<a href="${PREFERENCES_URL}" style="${link}">Preferences</a>`, `<a href="${PREFERENCES_URL}" style="${link}">Unsubscribe</a>`] : []),
    `<a href="${PRIVACY_URL}" style="${link}">Privacy Policy</a>`,
  ].join(' &nbsp;&middot;&nbsp; ')
  const configuredAddress = postalAddress.split('|').map((line) => line.trim()).filter(Boolean)
  const addressLines = [...new Set([...configuredAddress, ...ADDRESS_LINES])]
  const address = addressLines.map(esc).join('<br>')
  const textAddress = addressLines.join('\n')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark){
  .bg{background:#101214!important}.card{background:#1a1c1f!important;border-color:#2e3135!important}
  .txt{color:#d3d6db!important}.ink{color:#ffffff!important}.muted{color:#9aa0a6!important}
  .muted a{color:#9aa0a6!important}.rule{border-color:#2e3135!important}
}
@media (max-width:480px){.pad{padding-left:20px!important;padding-right:20px!important}.title{font-size:22px!important}}
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f4f5f7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(body.replace(/\s+/g, ' ').slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:#202124">
<tr><td class="card" style="background:#ffffff;border:1px solid #e3e5e8;border-top:4px solid ${accent};border-radius:8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td class="pad" style="padding:26px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="ink" style="font-size:16px;font-weight:bold;letter-spacing:.3px;color:#202124">Cznnect</td>
<td class="muted" align="right" style="font-size:12px;color:#80868b">${esc(label)}</td>
</tr></table></td></tr>
<tr><td class="pad" style="padding:24px 32px 8px">
<h1 class="title ink" style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:normal;color:#202124">${esc(subject)}</h1>
<p class="txt" style="${para}">Hi ${esc(name)},</p>
${blocks}
<p class="txt" style="${para}">Regards,<br>Sabahat Faizan<br><span class="muted" style="color:#80868b">Creator of Cznnect</span></p>
</td></tr>
<tr><td class="pad" style="padding:8px 32px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${BLUE};border-radius:6px"><a href="${SITE}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Open Cznnect</a></td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 32px"><div class="rule" style="border-top:1px solid #e3e5e8"></div></td></tr>
<tr><td class="pad muted" style="padding:26px 32px 30px;text-align:center;font-size:12px;line-height:1.7;color:#80868b">
<div style="font-size:15px;font-weight:bold;letter-spacing:.3px;color:#80868b;margin-bottom:12px">Cznnect</div>
&copy; ${year} Cznnect<br>${address}<br><br>
${esc(footer)}<br><br>${links}
</td></tr></table></td></tr></table></td></tr></table></body></html>`
  const textLinks = [`Open Cznnect: ${SITE}`, ...(switchable ? [`Preferences / unsubscribe: ${PREFERENCES_URL} (Settings, then Emails)`] : []), `Privacy Policy: ${PRIVACY_URL}`].join('\n')
  const text = `Hi ${name},\n\n${subject}\n\n${body}\n\nRegards,\nSabahat Faizan\nCreator of Cznnect\n\n${footer}\n\n© ${year} Cznnect\n${textAddress}\n\n${textLinks}`
  return { html, text }
}
