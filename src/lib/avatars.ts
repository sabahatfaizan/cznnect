// In-app avatars: a symbol on a coloured disc. Nothing is uploaded, so there is no storage to pay for.
// The symbol is either an emoji or a drawn icon, and the disc colour is any colour from the colour wheel.
// Stored in profiles.avatar (16 characters at most) as "<symbol>|#rrggbb", for example "🦊|#f59e0b" or
// "i:lasso|#3b82f6". Older avatars saved as "<emoji>|<colour number>" still load.
// Lettering avatars (below) are stored as "t:<id>", for example "t:mk-moon".
import type { ExclusiveTheme } from '../theme'

// Drawn icons: a hand-sketched Wild West set plus a bat. The ids are short so the stored value fits.
export const AVATAR_ICONS: { id: string; label: string }[] = [
  { id: 'lasso', label: 'Lasso' },
  { id: 'hat', label: 'Cowboy hat' },
  { id: 'knife', label: 'Knife' },
  { id: 'colt', label: 'Revolver' },
  { id: 'wanted', label: 'Wanted poster' },
  { id: 'lamp', label: 'Lantern' },
  { id: 'bat', label: 'Bat' },
]

// Emoji people actually use, grouped so they are quick to find.
export const EMOJI_GROUPS: { name: string; items: string[] }[] = [
  {
    name: 'Faces',
    items: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '🥳', '😜', '🤔', '😅', '🙃', '😇', '🤗', '🥹', '😴', '😭', '😡', '🤯'],
  },
  {
    name: 'Vibes',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '⚡', '🌈', '👑', '💎', '🎉', '🙏', '👍', '💪', '✌️'],
  },
  {
    name: 'Animals',
    items: ['🐶', '🐱', '🦊', '🐼', '🦁', '🐯', '🐺', '🐻', '🐸', '🐵', '🦄', '🐢', '🦋', '🐙', '🦅', '🦉', '🐧', '🦈', '🐉', '🐎'],
  },
  {
    name: 'Everyday',
    items: ['⚽', '🏏', '🎮', '🎧', '🎸', '📷', '🚀', '✈️', '🍕', '🍔', '🍟', '☕', '🍫', '🎂', '🌙', '⭐', '☀️', '🌹', '🌸', '🌵'],
  },
  { name: 'Adventure', items: ['🧭', '🗺️', '🏔️', '🎯'] },
]

// Emoji from the older picker that are no longer offered, still accepted so existing avatars keep working.
const LEGACY_EMOJI = ['🐆', '🏔️', '⭐']
export const AVATAR_EMOJI = [...new Set([...EMOJI_GROUPS.flatMap((g) => g.items), ...LEGACY_EMOJI])]

// The old fixed colours. Kept so avatars saved by number still load, and offered as quick swatches.
export const AVATAR_COLORS: [string, string][] = [
  ['#f59e0b', '#b45309'],
  ['#ef4444', '#991b1b'],
  ['#ec4899', '#9d174d'],
  ['#8b5cf6', '#5b21b6'],
  ['#3b82f6', '#1e40af'],
  ['#06b6d4', '#155e75'],
  ['#10b981', '#065f46'],
  ['#84cc16', '#3f6212'],
]
export const DEFAULT_AVATAR_COLOR = '#3b82f6'

export type AvatarSpec = { symbol: string; color: string }
export const isIconSymbol = (symbol: string) => symbol.startsWith('i:')
export const iconIdOf = (symbol: string) => symbol.slice(2)

const HEX = /^#[0-9a-fA-F]{6}$/

export function parseAvatar(v: string | null | undefined): AvatarSpec | null {
  if (!v || v.startsWith('t:')) return null
  const cut = v.lastIndexOf('|')
  if (cut < 1) return null
  const symbol = v.slice(0, cut)
  const tail = v.slice(cut + 1)
  const knownSymbol = isIconSymbol(symbol) ? AVATAR_ICONS.some((i) => i.id === iconIdOf(symbol)) : AVATAR_EMOJI.includes(symbol)
  if (!knownSymbol) return null
  if (HEX.test(tail)) return { symbol, color: tail.toLowerCase() }
  const n = Number(tail)
  if (Number.isInteger(n) && n >= 0 && n < AVATAR_COLORS.length) return { symbol, color: AVATAR_COLORS[n][0] }
  return null
}

export function encodeAvatar(a: AvatarSpec) {
  return `${a.symbol}|${a.color.toLowerCase()}`
}

// ---- Colour tools for the wheel and for shading the disc ----
export type Hsv = { h: number; s: number; v: number } // h 0-360, s and v 0-1

export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const to = (k: number) => Math.round((k + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

// Lighter (amount > 0) or darker (amount < 0) version of a colour.
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mixTo = amount < 0 ? 0 : 255
  const k = Math.abs(amount)
  const f = (c: number) => Math.round(c + (mixTo - c) * k)
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

// Dark ink on light discs and cream ink on dark ones, so drawn icons always show.
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1c1309' : '#f6ecd2'
}

// Nickname wins when set. The real name is kept for places that need it.
export function shownName(p: { display_name?: string | null; nickname?: string | null } | null | undefined) {
  return p?.nickname?.trim() || p?.display_name || 'Someone'
}

// ---- Lettering avatars: short words and initials set in a theme's own typeface, plus plain dark ones. ----
// The look is fully defined here, so the stored value is just the id. The themed packs can only be picked
// once that theme is unlocked on this device; anyone can still see them on other people's profiles.
export type TypoFont = 'moon' | 'rdr2' | 'nathan' | 'plain'
export type TypoAvatar = {
  id: string
  pack: string
  text: string | null // null = the person's own first letter; '' = nothing (a plain disc)
  font: TypoFont
  bg: [string, string]
  fg: string
  ring?: string
}

export const TYPO_PACKS: { name: string; requires: ExclusiveTheme | null }[] = [
  { name: 'Dark', requires: null },
  { name: 'Moon Knight', requires: 'moonknight' },
  { name: 'Batman', requires: 'moonknight' }, // there is no Batman theme, so this pack goes with the dark Moon Knight one
  { name: 'Arthur Morgan', requires: 'rdr2' },
  { name: 'Nathan Drake', requires: 'uncharted' },
]

const MK: [string, string] = ['#1a1a1a', '#000000']
const BAT: [string, string] = ['#202228', '#050506']
const RDR: [string, string] = ['#5a1a10', '#150d0a']
const UNC: [string, string] = ['#8a4a1c', '#2a1608']

export const TYPO_AVATARS: TypoAvatar[] = [
  // Dark, plain black
  { id: 'd-black', pack: 'Dark', text: null, font: 'plain', bg: ['#0a0a0a', '#000000'], fg: '#f2f2f2' },
  { id: 'd-ring', pack: 'Dark', text: null, font: 'plain', bg: ['#0a0a0a', '#000000'], fg: '#f2f2f2', ring: '#f2f2f2' },
  { id: 'd-void', pack: 'Dark', text: '', font: 'plain', bg: ['#141414', '#000000'], fg: '#ffffff', ring: '#2a2a2a' },
  { id: 'd-coal', pack: 'Dark', text: null, font: 'plain', bg: ['#2c2c2c', '#0b0b0b'], fg: '#e6e6e6' },
  { id: 'd-night', pack: 'Dark', text: null, font: 'plain', bg: ['#0c1424', '#000000'], fg: '#cfe0ff' },
  { id: 'd-ember', pack: 'Dark', text: null, font: 'plain', bg: ['#1f0707', '#000000'], fg: '#ffb4a8' },
  // Moon Knight
  { id: 'mk-moon', pack: 'Moon Knight', text: '\u263E', font: 'plain', bg: MK, fg: '#ffffff', ring: '#ffffff' },
  { id: 'mk-mk', pack: 'Moon Knight', text: 'MK', font: 'moon', bg: MK, fg: '#ffffff' },
  { id: 'mk-moonw', pack: 'Moon Knight', text: 'MOON', font: 'moon', bg: ['#ffffff', '#d9d9d9'], fg: '#000000' },
  { id: 'mk-marc', pack: 'Moon Knight', text: 'MARC', font: 'moon', bg: MK, fg: '#e8c872', ring: '#e8c872' },
  { id: 'mk-knight', pack: 'Moon Knight', text: 'KNIGHT', font: 'moon', bg: MK, fg: '#ffffff' },
  // Batman
  { id: 'bm-b', pack: 'Batman', text: 'B', font: 'plain', bg: BAT, fg: '#f5c400', ring: '#f5c400' },
  { id: 'bm-bruce', pack: 'Batman', text: 'BRUCE', font: 'plain', bg: BAT, fg: '#f5c400' },
  { id: 'bm-wayne', pack: 'Batman', text: 'WAYNE', font: 'plain', bg: BAT, fg: '#b9c2d0' },
  { id: 'bm-gotham', pack: 'Batman', text: 'GOTHAM', font: 'plain', bg: BAT, fg: '#f5c400' },
  { id: 'bm-night', pack: 'Batman', text: 'NIGHT', font: 'plain', bg: ['#2a2d35', '#0a0a0c'], fg: '#ffffff' },
  // Arthur Morgan
  { id: 'am-am', pack: 'Arthur Morgan', text: 'AM', font: 'rdr2', bg: RDR, fg: '#f1dfb8' },
  { id: 'am-arthur', pack: 'Arthur Morgan', text: 'ARTHUR', font: 'rdr2', bg: RDR, fg: '#f1dfb8' },
  { id: 'am-morgan', pack: 'Arthur Morgan', text: 'MORGAN', font: 'rdr2', bg: RDR, fg: '#f1dfb8', ring: '#c8432b' },
  { id: 'am-outlaw', pack: 'Arthur Morgan', text: 'OUTLAW', font: 'rdr2', bg: ['#c8432b', '#4a0f0a'], fg: '#fff1d6' },
  { id: 'am-honor', pack: 'Arthur Morgan', text: 'HONOR', font: 'rdr2', bg: ['#e9d3a3', '#a98450'], fg: '#2a1608' },
  { id: 'am-1899', pack: 'Arthur Morgan', text: '1899', font: 'rdr2', bg: RDR, fg: '#f1dfb8' },
  // Nathan Drake
  { id: 'nd-nd', pack: 'Nathan Drake', text: 'ND', font: 'nathan', bg: UNC, fg: '#f2d58f' },
  { id: 'nd-nate', pack: 'Nathan Drake', text: 'NATE', font: 'nathan', bg: UNC, fg: '#f2d58f' },
  { id: 'nd-drake', pack: 'Nathan Drake', text: 'DRAKE', font: 'nathan', bg: ['#f2d58f', '#c98a3c'], fg: '#2a1608', ring: '#2a1608' },
  { id: 'nd-nathan', pack: 'Nathan Drake', text: 'NATHAN', font: 'nathan', bg: UNC, fg: '#f2d58f' },
  { id: 'nd-spm', pack: 'Nathan Drake', text: 'SPM', font: 'nathan', bg: ['#2a1608', '#120a04'], fg: '#ffd36b', ring: '#ffd36b' },
]

export function parseTypoAvatar(v: string | null | undefined): TypoAvatar | null {
  if (!v || !v.startsWith('t:')) return null
  return TYPO_AVATARS.find((t) => t.id === v.slice(2)) ?? null
}

export const encodeTypoAvatar = (id: string) => `t:${id}`
