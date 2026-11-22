// The owner sends one email, under one category, to the people they picked. Each person gets their own copy (nobody sees
// anyone else's address), and people who switched that category off are skipped, except for "important".
// The category "direct" is a personal message to ONE person: it goes out whatever their email switches say, and a reply
// goes to the owner's own address.
//
// How it is sent. Either of these, set as secrets for this function (SMTP wins when both are set):
//   Your own SMTP server:  SMTP_HOST  SMTP_PORT (465 is best; default 465)  SMTP_USER  SMTP_PASS
//                          EMAIL_FROM (for example:  Cznnect <hello@yourdomain.com>; if left out and SMTP_USER is an email
//                          address, that address is used)
//   Resend (resend.com):   RESEND_API_KEY  EMAIL_FROM (an address on a domain verified in Resend)
// Set them with:  supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=465 SMTP_USER=... SMTP_PASS=... EMAIL_FROM="Cznnect <hello@example.com>"
// Deploy: supabase functions deploy send-custom-email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { CATEGORIES, render } from './render.ts'

const OWNER_EMAIL = 'faizanplayz11@gmail.com' // same as src/owner.ts
const MAX_PEOPLE = 200
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-build',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string }
type Outcome = { sent: number; failed: number; firstError: string }
const why = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

// Your own SMTP server. One connection, one message at a time. Port 465 uses TLS from the start; another port (587) starts
// plain and the library upgrades it when the server offers STARTTLS.
async function sendViaSmtp(mails: Mail[], from: string): Promise<Outcome> {
  const port = Number(Deno.env.get('SMTP_PORT') || 465)
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST')!,
      port,
      tls: port === 465,
      auth: { username: Deno.env.get('SMTP_USER')!, password: Deno.env.get('SMTP_PASS')! },
    },
  })
  let sent = 0
  let failed = 0
  let firstError = ''
  let inARow = 0
  try {
    for (const [i, m] of mails.entries()) {
      try {
        await client.send({ from, to: m.to, subject: m.subject, content: m.text, html: m.html, ...(m.replyTo ? { replyTo: m.replyTo } : {}) })
        sent++
        inARow = 0
      } catch (e) {
        failed++
        inARow++
        if (!firstError) firstError = why(e)
        // Three in a row with nothing sent means the server or the login is wrong: stop instead of trying everyone.
        if (sent === 0 && inARow >= 3) { failed += mails.length - i - 1; break }
      }
    }
  } finally {
    try { await client.close() } catch { /* already closed */ }
  }
  return { sent, failed, firstError }
}

async function sendViaResend(mails: Mail[], from: string, key: string): Promise<Outcome> {
  let sent = 0
  let failed = 0
  let firstError = ''
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100)
    const payload = chunk.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }))
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) sent += chunk.length
    else { failed += chunk.length; if (!firstError) firstError = (await res.text()).slice(0, 300) }
  }
  return { sent, failed, firstError }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(jwt)
    const me = u.user
    if (!me) return json({ error: 'Sign in first.' }, 401)
    if ((me.email ?? '').toLowerCase() !== OWNER_EMAIL) return json({ error: 'Only the owner can send emails.' }, 403)

    const { category, subject, body, user_ids, test } = await req.json()
    const cat = String(category ?? '')
    if (!CATEGORIES[cat]) return json({ error: 'Pick a category.' }, 400)
    const direct = cat === 'direct'
    const subj = String(subject ?? '').trim().slice(0, 120)
    const text = String(body ?? '').trim().slice(0, 5000)
    if (!subj) return json({ error: 'Write a subject.' }, 400)
    if (!text) return json({ error: 'Write the message.' }, 400)

    // How to send: your own SMTP when it is set up, otherwise Resend.
    const smtp = Boolean(Deno.env.get('SMTP_HOST') && Deno.env.get('SMTP_USER') && Deno.env.get('SMTP_PASS'))
    const key = Deno.env.get('RESEND_API_KEY')
    const user = Deno.env.get('SMTP_USER') ?? ''
    const from = Deno.env.get('EMAIL_FROM') || (smtp && user.includes('@') ? `Cznnect <${user}>` : '')
    if (!from || (!smtp && !key)) {
      return json({ error: 'Email sending is not set up yet. Add the secrets SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM for this function (or RESEND_API_KEY and EMAIL_FROM for Resend).' }, 500)
    }

    // Who: a test goes only to the owner. Otherwise the chosen people (unique, at most MAX_PEOPLE).
    const ids: string[] = test ? [me.id] : [...new Set((Array.isArray(user_ids) ? user_ids : []).map(String))].slice(0, MAX_PEOPLE)
    if (!ids.length) return json({ error: direct ? 'Choose the person.' : 'Choose at least one person.' }, 400)
    if (direct && !test && ids.length !== 1) return json({ error: 'A direct message goes to one person. Choose just one.' }, 400)

    // Skip anyone who switched this category off (the owner's own test, "important" and a direct message always go through).
    let off = new Set<string>()
    if (cat !== 'important' && !direct && !test) {
      const { data } = await admin.from('email_optouts').select('user_id').eq('category', cat).in('user_id', ids)
      off = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
    }

    const people: { email: string; name: string }[] = []
    let skipped = 0
    await Promise.all(ids.map(async (id) => {
      if (off.has(id)) { skipped++; return }
      const { data: au } = await admin.auth.admin.getUserById(id)
      const email = au.user?.email
      if (!email) { skipped++; return }
      const { data: p } = await admin.from('profiles').select('display_name, nickname').eq('id', id).maybeSingle()
      people.push({ email, name: (p?.nickname?.trim() || p?.display_name || 'there').slice(0, 60) })
    }))

    const mails: Mail[] = people.map((p) => {
      const s = (test ? '[Test] ' : '') + subj
      const r = render(cat, s, text, p.name)
      return { to: p.email, subject: s, html: r.html, text: r.text, ...(direct && me.email ? { replyTo: me.email } : {}) }
    })

    let sent = 0
    let failed = 0
    let firstError = ''
    if (mails.length) {
      const out = smtp ? await sendViaSmtp(mails, from) : await sendViaResend(mails, from, key!)
      sent = out.sent
      failed = out.failed
      firstError = out.firstError
    }

    if (!test) await admin.from('email_log').insert({ sent_by: me.id, category: cat, subject: subj, sent, skipped, failed })
    if (failed && !sent) return json({ error: `The ${smtp ? 'mail server' : 'email service'} refused the message. ${firstError}`, sent, skipped, failed }, 502)
    return json({ sent, skipped, failed, note: failed ? firstError : undefined })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500)
  }
})
