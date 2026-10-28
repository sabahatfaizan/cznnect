import { unlockTheme, type ExclusiveTheme } from '../theme'

// Redeem codes are kept only as SHA-256 hashes, so the code itself is not written out in the source.
// This keeps casual snoopers out, but it is not real security: the check runs in the browser, so
// someone determined could still unlock a theme on their own device. A server check would be needed
// to truly gate them.
const SALT = 'cznnect-redeem-v1:'
const CODES: Record<string, ExclusiveTheme> = {
  '2875f31b486cae39686871a25ab4f872b36a655e014261f90b0f6e6afefd75c2': 'uncharted',
}

export type RedeemResult =
  | { status: 'ok'; theme: ExclusiveTheme; isNew: boolean }
  | { status: 'invalid' }
  | { status: 'unsupported' }

// Capitals and digits only, so spaces, dashes and lower case all work.
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function redeemCode(input: string): Promise<RedeemResult> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return { status: 'unsupported' }
  const code = normalizeCode(input)
  if (!code) return { status: 'invalid' }
  const theme = CODES[await sha256(SALT + code)]
  if (!theme) return { status: 'invalid' }
  return { status: 'ok', theme, isNew: unlockTheme(theme) }
}
