// Sends a push notification to every phone that has registered a token. Owner only.
// Secret needed: FCM_SERVICE_ACCOUNT (the Firebase service account key JSON, pasted whole).
// Deploy: supabase functions deploy send-push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OWNER_EMAIL = 'faizanplayz11@gmail.com'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-build',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${b64url(sig)}` }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Could not get a Google access token')
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Only the owner may send.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(jwt)
    if ((u.user?.email ?? '').toLowerCase() !== OWNER_EMAIL) return json({ error: 'Only the owner can send notifications.' }, 403)

    const { title, body } = await req.json()
    const t = String(title ?? '').trim().slice(0, 60) || 'Cznnect'
    const b = String(body ?? '').trim().slice(0, 200)
    if (!b) return json({ error: 'Type a message first.' }, 400)

    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
    if (!saRaw) return json({ error: 'FCM_SERVICE_ACCOUNT secret is not set.' }, 500)
    const sa = JSON.parse(saRaw)
    const access = await accessToken(sa)

    const { data: rows, error } = await admin.from('push_tokens').select('token')
    if (error) return json({ error: error.message }, 500)

    let sent = 0
    const dead: string[] = []
    await Promise.all((rows ?? []).map(async ({ token }) => {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title: t, body: b }, android: { priority: 'HIGH' } } }),
      })
      if (r.ok) sent++
      else if (r.status === 404 || r.status === 400) dead.push(token) // token no longer valid
    }))
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead)

    return json({ sent, total: rows?.length ?? 0 })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, 500)
  }
})
