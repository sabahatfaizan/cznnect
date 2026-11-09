// Owner-only GitHub Actions build manager for Cznnect.
// Required secret: GITHUB_ADMIN_TOKEN (fine-grained token with Actions: read/write and Contents: read/write).
// Deploy: supabase functions deploy manage-builds
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OWNER_EMAIL = 'faizanplayz11@gmail.com'
const REPO = 'sabahatfaizan/cznnect'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-build',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function github(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`GitHub returned ${response.status}: ${raw.slice(0, 300)}`)
  return raw ? JSON.parse(raw) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const token = Deno.env.get('GITHUB_ADMIN_TOKEN')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server authentication is not configured.' }, 500)
    if (!token) return json({ error: 'GitHub management is not configured yet. Add GITHUB_ADMIN_TOKEN to Supabase Edge Function secrets.' }, 503)

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\\s+/i, '')
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: auth, error: authError } = await admin.auth.getUser(jwt)
    if (authError || (auth.user?.email ?? '').toLowerCase() !== OWNER_EMAIL) return json({ error: 'Owner access only.' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? 'list')

    if (action === 'list') {
      const [runs, release] = await Promise.all([
        github('/actions/runs?per_page=30', token),
        github('/releases/tags/latest-apk', token).catch(() => null),
      ])
      return json({
        runs: (runs.workflow_runs ?? []).map((r: Record<string, unknown>) => ({
          id: r.id, run_number: r.run_number, name: r.name, status: r.status,
          conclusion: r.conclusion, created_at: r.created_at, head_sha: r.head_sha,
          html_url: r.html_url, event: r.event,
        })),
        release: release ? {
          id: release.id, name: release.name, body: release.body,
          html_url: release.html_url, tag_name: release.tag_name,
          assets: (release.assets ?? []).map((a: Record<string, unknown>) => ({
            id: a.id, name: a.name, size: a.size, download_count: a.download_count,
          })),
        } : null,
      })
    }

    if (action === 'delete_run') {
      const id = Number(body.run_id)
      if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Invalid build ID.' }, 400)
      await github(`/actions/runs/${id}`, token, { method: 'DELETE' })
      return json({ success: true, message: 'Build run and its attached artifacts deleted.' })
    }

    if (action === 'delete_artifact') {
      const id = Number(body.artifact_id)
      if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Invalid artifact ID.' }, 400)
      await github(`/actions/artifacts/${id}`, token, { method: 'DELETE' })
      return json({ success: true, message: 'Artifact deleted.' })
    }

    if (action === 'delete_latest_release') {
      const release = await github('/releases/tags/latest-apk', token).catch(() => null)
      if (!release?.id) return json({ success: true, message: 'There is no latest release.' })
      await github(`/releases/${release.id}`, token, { method: 'DELETE' })
      // Remove the tag too, so the next successful build can recreate the rolling release cleanly.
      await github('/git/refs/tags/latest-apk', token, { method: 'DELETE' }).catch(() => null)
      return json({ success: true, message: 'Latest APK release removed. The next successful APK build will recreate it.' })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Build management failed.' }, 500)
  }
})
