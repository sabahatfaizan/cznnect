// Admin > All users > Download list. Builds a CSV (opens in Excel, Google Sheets or any spreadsheet app) of every
// account and saves it: inside the Android app to Downloads/Cznnect, on the web as a normal browser download.
import { supabase } from '../supabase'
import { callPlugin, isNative, shareText } from './native'

type Row = Record<string, unknown>

// Column title and where its value comes from, in the order they appear in the file.
const COLUMNS: Array<[string, (r: Row) => unknown]> = [
  ['Name', (r) => r.display_name],
  ['Nickname', (r) => r.nickname],
  ['Title', (r) => r.title],
  ['Sign-in email', (r) => r.email],
  ['Email confirmed', (r) => yesNo(r.email_confirmed)],
  ['Phone', (r) => r.phone],
  ['Contact email', (r) => r.contact_email],
  ['Shares contact with family', (r) => yesNo(r.shares_contact)],
  ['Birthday', (r) => r.birthday],
  ['Cznnect+', (r) => yesNo(r.plus)],
  ['Families', (r) => r.families ?? 'No family yet'],
  ['Bio', (r) => r.bio],
  ['Joined', (r) => when(r.created_at)],
  ['Last signed in', (r) => when(r.last_sign_in_at)],
  ['User ID', (r) => r.user_id],
]

function yesNo(v: unknown): string {
  return v === true ? 'Yes' : v === false ? 'No' : ''
}

// "2026-11-27 20:15", in the phone's own time zone. Spreadsheets read this as a date and time.
function when(v: unknown): string {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function cell(v: unknown): string {
  let s = v == null ? '' : String(v)
  // A value starting with = + - @ could run as a formula in a spreadsheet; a leading ' keeps it plain text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function usersToCsv(rows: Row[]): string {
  const lines = [COLUMNS.map(([t]) => cell(t)).join(',')]
  for (const r of rows) lines.push(COLUMNS.map(([, get]) => cell(get(r))).join(','))
  // The BOM at the start makes Excel read Bangla and other non-English names correctly.
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// Loads every account with its details. Falls back to the basic list (no phone, birthday, Cznnect+) when
// supabase/35_admin_users_export.sql has not been run yet, and says so.
export async function loadUsersForExport(): Promise<{ rows: Row[]; basic: boolean }> {
  const full = await supabase.rpc('admin_users_export')
  if (!full.error) return { rows: (full.data ?? []) as Row[], basic: false }
  const basic = await supabase.rpc('admin_all_users')
  if (basic.error) throw new Error('Could not load the users. Run supabase/35_admin_users_export.sql in Supabase first.')
  return { rows: (basic.data ?? []) as Row[], basic: true }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// Saves the file and returns a short message saying where it went.
export async function saveCsv(csv: string, name: string): Promise<string> {
  if (isNative()) {
    try {
      await callPlugin('CznnectNative', 'saveFile', { base64: toBase64(csv), name, mime: 'text/csv' })
      return `Saved ${name} to Downloads/Cznnect.`
    } catch {
      // An older app without saveFile (or Android 9 and older): send the list through the share sheet instead,
      // e.g. to Google Drive, Gmail or WhatsApp.
      await shareText(csv.replace(/^﻿/, ''), name)
      return 'Shared the list. Update the app to save it straight to Downloads.'
    }
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return `Downloaded ${name}.`
}

export function exportFileName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `cznnect-users-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`
}
