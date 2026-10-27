import { useId } from 'react'

// The Thief's End emblem: a worn pirate coin with a bandana skull over crossed bones inside a ring of beads.
// With legend, the old motto and the name run round the rim; at small sizes the rim stays plain so it reads cleanly.
// Colours come from --coin-bg and --coin-fg (see the Thief's End theme in index.css).
export default function CoinMark({ className = '', legend = false }: { className?: string; legend?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bg = 'var(--coin-bg, #17110a)'
  const fg = 'var(--coin-fg, #ead9a8)'
  // One bone lying flat; the two copies below are turned to cross.
  const bone = (
    <>
      <path d="M28 62H72" strokeWidth="6.4" strokeLinecap="round" />
      <circle cx="25" cy="59.2" r="3.5" stroke="none" />
      <circle cx="25" cy="64.8" r="3.5" stroke="none" />
      <circle cx="75" cy="59.2" r="3.5" stroke="none" />
      <circle cx="75" cy="64.8" r="3.5" stroke="none" />
    </>
  )
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Cznnect" className={className}>
      <defs>
        {/* Rough edges and a few worn-away specks, like ink pressed into old metal. */}
        <filter id={`w${id}`} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 0 0 0 -4.15" result="specks" />
          <feComposite in="d" in2="specks" operator="in" />
        </filter>
        {legend && (
          <>
            <path id={`top${id}`} d="M 11.5 50 A 38.5 38.5 0 0 1 88.5 50" />
            <path id={`bot${id}`} d="M 9.6 50 A 40.4 40.4 0 0 0 90.4 50" />
          </>
        )}
      </defs>
      <circle cx="50" cy="50" r="49" fill={bg} />
      <g filter={`url(#w${id})`} fill={fg} stroke={fg}>
        <circle cx="50" cy="50" r="46.4" fill="none" strokeWidth="2.6" />
        <circle cx="50" cy="50" r={legend ? 29.5 : 41} fill="none" strokeWidth="0.8" opacity="0.7" />
        {/* The ring of beads. */}
        <circle cx="50" cy="50" r={legend ? 25 : 36} fill="none" strokeWidth="3.1" strokeLinecap="round" strokeDasharray={legend ? '0.01 4.36' : '0.01 6.28'} />
        {legend && (
          <g stroke="none" fontFamily="Cinzel, 'Trajan Pro', Georgia, serif" fontWeight="600" fontSize="9" letterSpacing="1.6" textAnchor="middle">
            <text><textPath href={`#top${id}`} startOffset="50%">SIC PARVIS MAGNA</textPath></text>
            <text fontSize="8.4"><textPath href={`#bot${id}`} startOffset="50%">· CZNNECT ·</textPath></text>
          </g>
        )}
        <g transform={legend ? 'translate(50 52) scale(0.68) translate(-50 -52)' : undefined}>
          {/* Crossed bones. */}
          <g transform="rotate(32 50 62)">{bone}</g>
          <g transform="rotate(-32 50 62)">{bone}</g>
          {/* The skull: cranium, jaw, then the dark features cut into it. */}
          <ellipse cx="50" cy="41" rx="19" ry="17" stroke="none" />
          <path d="M36 49 Q36 58 41 62 H59 Q64 58 64 49 Z" stroke="none" />
          <g fill={bg} stroke="none">
            <circle cx="42.5" cy="44" r="5" />
            <circle cx="57.5" cy="44" r="5" />
            <path d="M50 49.5 L46.6 56 H53.4 Z" />
          </g>
          <path d="M41.5 58.6H58.5M45.2 58.6V62M50 58.6V62M54.8 58.6V62" stroke={bg} strokeWidth="1.1" strokeLinecap="round" />
          {/* Bandana across the brow, with a knot and a hoop earring. */}
          <path d="M31.2 37.6 Q50 29.4 68.8 37.6" fill="none" stroke={bg} strokeWidth="5" />
          <g stroke="none">
            <circle cx="40" cy="34.7" r="0.95" />
            <circle cx="50" cy="32.9" r="0.95" />
            <circle cx="60" cy="34.7" r="0.95" />
          </g>
          <path d="M68 36 L75 33 M68.4 38 L74.6 41.4" fill="none" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="31" cy="51" r="3.1" fill="none" strokeWidth="1.5" />
        </g>
      </g>
    </svg>
  )
}
