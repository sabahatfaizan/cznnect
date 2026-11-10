import type { ReactNode } from 'react'
import { Icon } from './Icons'

// An expandable group: a title with a one-line status, and the controls tucked underneath until it is opened.
export default function Fold({ title, status, open = false, children }: { title: string; status?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="card expander" open={open}>
      <summary>
        <span className="min-w-0">
          <span className="block font-display text-base font-bold">{title}</span>
          {status && <span className="block truncate text-xs text-muted">{status}</span>}
        </span>
        <span aria-hidden="true" className="expander-chevron">
          <Icon name="chevronDown" size={20} />
        </span>
      </summary>
      <div className="flex flex-col gap-3 pt-2">{children}</div>
    </details>
  )
}
