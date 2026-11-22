// Sends a birthday email to everyone whose birthday is today. It is run once a day by GitHub (.github/workflows/birthday-emails.yml).
//
// Who gets one: people with a birthday saved in their profile, today (in BIRTHDAY_TIMEZONE), who have not switched "Birthdays"
// emails off in Settings > Emails. Each person gets at most one a year (the birthday_email_log table remembers), so running it
// twice in a day is harmless.
//
// Secrets for this function (Supabase > Edge Functions > Secrets), besides the mail ones used by send-custom-email:
//   CRON_SECRET          any long random text; the daily job sends the same text so only it can start this function
//   BIRTHDAY_TIMEZONE    optional, for example Asia/Dhaka (the default). Decides what "today" means.
//   BIRTHDAY_GIFT        optional. A present shown in the email, for example "A free month of Cznnect+". Nothing is shown if it is not set.
//   BIRTHDAY_GIFT_DETAIL optional, one line of small print under the gift.   BIRTHDAY_GIFT_CODE  optional, a code to show with it.
// Deploy WITHOUT the login check, because the daily job has no login:  supabase functions deploy send-birthday-emails --no-verify-jwt
// Add ?dry=1 to the address to see who would get an email without sending anything.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mailConfig, sendMail } from '../_shared/mailer.ts'
import { birthdayIsToday, renderBirthday, todayIn } from '../_shared/birthday.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
type Person = { id: string; display_name: string | null; nickname: string | null; birthday: string | null }

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret) return json({ error: 'CRON_SECRET is not set for this function.' }, 500)
  if (req.headers.get('x-cron-secret') !== secret) return json({ error: 'Not allowed.' }, 401)
  try {
    const dry = new URL(req.url).searchParams.get('dry') === '1'
    const cfg = mailConfig()
    if (!dry && !cfg.ready) return json({ error: 'Email sending is not set up yet (SMTP_HOST, SMTP_USER, SMTP_PASS, or RESEND_API_KEY and EMAIL_FROM).' }, 500)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const giftTitle = (Deno.env.get('BIRTHDAY_GIFT') ?? '').trim()
    const gift = giftTitle ? { title: giftTitle.slice(0, 120), detail: (Deno.env.get('BIRTHDAY_GIFT_DETAIL') ?? '').trim().slice(0, 200) || undefined, code: (Deno.env.get('BIRTHDAY_GIFT_CODE') ?? '').trim().slice(0, 40) || undefined } : undefined
    const today = todayIn(Deno.env.get('BIRTHDAY_TIMEZONE') || 'Asia/Dhaka')

    const everyone: Person[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('profiles').select('id, display_name, nickname, birthday').not('birthday', 'is', null).range(from, from + 999)
      if (error) throw error
      everyone.push(...((data ?? []) as Person[]))
      if ((data ?? []).length < 1000) break
    }
    const due = everyone.filter((p) => birthdayIsToday(p.birthday, today))
    if (!due.length) return json({ date: today, birthdays: 0, sent: 0, skipped: 0, failed: 0 })

    const ids = due.map((p) => p.id)
    const [{ data: off }, { data: done }] = await Promise.all([
      admin.from('email_optouts').select('user_id').eq('category', 'birthdays').in('user_id', ids),
      admin.from('birthday_email_log').select('user_id').eq('year', today.year).in('user_id', ids),
    ])
    const skip = new Set([...(off ?? []), ...(done ?? [])].map((r: { user_id: string }) => r.user_id))

    let sent = 0
    let failed = 0
    let skipped = 0
    const who: string[] = []
    for (const p of due) {
      if (skip.has(p.id)) { skipped++; continue }
      const { data: au } = await admin.auth.admin.getUserById(p.id)
      const email = au.user?.email
      if (!email) { skipped++; continue }
      const name = (p.nickname?.trim() || p.display_name || '').trim().slice(0, 60)
      who.push(name || email)
      if (dry) continue
      // Claim this year first, so two runs at once cannot both send. If sending fails the claim is given back for the next run.
      const claim = await admin.from('birthday_email_log').insert({ user_id: p.id, year: today.year })
      if (claim.error) { skipped++; continue }
      const mail = renderBirthday(name, gift)
      const out = await sendMail([{ to: email, subject: mail.subject, html: mail.html, text: mail.text }], cfg)
      if (out.sent) sent++
      else { failed++; await admin.from('birthday_email_log').delete().eq('user_id', p.id).eq('year', today.year) }
    }
    return json({ date: today, birthdays: due.length, sent, skipped, failed, ...(dry ? { wouldSendTo: who } : {}) })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500)
  }
})
