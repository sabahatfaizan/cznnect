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

// Plain text in, a simple branded email out. Blank lines make paragraphs; nothing the owner types is treated as HTML.
export function render(category: string, subject: string, body: string, name: string) {
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const footer = footerText(category)
  const html = `<!doctype html><html><body style="margin:0;background:#f1f4f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#172333">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:.12em;color:#657287">CZNNECT</p>
<div style="background:#ffffff;border:1px solid #d9e0ea;border-radius:16px;padding:24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(subject)}</h1>
<p style="margin:0 0 16px;font-size:16px">Hi ${esc(name)},</p>
${paras}
<p style="margin:24px 0 0"><a href="${SITE}" style="display:inline-block;background:#2457d6;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Open Cznnect</a></p>
</div>
<p style="margin:16px 4px 0;font-size:12px;line-height:1.5;color:#657287">${esc(footer)}</p>
</div></body></html>`
  const text = `Hi ${name},\n\n${body}\n\nOpen Cznnect: ${SITE}\n\n${footer}`
  return { html, text }
}
