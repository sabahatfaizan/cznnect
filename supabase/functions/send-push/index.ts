// A family member types one message and it is sent as a push notification to everyone else in their family.
// No personal messages: the recipients are always the whole family, chosen here on the server.
// Secret needed: FCM_SERVICE_ACCOUNT (the Firebase service account key JSON, pasted whole).
// Deploy: supabase functions deploy send-push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Any signed-in family member may send, but only ever to their own whole family: there are no personal messages.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(jwt)
    const me = u.user
    if (!me) return json({ error: 'Sign in first.' }, 401)

    const { body, family_id } = await req.json()
    const b = String(body ?? '').trim().slice(0, 200)
    if (!b) return json({ error: 'Type a message first.' }, 400)

    const { data: mine } = await admin.from('family_members').select('family_id').eq('user_id', me.id).eq('family_id', String(family_id ?? '')).maybeSingle()
    if (!mine) return json({ error: 'You are not in this family.' }, 403)

    // One message per 30 seconds per person.
    const since = new Date(Date.now() - 30_000).toISOString()
    const { count } = await admin.from('push_broadcasts').select('id', { count: 'exact', head: true }).eq('user_id', me.id).gte('created_at', since)
    if ((count ?? 0) > 0) return json({ error: 'Wait a few seconds before sending another message.' }, 429)

    const { data: prof } = await admin.from('profiles').select('display_name, nickname').eq('id', me.id).maybeSingle()
    const t = (prof?.nickname?.trim() || prof?.display_name || 'Someone').slice(0, 40)

    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
    if (!saRaw) return json({ error: 'FCM_SERVICE_ACCOUNT secret is not set.' }, 500)
    const sa = JSON.parse(saRaw)
    const access = await accessToken(sa)

    await admin.from('push_broadcasts').insert({ user_id: me.id, family_id, body: b })

    // Everyone in the family except the sender.
    const { data: members } = await admin.from('family_members').select('user_id').eq('family_id', family_id).neq('user_id', me.id)
    const ids = (members ?? []).map((m) => m.user_id)
    const { data: rows, error } = ids.length
      ? await admin.from('push_tokens').select('token').in('user_id', ids)
      : { data: [], error: null }
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
