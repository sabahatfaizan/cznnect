// In-app avatars: an emoji on a coloured disc. Nothing is uploaded, so there is no storage to pay for.
// Stored in profiles.avatar as "<emoji>|<colour index>", for example "🦊|3".
// Lettering avatars (below) are stored as "t:<id>", for example "t:mk-moon" (16 characters at most).
import type { ExclusiveTheme } from '../theme'

export const AVATAR_EMOJI = [
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🦅', '🦉',
  '🐉', '🦈', '🐙', '🦋', '🐢', '🦄', '🐎', '🐆',
  '🌵', '🔥', '⚡', '🌙', '⭐', '🏔️', '🧭', '🗺️',
  '🎯', '🎸', '🏏', '⚽', '🎮', '📷', '🍕', '☕',
]

// Gradient pairs for the disc, picked to read on every theme.
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

export type AvatarSpec = { emoji: string; color: number }

export function parseAvatar(v: string | null | undefined): AvatarSpec | null {
  if (!v) return null
  const [emoji, c] = v.split('|')
  const color = Number(c)
  if (!emoji || !AVATAR_EMOJI.includes(emoji) || !Number.isInteger(color) || color < 0 || color >= AVATAR_COLORS.length)
    return null
  return { emoji, color }
}

export function encodeAvatar(a: AvatarSpec) {
  return `${a.emoji}|${a.color}`
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
