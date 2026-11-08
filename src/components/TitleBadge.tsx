// A small title next to a name, such as "Co-founder". Shows nothing when there is no title.
export default function TitleBadge({ title }: { title?: string | null }) {
  const t = title?.trim()
  if (!t) return null
  return (
    <span
      className="ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
    >
      {t}
    </span>
  )
}
