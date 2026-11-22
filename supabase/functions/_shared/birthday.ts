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

export const BIRTHDAY_FOOTER = 'You get this birthday message because birthday emails are on. Turn them off any time in Cznnect: Settings, then Emails.'

/** The birthday email for one person: a navy and gold card, a big name, a short warm message and a button. */
export function renderBirthday(name: string) {
  const first = name.trim() || 'friend'
  const subject = `Happy birthday, ${first}! 🎉`
  const message = 'From all of us at Cznnect, and from the whole family: happy birthday! We are so glad you are part of us. Today is all about you, so enjoy every minute of it.'
  const navy = '#0a1a44'
  const gold = '#e7c35a'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark){
  .bg{background:#070b14!important}
  .card{background:#111827!important;border-color:#233049!important}
  .txt{color:#d7dde7!important}
  .ink{color:#ffffff!important}
  .muted{color:#98a3b5!important}
  .rule{border-color:#233049!important}
  .btn{background:${gold}!important}
  .btn a{color:${navy}!important}
}
@media (max-width:480px){ .pad{padding-left:22px!important;padding-right:22px!important} .name{font-size:34px!important} }
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f1ede2;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Happy birthday from all of us at Cznnect.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f1ede2"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td class="card" style="background:#ffffff;border:1px solid #e4dcc6;border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" align="center" style="background-color:${navy};background-image:linear-gradient(160deg,${navy} 0%,#1e3a8a 100%);padding:30px 32px 40px;border-radius:24px 24px 0 0">
<p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.32em;color:${gold}">CZNNECT</p>
<p style="margin:26px 0 0;font-size:30px;letter-spacing:.35em;line-height:1">🎉 ✨ 🎂 ✨ 🎉</p>
<p style="margin:22px 0 0;font-size:13px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:${gold}">Happy birthday</p>
<h1 class="name" style="margin:10px 0 0;font-size:40px;line-height:1.1;font-weight:800;color:#ffffff;letter-spacing:-.01em">${esc(first)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 0"><tr><td style="width:64px;height:3px;background:${gold};border-radius:3px;font-size:0;line-height:0">&nbsp;</td></tr></table>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:30px 32px 6px">
<p class="txt" style="margin:0 0 16px;font-size:17px;line-height:1.65;color:#2b2f36">${esc(message)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr><td class="btn" style="background:${navy};border-radius:14px"><a href="${SITE}" style="display:inline-block;padding:15px 32px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">Open Cznnect &rarr;</a></td></tr></table>
</td></tr>
<tr><td class="pad" style="padding:20px 32px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rule" style="border-top:1px solid #eee7d4"><tr><td style="padding-top:20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:44px;height:44px;background:${navy};border-radius:50%;text-align:center;color:${gold};font-size:15px;font-weight:800;line-height:44px">SF</td>
<td style="padding-left:14px;line-height:1.4"><span class="ink" style="font-size:15px;font-weight:700;color:#111">Sabahat Faizan</span><br><span class="muted" style="font-size:13px;color:#6b7686">Creator of Cznnect</span></td>
</tr></table></td></tr></table>
</td></tr></table>
</td></tr>
<tr><td class="muted" style="padding:18px 14px 0;font-size:12px;line-height:1.6;color:#6b7686;text-align:center">${esc(BIRTHDAY_FOOTER)}</td></tr>
</table></td></tr></table></body></html>`
  const text = `Happy birthday, ${first}!\n\n${message}\n\nOpen Cznnect: ${SITE}\n\nSabahat Faizan\nCreator of Cznnect\n\n${BIRTHDAY_FOOTER}`
  return { subject, html, text }
}
