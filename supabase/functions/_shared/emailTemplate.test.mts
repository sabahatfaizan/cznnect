import { KINDS, CATEGORIES, renderEmail, renderCustom, POSTAL, LOGO_URL, SITE } from './emailTemplate.ts'
import { renderBirthday, birthdayIsToday, todayIn } from './birthday.ts'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out = join(tmpdir(), 'cznnect-email-out')
mkdirSync(out, { recursive: true })
const v = { name: 'Amina', actor: 'Rafi', family: 'Chowdhury', plan: 'Cox’s Bazar trip', title: 'Eid gathering', subject: 'Your question', message: 'A short message with a link https://example.com/page.', date: '14 March', when: 'tomorrow', place: 'Dhaka', device: 'Chrome on Android', link: 'https://example.com/action?token=abc&x=1' }
const results: Record<string, { subject: string; html: string; text: string }> = {}
for (const k of Object.keys(KINDS)) results['kind_' + k] = renderEmail(k, v)
for (const k of Object.keys(KINDS)) results['bare_' + k] = renderEmail(k, {}) // no variables at all
for (const c of Object.keys(CATEGORIES)) results['custom_' + c] = renderCustom(c, 'A subject <b>&</b>', 'First paragraph with https://example.com.\n\n- one\n- two\n\nLast one', 'Amina') as any
results['birthday_full'] = renderBirthday('Amina', { title: 'A free month of Cznnect+', detail: 'Small print', code: 'HBD26' }, { imageUrl: 'https://example.com/a.jpg', videoUrl: 'https://example.com/v.mp4', posterUrl: 'https://example.com/p.jpg', caption: 'Best wishes' })
results['birthday_plain'] = renderBirthday('')
results['birthday_video_noposter'] = renderBirthday('Sam', undefined, { videoUrl: 'https://example.com/v.mp4' })
let bad = 0
const fail = (n: string, m: string) => { bad++; console.log('FAIL', n, m) }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
for (const [n, r] of Object.entries(results)) {
  const h = r.html, t = r.text
  writeFileSync(join(out, `${n}.html`), h)
  if (!r.subject.trim()) fail(n, 'empty subject')
  if (/[\u{1F300}-\u{1FAFF}]/u.test(r.subject)) fail(n, 'emoji in subject')
  if (r.subject.includes('!')) fail(n, 'exclamation in subject')
  for (const a of POSTAL) { if (!h.includes(a.line) || !t.includes(a.line)) fail(n, 'missing address ' + a.line); if (!h.includes(a.name) || !t.includes(a.name)) fail(n, 'missing name') }
  if (count(h, /Sabahat Faizan/g) !== 2) fail(n, 'name count in html ' + count(h, /Sabahat Faizan/g))
  if (/creator|founder|owner|developed by|created by|made by/i.test(h + t)) fail(n, 'ownership wording')
  if (!h.includes(LOGO_URL)) fail(n, 'logo missing')
  if (!h.includes('name="viewport"') || !h.includes('prefers-color-scheme: dark')) fail(n, 'viewport/dark missing')
  if (/undefined|null|\[object/.test(h + t)) fail(n, 'undefined/null leaked')
  if (/display:\s*(flex|grid)|position:\s*(absolute|fixed)|<script|<form/i.test(h)) fail(n, 'email-unsafe css/html')
  for (const tag of ['table', 'tr', 'td']) if (count(h, new RegExp(`<${tag}[\\s>]`, 'g')) !== count(h, new RegExp(`</${tag}>`, 'g'))) fail(n, `unbalanced ${tag}`)
  for (const m of h.matchAll(/href="([^"]*)"/g)) if (!/^https?:\/\//.test(m[1])) fail(n, 'bad href ' + m[1])
  for (const m of h.matchAll(/<img [^>]*src="([^"]*)"/g)) if (!/^https:\/\//.test(m[1])) fail(n, 'bad img ' + m[1])
  if (!/alt=/.test(h)) fail(n, 'img without alt')
  if (n.startsWith('custom_') && h.includes('<b>')) fail(n, 'unescaped html')
}
console.log('rendered', Object.keys(results).length, 'emails; failures:', bad)
console.log(Object.entries(results).filter(([n]) => n.startsWith('kind_')).map(([n, r]) => `${n.slice(5)}: ${r.subject}`).join('\n'))
console.log('birthday today?', birthdayIsToday('1990-02-29', { year: 2027, month: 2, day: 28 }), todayIn('Asia/Dhaka').year)
