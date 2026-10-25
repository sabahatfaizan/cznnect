import type { ReactNode } from 'react'

export type IconName = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl'

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  tree: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M12 7.5v4M12 11.5H6v5M12 11.5h6v5" />
    </>
  ),
  irl: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14 14.5c3.5-.5 6.5 1.4 7 4.5" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8l-2 6-6 2 2-6z" />
    </>
  ),
  plans: <path d="M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17" />,
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
