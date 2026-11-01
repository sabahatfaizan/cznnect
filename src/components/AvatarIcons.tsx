import type { ReactNode } from 'react'

// Hand-sketched line icons for avatars (a Wild West set and a bat), drawn on a 48-unit square in one ink colour.
const ICON_PATHS: Record<string, ReactNode> = {
  // a coiled rope with the loose end tied off
  lasso: (
    <>
      <circle cx="25" cy="27" r="15" />
      <circle cx="25.5" cy="26.5" r="10.5" />
      <path d="M13 17c-5-3-4-8 2-9M11 13l7-4M9 17l8-5M12 21l7-6" />
    </>
  ),
  // a banded cowboy hat
  hat: (
    <>
      <path d="M15 25c-1-9 4-14 9-13 5-1 10 4 9 13" />
      <path d="M7 29c-2-3 1-5 8-4 6 1 12 1 18 0 7-1 10 1 8 4-4 6-30 6-34 0z" />
      <path d="M15 25c6 3 12 3 18 0" />
      <path d="M33 25l4 5M31 26l3 6" />
    </>
  ),
  // a hunting knife, blade pointing up and to the right
  knife: (
    <>
      <path d="M39 7C33 9 27 16 21 23l5 5c7-6 12-13 13-21z" />
      <path d="M19 22l9 9" />
      <path d="M22 28l-8 9-4-4 8-9" />
      <circle cx="14.5" cy="33.5" r="1" />
    </>
  ),
  // a six-shooter, side on
  colt: (
    <>
      <path d="M5 15h22v6H5zM9 15l-2-3h6" />
      <circle cx="30" cy="19" r="5.5" />
      <path d="M33 24l5 14-7 3-3-12M36 15l5-3 1 8" />
      <path d="M26 25c0 6 5 6 5 0" />
    </>
  ),
  // a torn WANTED poster with a skull
  wanted: (
    <>
      <path d="M10 8l9 2 9-2 9 3-2 6 3 6-2 6 2 8-9 2-9-2-9 2-3-6 2-6-2-6 3-7z" />
      <path d="M16 15h16" />
      <circle cx="24" cy="25" r="5" />
      <path d="M22 24.5h.01M26 24.5h.01M22.5 30l.5 3M25.5 30l-.5 3M16 36h16" />
    </>
  ),
  // an oil lantern with a flame
  lamp: (
    <>
      <path d="M18 12c0-8 12-8 12 0" />
      <path d="M15 12h18l-3 5H18z" />
      <path d="M18 17l-3 18h18l-3-18" />
      <path d="M24 21c-4 4-3 10 0 10s4-6 0-10z" />
      <path d="M13 35h22v4H13z" />
    </>
  ),
}

// A bat is a solid shape, so it is filled rather than outlined.
function Bat() {
  return (
    <path
      fill="currentColor"
      stroke="none"
      d="M24 14l3-5 1 7c4-2 10-2 16 2-4 1-6 4-6 8-3-3-6-3-8 1-2-3-4-3-6 2-2-5-4-5-6-2-2-4-5-4-8-1 0-4-2-7-6-8 6-4 12-4 16-2l1-7z"
    />
  )
}

export function AvatarIconArt({ id, size }: { id: string; size: number }) {
  const art = ICON_PATHS[id]
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {id === 'bat' ? <Bat /> : art}
    </svg>
  )
}
