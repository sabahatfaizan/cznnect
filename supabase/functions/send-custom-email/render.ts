// What the email looks like and which kinds of email there are. Kept apart from index.ts so it has no Deno parts and can be
// tested on its own. Keep the ids in step with src/lib/emailCategories.ts ("direct" is only here and in the Admin screen:
// it is a personal message to one person, not something people can switch off).
export const CATEGORIES: Record<string, string> = {
  important: 'Important notices', updates: 'App updates', events: 'Events and gatherings', birthdays: 'Birthdays', plus: 'Cznnect+',
  direct: 'Direct message',
}
export const SITE = 'https://sabahatfaizan.github.io/cznnect/'

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The line at the bottom: why this person got the email.
function footerText(category: string): string {
  if (category === 'important') return 'This is an important notice about your Cznnect account.'
  if (category === 'direct') return 'This message was sent to you personally from Cznnect. You can reply to this email.'
  return `You get this because you are signed up for “${CATEGORIES[category]}” emails. Turn them off any time in Cznnect: Settings, then Emails.`
}

// Each kind of email has its own colour, so people can tell at a glance what it is.
export const ACCENTS: Record<string, [string, string]> = {
  important: ['#b91c1c', '#f87171'], updates: ['#1d4ed8', '#60a5fa'], events: ['#6d28d9', '#a78bfa'],
  birthdays: ['#be185d', '#f9a8d4'], plus: ['#a16207', '#fbbf24'], direct: ['#0f766e', '#5eead4'],
}

// Safe links: plain https:// addresses typed in the message become real links. The text is escaped first, so nothing typed can
// become HTML, and the quote marks are already gone from the address, so it cannot break out of the link.
function linkify(escaped: string, colour: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const tail = m.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = tail ? m.slice(0, -tail.length) : m
    return `<a href="${url}" style="color:${colour};font-weight:600;text-decoration:underline">${url}</a>${tail}`
  })
}

// Plain text in, a designed email out. Blank lines make paragraphs, lines that start with "- " make a tidy list, and web
// addresses become links. Tables and inline styles only (email apps ignore almost everything else), with a dark-mode version
// for the apps that support it.
export function render(category: string, subject: string, body: string, name: string) {
  const [c1, c2] = ACCENTS[category] ?? ['#111827', '#4b5563']
  const para = 'margin:0 0 16px;font-size:16px;line-height:1.65;color:#2b2f36'
  const blocks = body.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      const items = lines.map((l) => `<tr><td valign="top" style="padding:0 10px 8px 0;font-size:16px;line-height:1.55;color:${c1}">&#9679;</td><td class="txt" style="padding:0 0 8px;font-size:16px;line-height:1.55;color:#2b2f36">${linkify(esc(l.replace(/^\s*[-•*]\s+/, '')), c1)}</td></tr>`).join('')
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${items}</table>`
    }
    return `<p class="txt" style="${para}">${linkify(esc(block), c1).replace(/\n/g, '<br>')}</p>`
  }).join('')
  const footer = footerText(category)
  const label = category === 'direct' ? 'A message for you' : (CATEGORIES[category] ?? 'Cznnect')
  const hint = category === 'direct' ? 'Just reply to this email and it comes straight to me.' : 'Open the app any time to see what is new.'
  const gradient = `background-color:${c1};background-image:linear-gradient(135deg,${c1} 0%,${c2} 100%)`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark){
  .bg{background:#0b0f17!important}
  .card{background:#151b26!important;border-color:#263041!important}
  .txt{color:#d7dde7!important}
  .ink{color:#ffffff!important}
  .muted{color:#98a3b5!important}
  .rule{border-color:#263041!important}
  .btn{background:#ffffff!important}
  .btn a{color:#0b0f17!important}
  .avatar{background:#ffffff!important;color:#0b0f17!important}
}
@media (max-width:480px){ .pad{padding-left:20px!important;padding-right:20px!important} .title{font-size:24px!important} }
</style></head>
<body class="bg" style="margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(body.replace(/\s+/g, ' ').slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#eef1f5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
<tr><td class="card" style="background:#ffffff;border:1px solid #dde3ea;border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="${gradient};padding:26px 32px 34px;border-radius:24px 24px 0 0">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;background:rgba(255,255,255,.22);border-radius:11px;text-align:center;color:#ffffff;font-size:19px;font-weight:800;line-height:36px">C</td>
<td style="padding-left:11px;color:#ffffff;font-size:17px;font-weight:800;letter-spacing:.04em">Cznnect</td></tr></table></td>
<td align="right"><span style="display:inline-block;background:rgba(255,255,255,.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border-radius:999px">${esc(label)}</span></td>
</tr></table>
<h1 class="title" style="margin:26px 0 0;font-size:28px;line-height:1.2;font-weight:800;color:#ffffff;letter-spacing:-.01em">${esc(subject)}</h1>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:30px 32px 8px">
<p class="ink" style="margin:0 0 18px;font-size:18px;font-weight:700;color:#111">Hi ${esc(name)},</p>
${blocks}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px"><tr><td class="btn" style="background:#111111;border-radius:14px"><a href="${SITE}" style="display:inline-block;padding:15px 32px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">Open Cznnect &rarr;</a></td></tr></table>
<p class="muted" style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#6b7686">${esc(hint)}</p>
</td></tr>
<tr><td class="pad" style="padding:22px 32px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rule" style="border-top:1px solid #e6ebf1"><tr><td style="padding-top:20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td class="avatar" style="width:44px;height:44px;background:#111111;border-radius:50%;text-align:center;color:#ffffff;font-size:15px;font-weight:800;line-height:44px">SF</td>
<td style="padding-left:14px;line-height:1.4"><span class="ink" style="font-size:15px;font-weight:700;color:#111">Sabahat Faizan</span><br><span class="muted" style="font-size:13px;color:#6b7686">Creator of Cznnect</span></td>
</tr></table></td></tr></table>
</td></tr></table>
</td></tr>
<tr><td class="muted" style="padding:18px 14px 0;font-size:12px;line-height:1.6;color:#6b7686;text-align:center">${esc(footer)}<br><span style="color:#98a3b5">Cznnect &middot; keeping the family close</span></td></tr>
</table></td></tr></table></body></html>`
  const text = `Hi ${name},\n\n${body}\n\nOpen Cznnect: ${SITE}\n\nSabahat Faizan\nCreator of Cznnect\n\n${footer}`
  return { html, text }
}
