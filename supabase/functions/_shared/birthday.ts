// The birthday email: which birthdays fall on a day, and what the message looks like. No Deno parts, so it can be tested on its own.
export const SITE = 'https://sabahatfaizan.github.io/cznnect/'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type Day = { year: number; month: number; day: number }

/** Today's date as people there see it (a time zone name like "Asia/Dhaka"), not the server's date. */
export function todayIn(timeZone: string, now: Date = new Date()): Day {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: n('year'), month: n('month'), day: n('day') }
}

const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)

/** True when this birthday (YYYY-MM-DD) is today. A 29 February birthday is celebrated on 28 February in years without one. */
export function birthdayIsToday(birthday: string | null | undefined, today: Day): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday ?? '')
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  if (month === today.month && day === today.day) return true
  return month === 2 && day === 29 && !isLeap(today.year) && today.month === 2 && today.day === 28
}

export const BIRTHDAY_FOOTER = 'You get this birthday message because birthday emails are on. You can turn them off any time in Cznnect: Settings, then Emails.'

/** An optional present shown in its own card (set in the function's secrets). Nothing is invented: no gift set, no gift card. */
export type Gift = { title: string; detail?: string; code?: string }

/** The birthday email for one person: a dark navy and gold card, a warm headline, an optional gift card and a button. */
export function renderBirthday(name: string, gift?: Gift) {
  const first = name.trim() || 'friend'
  const subject = `Happy birthday, ${first}! 🎂`
  const headline = 'Your birthday brings us special joy'
  const lines = [
    'Like a family reunion where everyone finally shows up, today is better with you in it.',
    `From all of us at Cznnect, and from the whole family: happy birthday, ${first}!`,
  ]
  const navy = '#0a1a44'
  const gold = '#e7c35a'
  const giftHtml = gift?.title
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td align="center" style="background:#1a2447;border:1px solid ${gold};border-radius:18px;padding:22px 20px">
<p style="margin:0;font-size:30px;line-height:1">🎁</p>
<p style="margin:10px 0 0;font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${gold}">A birthday gift for you</p>
<p style="margin:10px 0 0;font-size:20px;line-height:1.3;font-weight:800;color:#ffffff">${esc(gift.title)}</p>
${gift.detail ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#c7d0e4">${esc(gift.detail)}</p>` : ''}
${gift.code ? `<p style="margin:14px 0 0;display:inline-block;border:1px dashed ${gold};border-radius:10px;padding:9px 16px;font-size:20px;font-weight:800;letter-spacing:.12em;color:${gold}">${esc(gift.code)}</p>` : ''}
</td></tr></table>`
    : ''
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject)}</title>
<style>@media (max-width:480px){ .pad{padding-left:22px!important;padding-right:22px!important} .name{font-size:36px!important} .head{font-size:26px!important} }</style></head>
<body style="margin:0;padding:0;background:#070b14;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Happy birthday from all of us at Cznnect.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b14"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td style="background:#0e1424;border:1px solid #1d2742;border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" align="center" style="background-color:${navy};background-image:linear-gradient(160deg,${navy} 0%,#2347a8 100%);padding:28px 32px 40px;border-radius:24px 24px 0 0">
<p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.32em;color:${gold}">CZNNECT</p>
<p style="margin:26px 0 0;font-size:30px;letter-spacing:.35em;line-height:1">🎈 ✨ 🎂 ✨ 🎈</p>
<p style="margin:22px 0 0;font-size:13px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:${gold}">Happy birthday</p>
<h1 class="name" style="margin:10px 0 0;font-size:42px;line-height:1.1;font-weight:800;color:#ffffff;letter-spacing:-.01em">${esc(first)}</h1>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" align="center" style="padding:34px 32px 8px">
<h2 class="head" style="margin:0 0 18px;font-size:28px;line-height:1.2;font-weight:800;color:#ffffff">${esc(headline)}</h2>
${lines.map((l) => `<p style="margin:0 0 14px;font-size:17px;line-height:1.6;color:#c9d2e6">${esc(l)}</p>`).join('\n')}
${giftHtml}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto 8px"><tr><td style="background:${gold};border-radius:14px"><a href="${SITE}" style="display:inline-block;padding:16px 36px;color:${navy};font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Open Cznnect</a></td></tr></table>
</td></tr>
<tr><td class="pad" align="center" style="padding:22px 32px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1d2742"><tr><td align="center" style="padding-top:22px;line-height:1.4">
<span style="font-size:15px;font-weight:700;color:#ffffff">Sabahat Faizan</span><br><span style="font-size:13px;color:#8e9ab3">Creator of Cznnect</span>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:20px 14px 0;font-size:12px;line-height:1.7;color:#8e9ab3">${esc(BIRTHDAY_FOOTER)}<br><a href="${SITE}" style="color:#c9d2e6;font-weight:600;text-decoration:underline">Open in the app</a></td></tr>
</table></td></tr></table></body></html>`
  const text = `${headline}\n\nHappy birthday, ${first}!\n\n${lines.join('\n\n')}${gift?.title ? `\n\nA birthday gift for you: ${gift.title}${gift.detail ? `. ${gift.detail}` : ''}${gift.code ? `\nCode: ${gift.code}` : ''}` : ''}\n\nOpen Cznnect: ${SITE}\n\nSabahat Faizan\nCreator of Cznnect\n\n${BIRTHDAY_FOOTER}`
  return { subject, html, text }
}
