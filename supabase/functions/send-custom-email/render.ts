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

// Each kind of email has a colour pair (strong, soft) and a small picture for the round badge at the top.
export const ACCENTS: Record<string, [string, string]> = {
  important: ['#b91c1c', '#fde8e8'], updates: ['#2f4fd8', '#e6ebfb'], events: ['#6d3fd6', '#eee8fb'],
  birthdays: ['#be185d', '#fce7f1'], plus: ['#a16207', '#fdf1d3'], direct: ['#0f766e', '#dff5f2'],
}
const BADGES: Record<string, string> = { important: '🔔', updates: '🚀', events: '🎉', birthdays: '🎂', plus: '⭐', direct: '✉️' }
const BLUE = '#2f4fd8'
export const LOGO_URL = SITE + 'icons/icon-192.png'

function linkify(escaped: string, colour: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const tail = m.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = tail ? m.slice(0, -tail.length) : m
    return `<a href="${url}" style="color:${colour};text-decoration:underline">${url}</a>${tail}`
  })
}

// The logo and the word CZNNECT, side by side. The picture is the app icon, hosted with the website.
const brand = (size: number, ink: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
<td style="padding-right:12px"><img src="${LOGO_URL}" width="${size}" height="${size}" alt="" style="display:block;border:0;border-radius:${Math.round(size * 0.26)}px"></td>
<td class="ink" style="font-size:${Math.round(size * 0.56)}px;font-weight:800;letter-spacing:3px;color:${ink};font-family:Arial,Helvetica,sans-serif">CZNNECT</td></tr></table>`

export function render(category: string, subject: string, body: string, name: string, postalAddress = '') {
  const [accent, soft] = ACCENTS[category] ?? ['#374151', '#eef0f3']
  const badge = BADGES[category] ?? '✉️'
  const para = 'margin:0 0 16px;font-size:15px;line-height:1.65;color:#3c4043'
  const blocks = body.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      const items = lines.map((l) => `<tr><td valign="top" style="padding:0 10px 8px 0;font-size:15px;line-height:1.6;font-weight:bold;color:${accent}">•</td><td class="txt" style="padding:0 0 8px;font-size:15px;line-height:1.6;color:#3c4043">${linkify(esc(l.replace(/^\s*[-•*]\s+/, '')), accent)}</td></tr>`).join('')
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${items}</table>`
    }
    return `<p class="txt" style="${para}">${linkify(esc(block), accent).replace(/\n/g, '<br>')}</p>`
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
  .bg{background:#101214!important}.card{background:#1a1c1f!important}.panel{background:#23262b!important}
  .band{background:#23262b!important}.txt{color:#d3d6db!important}.ink{color:#ffffff!important}.muted{color:#9aa0a6!important}
  .muted a{color:#9aa0a6!important}.rule{border-color:#2e3135!important}.badge{background:#2e3135!important;border-color:#1a1c1f!important}
}
@media (max-width:480px){.pad{padding-left:20px!important;padding-right:20px!important}.title{font-size:23px!important}}
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f3f4fa;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(body.replace(/\s+/g, ' ').slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f3f4fa"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#202124">
<tr><td class="card" style="background:#ffffff;border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td class="band" align="center" bgcolor="${soft}" style="padding:26px 24px 62px;background:${soft};background-image:linear-gradient(135deg,${soft} 0%,#ffffff 140%)">${brand(44, '#14202b')}</td></tr>
<tr><td align="center" style="padding:0 32px"><table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:-34px"><tr><td class="badge" align="center" width="68" height="68" bgcolor="${soft}" style="width:68px;height:68px;background:${soft};border:4px solid #ffffff;border-radius:50%;font-size:30px;line-height:68px;text-align:center">${badge}</td></tr></table></td></tr>
<tr><td class="pad" align="center" style="padding:18px 36px 4px">
<div style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${accent}">${esc(label)}</div>
<h1 class="title ink" style="margin:10px 0 14px;font-size:27px;line-height:1.25;font-weight:800;text-transform:uppercase;color:#14202b">${esc(subject)}</h1>
<p class="txt" style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#3c4043">Hi ${esc(name)},</p>
</td></tr>
<tr><td class="pad" style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="panel" bgcolor="${soft}" style="background:${soft};border-radius:18px;padding:24px 26px 10px">
${blocks}
<p class="txt" style="${para}">Regards,<br><strong class="ink" style="color:#14202b">Sabahat Faizan</strong><br><span class="muted" style="color:#80868b">Creator of Cznnect</span></p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 32px 34px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${accent}" style="background:${accent};border-radius:999px"><a href="${SITE}" style="display:inline-block;padding:15px 46px;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">Open Cznnect</a></td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 36px"><div class="rule" style="border-top:1px solid #e3e5e8"></div></td></tr>
<tr><td class="pad muted" align="center" style="padding:26px 36px 32px;text-align:center;font-size:12px;line-height:1.7;color:#80868b">
${brand(34, '#80868b')}
<div style="height:14px;line-height:14px">&nbsp;</div>
${esc(footer)}<br><br>${links}<br><br>
&copy; ${year} Cznnect<br>${address}
</td></tr></table></td></tr></table></td></tr></table></body></html>`
  const textLinks = [`Open Cznnect: ${SITE}`, ...(switchable ? [`Preferences / unsubscribe: ${PREFERENCES_URL} (Settings, then Emails)`] : []), `Privacy Policy: ${PRIVACY_URL}`].join('\n')
  const text = `Hi ${name},\n\n${subject}\n\n${body}\n\nRegards,\nSabahat Faizan\nCreator of Cznnect\n\n${footer}\n\n© ${year} Cznnect\n${textAddress}\n\n${textLinks}`
  return { html, text }
}
