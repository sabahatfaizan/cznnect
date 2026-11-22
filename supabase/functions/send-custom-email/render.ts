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

// Plain text in, a branded email out: the same look as the sign-up and password emails (Supabase > Authentication > Emails),
// with the Cznnect wordmark, a clear card, a big button and a signature. Blank lines make paragraphs; nothing the owner
// types is treated as HTML. Tables and inline styles only, because email apps ignore almost everything else.
export function render(category: string, subject: string, body: string, name: string) {
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2f36">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const footer = footerText(category)
  const label = category === 'direct' ? 'A message for you' : (CATEGORIES[category] ?? 'Cznnect')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(body.replace(/\s+/g, ' ').slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
<tr><td style="padding:0 6px 14px"><span style="display:inline-block;background:#111;color:#fff;font-size:15px;font-weight:800;letter-spacing:.14em;padding:8px 14px;border-radius:10px">CZNNECT</span></td></tr>
<tr><td style="background:#ffffff;border:1px solid #dde3ea;border-radius:20px;padding:30px 26px">
<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7686">${esc(label)}</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:800;color:#111">${esc(subject)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2f36">Hi ${esc(name)},</p>
${paras}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="background:#111;border-radius:12px"><a href="${SITE}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">Open Cznnect</a></td></tr></table>
<p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e6ebf1;font-size:15px;line-height:1.5"><strong>Sabahat Faizan</strong><br><span style="color:#6b7686;font-size:13px">Creator of Cznnect</span></p>
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.55;color:#6b7686;text-align:center">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`
  const text = `Hi ${name},\n\n${body}\n\nOpen Cznnect: ${SITE}\n\nSabahat Faizan\nCreator of Cznnect\n\n${footer}`
  return { html, text }
}
