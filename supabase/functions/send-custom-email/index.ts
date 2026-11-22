// The owner sends one email, under one category, to the people they picked. Each person gets their own copy (nobody sees
// anyone else's address), and people who switched that category off are skipped, except for "important".
// Secrets needed:  RESEND_API_KEY  (from resend.com)
//                  EMAIL_FROM      (for example:  Cznnect <hello@yourdomain.com>, an address on a domain verified in Resend)
// Deploy: supabase functions deploy send-custom-email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OWNER_EMAIL = 'faizanplayz11@gmail.com' // same as src/owner.ts
const CATEGORIES: Record<string, string> = {
  important: 'Important notices', updates: 'App updates', events: 'Events and gatherings', birthdays: 'Birthdays', plus: 'Cznnect+',
}
const MAX_PEOPLE = 200
const SITE = 'https://sabahatfaizan.github.io/cznnect/'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-build',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Plain text in, a simple branded email out. Blank lines make paragraphs; nothing the owner types is treated as HTML.
function render(category: string, subject: string, body: string, name: string) {
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const footer = category === 'important'
    ? 'This is an important notice about your Cznnect account.'
    : `You get this because you are signed up for “${esc(CATEGORIES[category])}” emails. Turn them off any time in Cznnect: Settings, then Emails.`
  const html = `<!doctype html><html><body style="margin:0;background:#f1f4f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#172333">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:.12em;color:#657287">CZNNECT</p>
<div style="background:#ffffff;border:1px solid #d9e0ea;border-radius:16px;padding:24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(subject)}</h1>
<p style="margin:0 0 16px;font-size:16px">Hi ${esc(name)},</p>
${paras}
<p style="margin:24px 0 0"><a href="${SITE}" style="display:inline-block;background:#2457d6;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Open Cznnect</a></p>
</div>
<p style="margin:16px 4px 0;font-size:12px;line-height:1.5;color:#657287">${footer}</p>
</div></body></html>`
  const text = `Hi ${name},\n\n${body}\n\nOpen Cznnect: ${SITE}\n\n${category === 'important' ? 'This is an important notice about your Cznnect account.' : `You get this because you are signed up for "${CATEGORIES[category]}" emails. Turn them off in Cznnect: Settings, then Emails.`}`
  return { html, text }
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
    const subj = String(subject ?? '').trim().slice(0, 120)
    const text = String(body ?? '').trim().slice(0, 5000)
    if (!subj) return json({ error: 'Write a subject.' }, 400)
    if (!text) return json({ error: 'Write the message.' }, 400)

    const key = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('EMAIL_FROM')
    if (!key || !from) return json({ error: 'Email sending is not set up yet. Add RESEND_API_KEY and EMAIL_FROM as secrets for this function.' }, 500)

    // Who: a test goes only to the owner. Otherwise the chosen people (unique, at most MAX_PEOPLE).
    const ids: string[] = test ? [me.id] : [...new Set((Array.isArray(user_ids) ? user_ids : []).map(String))].slice(0, MAX_PEOPLE)
    if (!ids.length) return json({ error: 'Choose at least one person.' }, 400)

    // Skip anyone who switched this category off (the owner's own test and "important" always go through).
    let off = new Set<string>()
    if (cat !== 'important' && !test) {
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

    let sent = 0
    let failed = 0
    let firstError = ''
    for (let i = 0; i < people.length; i += 100) {
      const chunk = people.slice(i, i + 100)
      const payload = chunk.map((p) => {
        const r = render(cat, (test ? '[Test] ' : '') + subj, text, p.name)
        return { from, to: [p.email], subject: (test ? '[Test] ' : '') + subj, html: r.html, text: r.text }
      })
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) sent += chunk.length
      else { failed += chunk.length; if (!firstError) firstError = (await res.text()).slice(0, 300) }
    }

    if (!test) await admin.from('email_log').insert({ sent_by: me.id, category: cat, subject: subj, sent, skipped, failed })
    if (failed && !sent) return json({ error: `The email service refused the message. ${firstError}`, sent, skipped, failed }, 502)
    return json({ sent, skipped, failed, note: failed ? firstError : undefined })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500)
  }
})
