import { AVATAR_COLORS, parseAvatar, parseTypoAvatar, type TypoFont } from '../lib/avatars'

const FONTS: Record<TypoFont, string> = {
  moon: '"Moonfark", var(--font-heading), system-ui, sans-serif',
  rdr2: '"Chinese Rocks", var(--font-heading), system-ui, sans-serif',
  nathan: '"Nathan", var(--font-heading), system-ui, sans-serif',
  plain: 'var(--font-heading), system-ui, sans-serif',
}

// Shows the chosen emoji or lettering avatar, or the first letter of the name when none is picked yet.
export default function Avatar({
  value,
  name,
  size = 40,
  className = '',
}: {
  value?: string | null
  name: string
  size?: number
  className?: string
}) {
  const t = parseTypoAvatar(value)
  if (t) {
    const label = t.text === null ? (name.trim()[0] || '?').toUpperCase() : t.text
    const len = Math.max(1, [...label].length)
    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          fontSize: size * Math.min(0.5, 1.12 / len),
          color: t.fg,
          fontFamily: FONTS[t.font],
          letterSpacing: len > 1 ? '0.03em' : undefined,
          backgroundImage: `linear-gradient(145deg, ${t.bg[0]}, ${t.bg[1]})`,
          boxShadow: t.ring ? `inset 0 0 0 ${Math.max(1.5, size * 0.045)}px ${t.ring}` : 'inset 0 0 0 1px rgba(255,255,255,.14)',
        }}
        className={`flex flex-none items-center justify-center overflow-hidden rounded-[var(--radius-avatar)] font-bold leading-none ${className}`}
      >
        {label}
      </span>
    )
  }
  const a = parseAvatar(value)
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.52,
    ...(a ? { backgroundImage: `linear-gradient(145deg, ${AVATAR_COLORS[a.color][0]}, ${AVATAR_COLORS[a.color][1]})` } : {}),
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`flex flex-none items-center justify-center rounded-[var(--radius-avatar)] leading-none ${
        a ? 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.28)]' : 'bg-accent-soft font-display font-bold text-accent-text'
      } ${className}`}
    >
      {a ? a.emoji : (name.trim()[0] || '?').toUpperCase()}
    </span>
  )
}
