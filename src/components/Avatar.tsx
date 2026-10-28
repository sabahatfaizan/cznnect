import { AVATAR_COLORS, parseAvatar } from '../lib/avatars'

// Shows the chosen emoji avatar, or the first letter of the name when none is picked yet.
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
