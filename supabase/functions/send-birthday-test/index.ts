// Sends a birthday-email preview to the authenticated Cznnect owner only.
// It uses the saved birthday media and does not write to birthday_email_log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mailConfig, sendMail } from '../_shared/mailer.ts'
import { renderBirthday, type BirthdayMedia } from '../_shared/birthday.ts'

const OWNER_EMAIL = 'faizanplayz11@gmail.com'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-build',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST to send a test email.' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\\s+/i, '')
    if (!jwt) return json({ error: 'Sign in first.' }, 401)
    const { data: auth, error: authError } = await admin.auth.getUser(jwt)
    const me = auth.user
    if (authError || !me) return json({ error: 'Your session has expired. Sign in again.' }, 401)
    if ((me.email ?? '').toLowerCase() !== OWNER_EMAIL) return json({ error: 'Only the Cznnect owner can send a test birthday email.' }, 403)
    if (!me.email) return json({ error: 'Your account has no email address.' }, 400)

    const cfg = mailConfig()
    if (!cfg.ready) return json({ error: 'Email sending is not configured. Check the SMTP or Resend secrets used by the email functions.' }, 500)

    const [{ data: mediaRow }, { data: profile }] = await Promise.all([
      admin.from('birthday_media').select('image_url, video_url, poster_url, caption').eq('id', 1).maybeSingle(),
      admin.from('profiles').select('display_name, nickname').eq('id', me.id).maybeSingle(),
    ])
    const media: BirthdayMedia | undefined = mediaRow ? {
      imageUrl: mediaRow.image_url || undefined,
      videoUrl: mediaRow.video_url || undefined,
      posterUrl: mediaRow.poster_url || undefined,
      caption: mediaRow.caption || undefined,
    } : undefined
    const name = (profile?.nickname?.trim() || profile?.display_name || 'Sabahat').trim().slice(0, 60)
    const rendered = renderBirthday(name, undefined, media)
    const subject = '[Test] ' + rendered.subject
    const result = await sendMail([{ to: me.email, subject, html: rendered.html, text: rendered.text }], cfg)
    if (!result.sent) return json({ error: `The email service could not send the test. ${result.firstError || 'Please check the email function logs.'}`, sent: result.sent, failed: result.failed }, 502)
    return json({ sent: result.sent, failed: result.failed, to: me.email, note: 'Test only; no birthday delivery record was created.' })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Something went wrong.' }, 500)
  }
})
