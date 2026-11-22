// Sending mail, shared by the email functions (send-custom-email and send-birthday-emails).
// Either your own SMTP server or Resend, chosen by which secrets are set (SMTP wins when both are).
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string }
export type Outcome = { sent: number; failed: number; firstError: string }
const why = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

// Your own SMTP server. One connection, one message at a time. Port 465 uses TLS from the start; another port (587) starts
// plain and the library upgrades it when the server offers STARTTLS.
export async function sendViaSmtp(mails: Mail[], from: string): Promise<Outcome> {
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

export async function sendViaResend(mails: Mail[], from: string, key: string): Promise<Outcome> {
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

/** Which way mail goes out, from the function's secrets. */
export function mailConfig() {
  const smtp = Boolean(Deno.env.get('SMTP_HOST') && Deno.env.get('SMTP_USER') && Deno.env.get('SMTP_PASS'))
  const key = Deno.env.get('RESEND_API_KEY')
  const user = Deno.env.get('SMTP_USER') ?? ''
  const from = Deno.env.get('EMAIL_FROM') || (smtp && user.includes('@') ? `Cznnect <${user}>` : '')
  return { smtp, key, from, ready: Boolean(from && (smtp || key)) }
}

export const sendMail = (mails: Mail[], cfg: ReturnType<typeof mailConfig>): Promise<Outcome> =>
  cfg.smtp ? sendViaSmtp(mails, cfg.from) : sendViaResend(mails, cfg.from, cfg.key!)

