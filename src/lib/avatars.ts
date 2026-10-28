// In-app avatars: an emoji on a coloured disc. Nothing is uploaded, so there is no storage to pay for.
// Stored in profiles.avatar as "<emoji>|<colour index>", for example "🦊|3".

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
