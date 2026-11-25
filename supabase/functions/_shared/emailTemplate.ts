// Cznnect email template system. One layout, one footer, many kinds of email.
// Pure TypeScript (no Deno APIs) so it can be tested anywhere. Sending lives in mailer.ts; this file only builds subject, html and text.
//
//   renderEmail('password_reset', { name, link })   -> { subject, html, text }   (built-in kinds, see KINDS)
//   renderCustom(category, subject, body, name)     -> { html, text }            (owner-written emails from send-custom-email)

export const SITE = 'https://sabahatfaizan.github.io/cznnect/'
export const LOGO_URL = SITE + 'icons/icon-192.png'
export const PRIVACY_URL = SITE + 'privacy.html'
export const PREFERENCES_URL = SITE

// The only two postal addresses used in any footer. Do not add others.
export const POSTAL = [
  { place: 'Chattogram', name: 'Sabahat Faizan', line: '4217, Chattogram, Bangladesh.' },
  { place: 'United States', name: 'Sabahat Faizan', line: 'Brooklyn, NY 10018, USA.' },
]

// Categories the owner can send from the app (same ids as src/lib/emailCategories.ts and the email_optouts table).
export const CATEGORIES: Record<string, string> = {
  important: 'Important notices', updates: 'App updates', events: 'Events and gatherings', birthdays: 'Birthdays', plus: 'Cznnect+',
  direct: 'Direct message',
}

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const okUrl = (u: unknown): string => (typeof u === 'string' && /^(https?:\/\/[^\s"'<>]+|\{\{[^"'<>]*\}\})$/.test(u.trim()) ? u.trim() : '')

const NAVY = '#14285c'
const RED = '#9a2b2b'

export type Vars = {
  name?: string; actor?: string; family?: string; plan?: string; title?: string; subject?: string; message?: string
  date?: string; when?: string; place?: string; device?: string; link?: string
}
type Group = 'account' | 'activity' | 'optional' | 'service'
type Kind = {
  group: Group; badge: string; label: string; cat?: string; accent?: string
  subject: (v: Vars) => string; title: (v: Vars) => string; lines: (v: Vars) => string[]; cta?: (v: Vars) => [string, string]
}
const nm = (v: Vars) => (v.name ?? '').trim() || 'there'
const who = (v: Vars) => (v.actor ?? '').trim() || 'A family member'
const fam = (v: Vars) => (v.family ?? '').trim() || 'your family'
const plan = (v: Vars) => (v.plan ?? '').trim() || 'your plan'
const msg = (v: Vars, fallback: string) => (v.message ?? '').trim() || fallback
const open = (v: Vars, label = 'Open Cznnect'): [string, string] => [label, okUrl(v.link) || SITE]

export const KINDS: Record<string, Kind> = {
  // Account and authentication
  welcome: { group: 'account', badge: '👋', label: 'Welcome', subject: (v) => `Welcome to Cznnect, ${nm(v)}`, title: () => 'Welcome to the family',
    lines: () => ['Your Cznnect account is ready. It is a private space for your family: the tree, the places you have been, the plans you are making and the memories worth keeping.', 'A good first step is to join your family space or add the relatives you would like to see here.'], cta: (v) => open(v) },
  verify: { group: 'account', badge: '✉️', label: 'Verify email', subject: () => 'Confirm your email address for Cznnect', title: () => 'Confirm your email',
    lines: () => ['Please confirm this email address to finish setting up your Cznnect account.', 'If you did not create an account, you can safely ignore this message.'], cta: (v) => open(v, 'Confirm email') },
  password_reset: { group: 'account', badge: '🔑', label: 'Password reset', subject: () => 'Reset your Cznnect password', title: () => 'Reset your password',
    lines: () => ['We received a request to reset the password for your Cznnect account. Use the button below to choose a new one.', 'If you did not ask for this, you can ignore this email and your password will stay as it is.'], cta: (v) => open(v, 'Choose a new password') },
  password_changed: { group: 'account', badge: '🔒', label: 'Password changed', subject: () => 'Your Cznnect password was changed', title: () => 'Your password was changed',
    lines: () => ['The password for your Cznnect account has just been changed.', 'If this was you, there is nothing more to do. If it was not, reset your password straight away and sign out of any device you do not recognise.'], cta: (v) => open(v, 'Secure my account') },
  login_alert: { group: 'account', badge: '🛡️', label: 'Security', subject: () => 'New sign-in to your Cznnect account', title: () => 'New sign-in detected',
    lines: (v) => [`We noticed a new sign-in to your account${v.device ? ` from ${v.device}` : ''}${v.when ? ` on ${v.when}` : ''}.`, 'If this was you, no action is needed. If not, change your password now so that only you can get in.'], cta: (v) => open(v, 'Review my account') },
  account_notice: { group: 'account', badge: '👤', label: 'Account', subject: (v) => v.subject || 'An update about your Cznnect account', title: (v) => v.title || 'Account update',
    lines: (v) => [msg(v, 'There is an update about your Cznnect account.')], cta: (v) => open(v) },

  // Birthdays and personal notes
  birthday: { group: 'optional', cat: 'birthdays', badge: '', label: 'Birthday', subject: (v) => `Happy birthday, ${nm(v)}`, title: (v) => `Happy birthday, ${nm(v)}`,
    lines: (v) => ['Like a family reunion where everyone finally shows up, today is better with you in it.', `From all of us at Cznnect, and from the whole family: happy birthday, ${nm(v)}.`], cta: (v) => open(v) },
  birthday_reminder: { group: 'optional', cat: 'birthdays', badge: '', label: 'Birthday reminder', subject: (v) => `${who(v)}'s birthday is ${v.when || 'coming up'}`, title: (v) => `${who(v)}'s birthday is ${v.when || 'coming up'}`,
    lines: (v) => [`A short message now is a thoughtful way to mark ${who(v)}'s birthday.`, 'You can find every upcoming birthday in the Birthdays section of the app.'], cta: (v) => open(v, 'Open Birthdays') },
  personal: { group: 'service', badge: '💌', label: 'A note for you', subject: (v) => v.subject || `A note for you, ${nm(v)}`, title: (v) => v.title || 'A note for you',
    lines: (v) => [msg(v, 'We have a personal note waiting for you in Cznnect.')], cta: (v) => open(v) },
  occasion: { group: 'optional', cat: 'events', badge: '🗓️', label: 'Family occasion', subject: (v) => `${v.title || 'A family occasion'} is coming up`, title: (v) => v.title || 'A family occasion',
    lines: (v) => [`${v.title || 'The occasion'} is ${v.date ? `on ${v.date}` : 'coming up'}${v.place ? ` at ${v.place}` : ''}.`, msg(v, 'Open the app for the details and to let everyone know you are coming.')], cta: (v) => open(v, 'View details') },

  // Family and social
  family_invite: { group: 'activity', badge: '🏡', label: 'Family invitation', subject: (v) => `${who(v)} invited you to join ${fam(v)} on Cznnect`, title: () => 'You are invited',
    lines: (v) => [`${who(v)} has invited you to join the ${fam(v)} family space on Cznnect.`, 'Accept the invitation to see the family tree, upcoming plans and shared memories.'], cta: (v) => open(v, 'View invitation') },
  family_member: { group: 'activity', badge: '🤝', label: 'New family member', subject: (v) => `${who(v)} has joined ${fam(v)}`, title: (v) => `${who(v)} has joined`,
    lines: (v) => [`${who(v)} is now part of the ${fam(v)} family space.`, 'You will find them in the family tree, and it is a good moment to say hello.'], cta: (v) => open(v, 'See the family') },
  family_update: { group: 'activity', badge: '🌳', label: 'Family update', subject: (v) => v.subject || `What is new in ${fam(v)}`, title: (v) => v.title || 'Family update',
    lines: (v) => [msg(v, `There is something new in the ${fam(v)} family space.`)], cta: (v) => open(v) },
  cousin_note: { group: 'activity', badge: '👋', label: 'From a cousin', subject: (v) => `${who(v)} sent you a note on Cznnect`, title: (v) => `A note from ${who(v)}`,
    lines: (v) => [`${who(v)} wanted to get in touch with you.`, ...(v.message ? [v.message] : [])], cta: (v) => open(v, 'Reply in Cznnect') },
  direct_message: { group: 'activity', badge: '💬', label: 'Message', subject: (v) => `New message from ${who(v)}`, title: (v) => `${who(v)} sent you a message`,
    lines: (v) => [msg(v, 'Open Cznnect to read it.')], cta: (v) => open(v, 'Read message') },

  // Plans and activities
  plan_invite: { group: 'optional', cat: 'events', badge: '🧭', label: 'Plan invitation', subject: (v) => `${who(v)} invited you to ${plan(v)}`, title: (v) => `Join ${plan(v)}`,
    lines: (v) => [`${who(v)} would like you to join ${plan(v)}${v.date ? `, planned for ${v.date}` : ''}.`, 'Open the plan to see the details and tell everyone whether you can make it.'], cta: (v) => open(v, 'View plan') },
  plan_update: { group: 'optional', cat: 'events', badge: '📝', label: 'Plan update', subject: (v) => `An update to ${plan(v)}`, title: (v) => `${plan(v)} has changed`,
    lines: (v) => [msg(v, `The details of ${plan(v)} have been updated.`), 'Please review the latest version so you are working from the same plan as everyone else.'], cta: (v) => open(v, 'View plan') },
  plan_reminder: { group: 'optional', cat: 'events', badge: '⏰', label: 'Plan reminder', subject: (v) => `Reminder: ${plan(v)}${v.when ? `, ${v.when}` : ''}`, title: (v) => `${plan(v)} is coming up`,
    lines: (v) => [`${plan(v)} is ${v.date || v.when ? `on ${v.date || v.when}` : 'coming up'}${v.place ? ` at ${v.place}` : ''}.`, 'Open the plan for the latest details.'], cta: (v) => open(v, 'View plan') },
  activity: { group: 'activity', badge: '📍', label: 'Activity', subject: (v) => `New activity on ${plan(v)}`, title: () => 'New activity',
    lines: (v) => [msg(v, `${who(v)} added something new to ${plan(v)}.`)], cta: (v) => open(v, 'See what is new') },
  bucket_update: { group: 'activity', badge: '✅', label: 'Bucket list', subject: (v) => `Bucket list update: ${v.title || plan(v)}`, title: (v) => v.title || 'Bucket list update',
    lines: (v) => [msg(v, `${who(v)} made progress on a bucket list item you share.`)], cta: (v) => open(v, 'Open bucket list') },

  // Application notifications
  announcement: { group: 'optional', cat: 'updates', badge: '📣', label: 'Announcement', subject: (v) => v.subject || 'An announcement from Cznnect', title: (v) => v.title || 'An announcement',
    lines: (v) => [msg(v, 'We have news to share about Cznnect.')], cta: (v) => open(v) },
  feature: { group: 'optional', cat: 'updates', badge: '✨', label: 'New feature', subject: (v) => v.subject || 'New in Cznnect', title: (v) => v.title || 'Something new in Cznnect',
    lines: (v) => [msg(v, 'We have added something new to Cznnect.')], cta: (v) => open(v, 'Try it now') },
  important: { group: 'service', cat: 'important', badge: '🔔', label: 'Important notice', subject: (v) => v.subject || 'Important information about Cznnect', title: (v) => v.title || 'Important notice',
    lines: (v) => [msg(v, 'There is an important update about your Cznnect account.')], cta: (v) => open(v) },
  maintenance: { group: 'service', badge: '🛠️', label: 'Maintenance', subject: () => 'Scheduled maintenance on Cznnect', title: () => 'Scheduled maintenance',
    lines: (v) => [`Cznnect will be briefly unavailable${v.when ? ` on ${v.when}` : ''} while we carry out maintenance.`, msg(v, 'Everything will return to normal as soon as the work is complete.')] },
  security_alert: { group: 'service', badge: '🚨', label: 'Security alert', accent: RED, subject: () => 'Security alert for your Cznnect account', title: () => 'Security alert',
    lines: (v) => [msg(v, 'We detected unusual activity on your Cznnect account.'), 'If this was not you, change your password now and sign out of any device you do not recognise.'], cta: (v) => open(v, 'Secure my account') },
  support_reply: { group: 'service', badge: '🙋', label: 'Support', subject: (v) => (v.subject ? `Re: ${v.subject}` : 'A reply from Cznnect support'), title: () => 'A reply from our team',
    lines: (v) => ['Thank you for getting in touch with Cznnect.', msg(v, 'We have looked into your message and will follow up shortly.')], cta: (v) => open(v) },
  plus: { group: 'optional', cat: 'plus', badge: '⭐', label: 'Cznnect+', subject: (v) => v.subject || 'Cznnect+ for you', title: (v) => v.title || 'Cznnect+',
    lines: (v) => [msg(v, 'There is something new for Cznnect+ members.')], cta: (v) => open(v) },
}

const BADGES: Record<string, string> = { important: '🔔', updates: '🚀', events: '🎉', birthdays: '', plus: '⭐', direct: '✉️' }

function footerText(group: Group, cat?: string): string {
  if (cat === 'important') return 'You have received this mandatory service announcement to update you about important changes to your Cznnect account.'
  if (cat === 'direct') return 'You have received this email because someone at Cznnect sent you a personal message.'
  if (group === 'optional' && cat) return `You have received this email because you are subscribed to ${CATEGORIES[cat] ?? 'Cznnect'} emails. Manage your preferences in Cznnect under Settings, then Emails.`
  if (group === 'activity') return 'You have received this email because of activity in your Cznnect family space.'
  if (group === 'account') return 'You have received this email because it relates to your Cznnect account.'
  return 'You have received this email as a service message from Cznnect.'
}

function linkify(escaped: string, colour: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const tail = m.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = tail ? m.slice(0, -tail.length) : m
    return `<a href="${url}" style="color:${colour};text-decoration:underline">${url}</a>${tail}`
  })
}

const PARA = 'margin:0 0 16px;font-size:15px;line-height:1.65;color:#3c4043'

/** Paragraphs and "- " bullet lists, as written by a person or by the KINDS table. */
function blocks(text: string, accent: string): string {
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      const items = lines.map((l) => `<tr><td class="lbl" valign="top" style="padding:0 10px 8px 0;font-size:15px;line-height:1.6;font-weight:bold;color:${accent}">&bull;</td><td class="txt" style="padding:0 0 8px;font-size:15px;line-height:1.6;color:#3c4043">${linkify(esc(l.replace(/^\s*[-•*]\s+/, '')), accent)}</td></tr>`).join('')
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${items}</table>`
    }
    return `<p class="txt" style="${PARA}">${linkify(esc(block), accent).replace(/\n/g, '<br>')}</p>`
  }).join('')
}

// The logo (hosted app icon, so it works in mail clients) next to the word CZNNECT. If images are blocked, the word still shows.
const brand = (size: number, ink: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
<td style="padding-right:12px"><img src="${LOGO_URL}" width="${size}" height="${size}" alt="" style="display:block;border:0;border-radius:${Math.round(size * 0.26)}px"></td>
<td class="ink" style="font-size:${Math.round(size * 0.56)}px;font-weight:800;letter-spacing:3px;color:${ink};font-family:Arial,Helvetica,sans-serif">CZNNECT</td></tr></table>`

const postalHtml = () => `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${POSTAL.map((a) =>
  `<td class="col muted" valign="top" align="center" style="padding:6px 16px;font-size:12px;line-height:1.6;color:#80868b"><strong class="ink" style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5f6368">${esc(a.place)}</strong><br>${esc(a.name)}<br>${esc(a.line)}</td>`).join('')}</tr></table>`
const postalText = () => POSTAL.map((a) => `${a.place}\n${a.name}\n${a.line}`).join('\n\n')

// Optional pictures and a gift card, shared by any email that wants them (birthdays use both).
export type Media = { imageUrl?: string; videoUrl?: string; posterUrl?: string; caption?: string; imageAlt?: string; videoAlt?: string }
const httpsOnly = (u?: string) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '')

export function mediaHtml(media?: Media): string {
  if (!media) return ''
  const image = httpsOnly(media.imageUrl), video = httpsOnly(media.videoUrl), poster = httpsOnly(media.posterUrl)
  const caption = (media.caption ?? '').trim().slice(0, 140)
  const pic = (src: string, alt: string) => `<img src="${esc(src)}" alt="${esc(alt)}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:14px;background:#e8edf8;color:#14285c;font-size:14px">`
  const wrap = (inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px"><tr><td align="center">${inner}</td></tr></table>`
  let out = ''
  if (image) out += wrap(pic(image, media.imageAlt || 'Photo from Cznnect'))
  if (video) {
    out += wrap(poster
      ? `<a href="${esc(video)}" style="text-decoration:none">${pic(poster, media.videoAlt || 'Play the video')}</a>`
      : `<a href="${esc(video)}" style="display:block;background:#172344;border:1px solid #e7c35a;border-radius:14px;padding:30px 18px;color:#e7c35a;font-size:17px;font-weight:bold;text-align:center;text-decoration:none">&#9654;&nbsp; Watch the video</a>`)
    out += `<p class="txt" style="margin:-6px 0 16px;font-size:13px;text-align:center;color:#3c4043"><a href="${esc(video)}" style="color:${NAVY};text-decoration:underline">Open the video</a></p>`
  }
  if (caption && out) out += `<p class="txt" style="margin:0 0 16px;font-size:14px;line-height:1.5;text-align:center;color:#3c4043">${esc(caption)}</p>`
  return out
}
export const mediaText = (media?: Media) => (media && httpsOnly(media.videoUrl) ? `Watch the video: ${httpsOnly(media.videoUrl)}` : '')

export type Gift = { title: string; detail?: string; code?: string }
export function giftHtml(gift?: Gift): string {
  if (!gift?.title) return ''
  const gold = '#e7c35a'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px"><tr><td align="center" bgcolor="#172344" style="background:#172344;border:1px solid ${gold};border-radius:16px;padding:22px 18px">
<p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${gold}">A little something for you</p>
<p style="margin:9px 0 0;font-size:21px;line-height:1.3;font-weight:bold;color:#ffffff">${esc(gift.title)}</p>
${gift.detail ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#c7d0e4">${esc(gift.detail)}</p>` : ''}
${gift.code ? `<p style="margin:14px 0 0;display:inline-block;border:1px dashed ${gold};border-radius:9px;padding:9px 16px;font-size:19px;font-weight:bold;letter-spacing:2px;color:${gold}">${esc(gift.code)}</p>` : ''}
</td></tr></table>`
}
export const giftText = (gift?: Gift) => (gift?.title ? `A birthday gift for you: ${gift.title}${gift.detail ? `. ${gift.detail}` : ''}${gift.code ? `\nCode: ${gift.code}` : ''}` : '')

type Build = {
  subject: string; label: string; badge: string; accent: string; title: string; name: string; body: string
  extraHtml?: string; extraText?: string; cta?: [string, string]; footer: string; manage: boolean
}

function build(o: Build): { subject: string; html: string; text: string } {
  const { accent } = o
  const soft = '#e8edf8'
  const cta = o.cta && okUrl(o.cta[1]) ? ([o.cta[0], okUrl(o.cta[1])] as [string, string]) : undefined
  const subject = o.subject.replace(/\s+/g, ' ').trim().slice(0, 150)
  const year = new Date().getFullYear()
  const link = 'color:#5f6368;text-decoration:underline;font-weight:bold'
  const links = [
    `<a href="${SITE}" style="${link}">Open Cznnect</a>`,
    ...(o.manage ? [`<a href="${PREFERENCES_URL}" style="${link}">Email settings</a>`] : []),
    `<a href="${PRIVACY_URL}" style="${link}">Privacy Policy</a>`,
  ].join(' &nbsp;&middot;&nbsp; ')
  const button = cta
    ? `<tr><td align="center" style="padding:26px 32px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="btn" align="center" bgcolor="${accent}" style="background:${accent};border-radius:999px"><a href="${esc(cta[1])}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">${esc(cta[0])}</a></td></tr></table></td></tr>`
      + (cta[1] !== SITE ? `<tr><td class="pad muted" align="center" style="padding:14px 36px 0;font-size:12px;line-height:1.6;color:#80868b">If the button does not work, copy this link into your browser:<br><a href="${esc(cta[1])}" style="color:#5f6368;word-break:break-all">${esc(cta[1])}</a></td></tr>` : '')
      + '<tr><td style="height:28px;line-height:28px;font-size:1px">&nbsp;</td></tr>'
    : '<tr><td style="height:22px;line-height:22px;font-size:1px">&nbsp;</td></tr>'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark){
  .bg{background:#101214!important}.card{background:#1a1c1f!important}.panel{background:#23262b!important}
  .band{background:#0b1a45!important}.lbl{color:#9db8ff!important}.panel a{color:#9db8ff!important}.btn{background:#2f4fd8!important}.txt{color:#d3d6db!important}.ink{color:#ffffff!important}.muted{color:#9aa0a6!important}
  .muted a{color:#9aa0a6!important}.rule{border-color:#2e3135!important}.badge{background:#2e3135!important;border-color:#1a1c1f!important}
}
@media (max-width:480px){.pad{padding-left:20px!important;padding-right:20px!important}.title{font-size:23px!important}.col{display:block!important;width:100%!important;box-sizing:border-box}}
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f3f4fa;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.body.replace(/\s+/g, ' ').slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f3f4fa"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#202124">
<tr><td class="card" style="background:#ffffff;border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td class="band" align="center" bgcolor="#14285c" style="padding:28px 24px ${o.badge ? 64 : 34}px;background:#14285c;background-image:linear-gradient(135deg,#0b1a45 0%,#1f3d8f 100%)">${brand(44, '#ffffff')}</td></tr>
${o.badge ? `<tr><td align="center" style="padding:0 32px"><table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:-34px"><tr><td class="badge" align="center" width="68" height="68" bgcolor="${soft}" style="width:68px;height:68px;background:${soft};border:4px solid #ffffff;border-radius:50%;font-size:30px;line-height:68px;text-align:center">${o.badge}</td></tr></table></td></tr>` : ''}
<tr><td class="pad" align="center" style="padding:${o.badge ? 18 : 30}px 36px 4px">
<div class="lbl" style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${accent}">${esc(o.label)}</div>
<h1 class="title ink" style="margin:10px 0 14px;font-size:27px;line-height:1.25;font-weight:800;color:#14202b">${esc(o.title)}</h1>
<p class="txt" style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#3c4043">Hi ${esc(o.name)},</p>
</td></tr>
<tr><td class="pad" style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="panel" bgcolor="${soft}" style="background:${soft};border-radius:18px;padding:24px 26px 10px">
${blocks(o.body, accent)}
${o.extraHtml ?? ''}
<p class="txt" style="${PARA}">Warm regards,<br><strong class="ink" style="color:#14202b">The Cznnect team</strong></p>
</td></tr></table></td></tr>
${button}
<tr><td class="pad" style="padding:0 36px"><div class="rule" style="border-top:1px solid #e3e5e8"></div></td></tr>
<tr><td class="pad muted" align="center" style="padding:26px 36px 32px;text-align:center;font-size:12px;line-height:1.7;color:#80868b">
${brand(34, '#80868b')}
<div style="height:14px;line-height:14px">&nbsp;</div>
${esc(o.footer)}<br><br>${links}<br><br>
${postalHtml()}<br>
&copy; ${year} Cznnect
</td></tr></table></td></tr></table></td></tr></table></body></html>`
  const textLinks = [`Open Cznnect: ${SITE}`, ...(o.manage ? [`Email settings: ${PREFERENCES_URL} (Settings, then Emails)`] : []), `Privacy Policy: ${PRIVACY_URL}`].join('\n')
  const text = [`Hi ${o.name},`, o.title, o.body, o.extraText ?? '', cta ? `${cta[0]}: ${cta[1]}` : '', 'Warm regards,\nThe Cznnect team', o.footer, postalText(), `© ${year} Cznnect`, textLinks].filter(Boolean).join('\n\n')
  return { subject, html, text }
}

/** A built-in email. Unknown kinds throw, so a typo can never send a half-empty message. */
export function renderEmail(kind: string, vars: Vars = {}, extra?: { html?: string; text?: string }) {
  const k = KINDS[kind]
  if (!k) throw new Error(`Unknown email kind: ${kind}`)
  return build({
    subject: k.subject(vars), label: k.label, badge: k.badge, accent: k.accent ?? NAVY, title: k.title(vars), name: nm(vars),
    body: k.lines(vars).join('\n\n'), extraHtml: extra?.html, extraText: extra?.text, cta: k.cta?.(vars),
    footer: footerText(k.group, k.cat), manage: k.group === 'optional' && k.cat !== undefined,
  })
}

/** An email the owner wrote in the app (send-custom-email): their subject and text, in the same layout and footer. */
export function renderCustom(category: string, subject: string, body: string, name: string) {
  const switchable = category !== 'important' && category !== 'direct'
  return build({
    subject, label: category === 'direct' ? 'Message' : (CATEGORIES[category] ?? 'Cznnect'), badge: BADGES[category] ?? '✉️', accent: NAVY,
    title: subject, name: name || 'there', body, cta: ['Open Cznnect', SITE], footer: footerText(switchable ? 'optional' : 'service', category), manage: switchable,
  })
}
