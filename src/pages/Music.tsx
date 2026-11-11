import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { useBackClose } from '../lib/backStack'
import ListenTogether from '../components/ListenTogether'
import Fold from '../components/Fold'
import YouTubeLinks, { type NowPlaying } from '../components/YouTubeLinks'

type Track = { id: string; name: string; url: string }

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const svg = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const
const PlayI = () => <svg {...svg} width={30} height={30}><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
const PauseI = () => <svg {...svg} width={30} height={30}><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>
const PrevI = () => <svg {...svg}><rect x="5" y="5" width="2.4" height="14" rx="1" /><path d="M19 6.2v11.6a.8.8 0 0 1-1.24.67L9.4 12.67a.8.8 0 0 1 0-1.34l8.36-5.8A.8.8 0 0 1 19 6.2Z" /></svg>
const NextI = () => <svg {...svg}><rect x="16.6" y="5" width="2.4" height="14" rx="1" /><path d="M5 6.2v11.6a.8.8 0 0 0 1.24.67l8.36-5.8a.8.8 0 0 0 0-1.34L6.24 5.53A.8.8 0 0 0 5 6.2Z" /></svg>
const ShuffleI = () => <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
const RepeatI = () => <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
const NoteI = () => <svg {...svg} width={64} height={64}><path d="M9 17.5V6.6a1 1 0 0 1 .77-.97l8-1.9A1 1 0 0 1 19 4.7V15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /><circle cx="6.5" cy="17.5" r="2.7" /><circle cx="16.5" cy="15" r="2.7" /></svg>

const ctl = 'grid h-11 w-11 place-items-center rounded-full text-[var(--ink)] transition active:scale-90'

// Secret screen: pick audio files from the phone and play them. Files stay on the device
// (played via object URLs), nothing is uploaded.
export default function Music() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [index, setIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [yt, setYt] = useState<NowPlaying | null>(null)
  const [halt, setHalt] = useState(0)
  const [libOpen, setLibOpen] = useState(false)
  useBackClose(() => setLibOpen(false), libOpen)
  const swipe = useRef<{ y: number; x: number } | null>(null)
  // The picture square is a two-page strip: page 1 = cover (or the YouTube video), page 2 = Join room + YouTube link.
  const slot = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const goSlide = (i: number) => { const el = slot.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }) }
  const audioRef = useRef<HTMLAudioElement>(null)
  const tracksRef = useRef<Track[]>([])
  tracksRef.current = tracks

  useEffect(() => () => tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url)), [])

  const pick = (files: FileList | null) => {
    if (!files) return
    const added = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(f),
    }))
    setTracks((prev) => [...prev, ...added])
    if (index === null && added.length) setIndex(tracks.length)
  }

  const current = index !== null ? tracks[index] : undefined
  const pickYt = (n: NowPlaying | null) => { setYt(n); if (n) goSlide(0) }

  useEffect(() => {
    const a = audioRef.current
    if (!a || !current) return
    a.src = current.url
    setTime(0)
    void a.play().catch(() => setPlaying(false))
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: current.name, artist: 'Cznnect' })
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const a = audioRef.current
    if (!a || !current) return
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }
  const step = (d: number) => {
    const n = tracks.length
    if (!n) return
    if (shuffle && n > 1) {
      setIndex((i) => { let r = i ?? 0; while (r === i) r = Math.floor(Math.random() * n); return r })
      return
    }
    setIndex((i) => (((i ?? 0) + d) % n + n) % n)
  }
  const onEnded = () => {
    const a = audioRef.current
    if (repeat && tracks.length <= 1 && a) { a.currentTime = 0; void a.play(); return }
    if (tracks.length > 1 && (repeat || shuffle || (index ?? 0) < tracks.length - 1)) step(1)
    else setPlaying(false)
  }
  const remove = (i: number) => {
    const t = tracks[i]
    URL.revokeObjectURL(t.url)
    const next = tracks.filter((_, k) => k !== i)
    setTracks(next)
    if (index === null) return
    if (i === index) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.removeAttribute('src')
      setPlaying(false); setTime(0); setDuration(0)
      setIndex(next.length ? Math.min(i, next.length - 1) : null)
    } else if (i < index) setIndex(index - 1)
  }

  const pct = duration ? (time / duration) * 100 : 0

  // Swiping up on the player (or tapping the bar under it) opens the library panel; swiping down on its handle closes it.
  const onDown = (e: React.PointerEvent) => { swipe.current = { y: e.clientY, x: e.clientX } }
  const onUp = (e: React.PointerEvent, dir: 'up' | 'down') => {
    const g = swipe.current
    swipe.current = null
    if (!g) return
    const dy = e.clientY - g.y
    const dx = e.clientX - g.x
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      if (dir === 'up' && dy < 0) setLibOpen(true)
      if (dir === 'down' && dy > 0) setLibOpen(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center gap-4">
      <audio ref={audioRef} onPlay={() => { setPlaying(true); setHalt((h) => h + 1) }} onPause={() => setPlaying(false)} onEnded={onEnded}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />

      <div className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" onPointerDown={onDown} onPointerUp={(e) => onUp(e, 'up')}>
        <div ref={slot} onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid h-64 w-full shrink-0 snap-start place-items-center snap-always">
        {yt ? (
          // A YouTube link plays right here, in the big player picture's place.
          <div className="mx-auto w-full overflow-hidden rounded-2xl bg-black" style={{ boxShadow: '0 12px 32px -12px var(--accent)' }}>
            <iframe
              key={yt.key}
              title={yt.title}
              src={yt.kind === 'list'
                ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(yt.id)}&playsinline=1&autoplay=1`
                : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.id)}?playsinline=1&autoplay=1`}
              className="aspect-video w-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="mx-auto grid aspect-square w-full max-w-[16rem] place-items-center overflow-hidden rounded-2xl text-[var(--accent-ink)]"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-text))', boxShadow: '0 12px 32px -12px var(--accent)' }}>
            <div className={playing ? 'animate-pulse' : ''}><NoteI /></div>
          </div>
        )}
          </div>
          {/* Page 2: Listen together (host / join a room) and the YouTube link. Stays mounted so a room you host keeps going. */}
          <div className="h-64 w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-contain" aria-hidden={slide !== 1} data-no-swipe>
            <div className="space-y-3 pb-1">
              <ListenTogether getAudio={() => audioRef.current} current={current} yt={yt} />
              <Fold title="YouTube link" status={yt ? yt.title : 'Paste a link to play'}>
                <YouTubeLinks onStart={() => audioRef.current?.pause()} onNow={pickYt} halt={halt} />
              </Fold>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1" role="tablist" aria-label="Cover or Join room and YouTube link">
          {(['Cover', 'Join room and YouTube link'] as const).map((label, i) => (
            <button key={label} type="button" role="tab" aria-selected={slide === i} aria-label={label} onClick={() => goSlide(i)} className="grid h-7 w-7 place-items-center">
              <span className={`h-2 rounded-full transition-all ${slide === i ? 'w-5 bg-[var(--accent)]' : 'w-2 bg-[var(--line)]'}`} />
            </button>
          ))}
        </div>

        <div className="touch-none">
        <div className="mt-5 text-center">
          <div className="truncate text-lg font-bold">{yt ? yt.title : current ? current.name : 'Nothing playing'}</div>
          <div className="text-sm text-muted">{yt ? 'YouTube' : current ? `Song ${(index ?? 0) + 1} of ${tracks.length}` : 'Add some songs to begin'}</div>
        </div>

        <div className="mt-4">
          <input type="range" aria-label="Seek" disabled={!current} min={0} max={duration || 0} step={0.1} value={time}
            onChange={(e) => { const v = Number(e.target.value); setTime(v); if (audioRef.current) audioRef.current.currentTime = v }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-40"
            style={{ accentColor: 'var(--accent)', background: `linear-gradient(to right, var(--accent) ${pct}%, var(--line) ${pct}%)` }} />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted"><span>{fmt(time)}</span><span>{fmt(duration)}</span></div>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <button aria-label="Shuffle" aria-pressed={shuffle} onClick={() => setShuffle((s) => !s)} className={`${ctl} ${shuffle ? 'text-[var(--accent-text)]' : 'opacity-50'}`}><ShuffleI /></button>
          <button aria-label="Previous" onClick={() => step(-1)} disabled={!tracks.length} className={ctl}><PrevI /></button>
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} disabled={!current}
            className="grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-lg transition active:scale-90 disabled:opacity-40">
            {playing ? <PauseI /> : <PlayI />}
          </button>
          <button aria-label="Next" onClick={() => step(1)} disabled={!tracks.length} className={ctl}><NextI /></button>
          <button aria-label="Repeat" aria-pressed={repeat} onClick={() => setRepeat((r) => !r)} className={`${ctl} ${repeat ? 'text-[var(--accent-text)]' : 'opacity-50'}`}><RepeatI /></button>
        </div>
        </div>
      </div>

      <button type="button" onClick={() => setLibOpen(true)} aria-haspopup="dialog" className="mx-auto flex flex-col items-center gap-1 px-6 py-2 text-sm font-semibold text-muted">
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[var(--line)]" />
        Songs
        <span aria-hidden="true" className="rotate-180"><Icon name="chevronDown" size={22} /></span>
      </button>

      {/* The library panel stays mounted (just out of sight) so a room you host or a link that is playing carries on while it is closed. */}
      <div className={`fixed inset-0 z-[60] ${libOpen ? '' : 'pointer-events-none'}`} aria-hidden={!libOpen}>
        <button type="button" aria-label="Close" tabIndex={libOpen ? 0 : -1} onClick={() => setLibOpen(false)}
          className={`absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-200 ${libOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div role="dialog" aria-modal="true" aria-label="Music library"
          className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[86dvh] max-w-xl flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-2xl transition-transform duration-300 ease-out ${libOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="touch-none px-4 pb-2 pt-3" data-no-swipe onPointerDown={onDown} onPointerUp={(e) => onUp(e, 'down')}>
            <button type="button" aria-label="Close library" onClick={() => setLibOpen(false)} className="mx-auto block h-1.5 w-12 rounded-full bg-[var(--line)]" />
            <p className="mt-2 text-center font-display text-base font-extrabold">Library</p>
          </div>
          <div className="space-y-4 overflow-y-auto px-4 pb-[calc(max(1.25rem,env(safe-area-inset-bottom))+3.5rem)]">
      <label className="block cursor-pointer rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-center text-sm font-semibold text-[var(--accent-text)] transition active:scale-[0.98]">
        + Add songs from your phone
        <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </label>

      {tracks.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {tracks.map((t, i) => {
            const on = i === index
            return (
              <li key={t.id} className={`flex items-center border-b border-line last:border-b-0 ${on ? 'bg-[var(--accent-soft)]' : ''}`}>
                <button onClick={() => (on ? toggle() : setIndex(i))} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                  <span className="grid h-6 w-6 shrink-0 place-items-center text-xs tabular-nums text-muted">
                    {on && playing ? (
                      <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
                        {[0, 1, 2].map((b) => <span key={b} className="w-[3px] animate-pulse rounded-sm bg-[var(--accent)]" style={{ height: `${55 + b * 22}%`, animationDelay: `${b * 140}ms` }} />)}
                      </span>
                    ) : i + 1}
                  </span>
                  <span className={`truncate ${on ? 'font-semibold text-[var(--accent-text)]' : ''}`}>{t.name}</span>
                </button>
                <button aria-label={`Remove ${t.name}`} onClick={() => remove(i)} className="px-4 py-3 text-lg leading-none text-muted">×</button>
              </li>
            )
          })}
        </ul>
      )}

          </div>
        </div>
      </div>
    </div>
  )
}
