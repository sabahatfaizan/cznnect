import type { ReactNode } from 'react'

export type IconName = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl' | 'settings' | 'trophy' | 'cake' | 'key' | 'lock' | 'music' | 'family' | 'palette' | 'phone' | 'search' | 'list' | 'plus' | 'back' | 'download' | 'info' | 'admin' | 'bell' | 'megaphone' | 'chat' | 'send'

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  admin: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chat: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4zM8 9h8M8 12h5" />,
  send: <path d="M21 3L10 14M21 3l-7 18-4-8-8-4z" />,
  megaphone: <path d="M3 10v4a1 1 0 0 0 1 1h3l9 4.5V4.5L7 9H4a1 1 0 0 0-1 1zM7 15l1.2 4.5h2.6M19.5 9.5a3.5 3.5 0 0 1 0 5" />,
  bell: <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.01" />
    </>
  ),
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
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <path d="M8.6 9.1a4 4 0 0 0 0 5.8M15.4 9.1a4 4 0 0 1 0 5.8M5.7 6a9 9 0 0 0 0 12M18.3 6a9 9 0 0 1 0 12" />
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
  // Three sliders: reads clearly at small sizes, unlike a many-toothed gear.
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  cake: (
    <>
      <path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />
      <path d="M5 17c1.8 1.4 3.4 1.4 5 0s3.2-1.4 4.8 0c1.6 1.2 3.3 1.2 4.2 0" />
      <path d="M12 12V9.5M12 7.8c-1-1-1-2 0-3.3 1 1.3 1 2.3 0 3.3z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M14 9l2.5 2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17.5" cy="9.5" r="2.3" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.8c3-.4 5.5 1.3 5.5 4.2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.5-1-2.7 0-.9.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7.3" r="1" />
      <circle cx="14.5" cy="7.3" r="1" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v6a4 4 0 0 1-8 0z" />
      <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5A3.5 3.5 0 0 1 15.5 11" />
      <path d="M12 14v4M8.5 20h7" />
    </>
  ),
}

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="flex-none"
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
