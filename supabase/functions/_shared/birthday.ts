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
export const BIRTHDAY_POSTAL_ADDRESS = 'Chattogram 4217, Bangladesh | Brooklyn, NY 10018, USA'

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
  const navy = '#101a36'
  const gold = '#e7c35a'
  const giftHtml = gift?.title
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td align="center" style="background:#172344;border:1px solid ${gold};border-radius:16px;padding:22px 18px">
<p style="margin:0;font-size:30px;line-height:1">🎁</p>
<p style="margin:10px 0 0;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${gold}">A little something for you</p>
<p style="margin:9px 0 0;font-size:21px;line-height:1.3;font-weight:800;color:#ffffff">${esc(gift.title)}</p>
${gift.detail ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#c7d0e4">${esc(gift.detail)}</p>` : ''}
${gift.code ? `<p style="margin:14px 0 0;display:inline-block;border:1px dashed ${gold};border-radius:9px;padding:9px 16px;font-size:19px;font-weight:800;letter-spacing:.12em;color:${gold}">${esc(gift.code)}</p>` : ''}
</td></tr></table>`
    : ''
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject)}</title>
<style>@media (max-width:480px){.outer{padding:12px 6px!important}.pad{padding-left:22px!important;padding-right:22px!important}.hero-title{font-size:36px!important}.message-title{font-size:25px!important}}</style></head>
<body style="margin:0;padding:0;background:#080c16;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">A special birthday message from everyone at Cznnect.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080c16"><tr><td class="outer" align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center" style="padding:8px 0 20px"><span style="font-size:24px;font-weight:900;letter-spacing:-1px;color:#f5f7ff">C<span style="color:#78a5ff">◩</span>nnect</span></td></tr>
<tr><td style="background:#111a2d;border:1px solid #263452;border-radius:22px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:38px 24px 34px;background-color:#172b5b;background-image:linear-gradient(145deg,#172b5b 0%,#345bb2 58%,#172b5b 100%);border-radius:22px 22px 0 0">
<p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:#f3d77e">A day worth celebrating</p>
<p style="margin:20px 0 12px;font-size:42px;line-height:1.2">🎈 🎂 🎈</p>
<h1 class="hero-title" style="margin:0;font-size:44px;line-height:1.08;font-weight:900;letter-spacing:-1.5px;color:#ffffff">Happy birthday,<br>${esc(first)}!</h1>
<p style="margin:18px 0 0;font-size:15px;line-height:1.5;color:#dce6ff">Today, the spotlight is yours.</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" align="center" style="padding:34px 38px 8px">
<h2 class="message-title" style="margin:0 0 18px;font-size:28px;line-height:1.2;font-weight:850;color:#ffffff">Your birthday brings us special joy</h2>
<p style="margin:0 0 16px;font-size:17px;line-height:1.65;color:#d1d9e9">Like a family reunion where everyone finally shows up, today is better with you in it.</p>
<p style="margin:0;font-size:17px;line-height:1.65;color:#d1d9e9">From all of us at Cznnect, and from the whole family: happy birthday, <strong style="color:#ffffff">${esc(first)}</strong>!</p>
${giftHtml}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto 8px"><tr><td align="center" style="background:${gold};border-radius:12px"><a href="${SITE}" style="display:inline-block;padding:16px 34px;color:#101a36;font-size:15px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Open Cznnect</a></td></tr></table>
<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#8997b3">Your people. Your memories. Your day.</p>
</td></tr>
<tr><td class="pad" align="center" style="padding:26px 32px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #263452"><tr><td align="center" style="padding-top:22px;line-height:1.5"><span style="font-size:15px;font-weight:800;color:#ffffff">Sabahat Faizan</span><br><span style="font-size:13px;color:#8997b3">Creator of Cznnect</span></td></tr></table></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:20px 18px 0;font-size:12px;line-height:1.75;color:#8997b3">${esc(BIRTHDAY_FOOTER)}<br><br>&copy; ${new Date().getFullYear()} Cznnect<br>${esc(BIRTHDAY_POSTAL_ADDRESS).replace(/\|/g, '<br>')}<br><a href="${SITE}" style="color:#cbd6eb;font-weight:700;text-decoration:underline">Open in the app</a></td></tr>
</table></td></tr></table></body></html>`
  const text = `${headline}\n\nHappy birthday, ${first}!\n\n${lines.join('\n\n')}${gift?.title ? `\n\nA birthday gift for you: ${gift.title}${gift.detail ? `. ${gift.detail}` : ''}${gift.code ? `\nCode: ${gift.code}` : ''}` : ''}\n\nOpen Cznnect: ${SITE}\n\nSabahat Faizan\nCreator of Cznnect\n\n${BIRTHDAY_FOOTER}\n\n© ${new Date().getFullYear()} Cznnect\n${BIRTHDAY_POSTAL_ADDRESS.split('|').map((line) => line.trim()).join('\n')}`
  return { subject, html, text }
}
