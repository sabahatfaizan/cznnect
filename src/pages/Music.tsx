import { useEffect, useRef, useState } from 'react'

type Track = { id: string; name: string; url: string }

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Secret screen: pick audio files from the phone and play them. Files stay on the device
// (played via object URLs), nothing is uploaded.
export default function Music() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [index, setIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
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

  useEffect(() => {
    const a = audioRef.current
    if (!a || !current) return
    a.src = current.url
    void a.play().catch(() => setPlaying(false))
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const a = audioRef.current
    if (!a || !current) return
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }
  const step = (d: number) => {
    if (!tracks.length) return
    setIndex((i) => (((i ?? 0) + d) % tracks.length + tracks.length) % tracks.length)
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => (tracks.length > 1 ? step(1) : setPlaying(false))}
      />

      <label className="block cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 text-center font-medium">
        Add songs from your phone
        <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </label>

      {current && (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="truncate font-semibold">{current.name}</div>
          <input
            type="range"
            aria-label="Seek"
            className="w-full"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value) }}
          />
          <div className="flex justify-between text-xs opacity-70"><span>{fmt(time)}</span><span>{fmt(duration)}</span></div>
          <div className="flex items-center justify-center gap-6 pt-1">
            <button aria-label="Previous" onClick={() => step(-1)} className="px-3 py-2 text-xl">⏮</button>
            <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} className="px-4 py-2 text-2xl">{playing ? '⏸' : '▶'}</button>
            <button aria-label="Next" onClick={() => step(1)} className="px-3 py-2 text-xl">⏭</button>
          </div>
        </div>
      )}

      {tracks.length === 0 ? (
        <p className="text-center text-sm opacity-70">No songs yet. Files stay on this device.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <button onClick={() => setIndex(i)} className={`w-full truncate px-4 py-3 text-left ${i === index ? 'font-semibold' : ''}`}>
                {i === index && playing ? '♪ ' : ''}{t.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
