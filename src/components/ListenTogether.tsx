import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'

// "Listen together": one phone hosts a song, the others join with a 4-letter code and hear the same song in sync.
// The song travels straight from the host's phone to each listener (WebRTC), nothing is uploaded to a server, and
// everything is gone when the app closes. Supabase Realtime is only used to pass the small hello/connection/play
// messages between the phones.

type Track = { id: string; name: string; url: string }
type Msg = { to?: string; from: string; type: string; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit; st?: SyncState }
type SyncState = { track: string; playing: boolean; pos: number }

const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const CHUNK = 16 * 1024
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')
const newId = () => Math.random().toString(36).slice(2, 10)

type Mode = 'idle' | 'host' | 'guest'

export default function ListenTogether({ getAudio, current }: { getAudio: () => HTMLAudioElement | null; current: Track | undefined }) {
  const [mode, setMode] = useState<Mode>('idle')
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [listeners, setListeners] = useState(0)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [needTap, setNeedTap] = useState(false)

  const me = useRef(newId())
  const channel = useRef<RealtimeChannel | null>(null)
  const peers = useRef<Map<string, { pc: RTCPeerConnection; dc?: RTCDataChannel }>>(new Map())
  const modeRef = useRef<Mode>('idle')
  const currentRef = useRef(current)
  currentRef.current = current
  const guestAudio = useRef<HTMLAudioElement | null>(null)
  const guestUrl = useRef('')
  const guestTrack = useRef('')
  const pending = useRef<SyncState | null>(null)

  const send = useCallback((m: Omit<Msg, 'from'>) => {
    void channel.current?.send({ type: 'broadcast', event: 'm', payload: { ...m, from: me.current } })
  }, [])

  const stop = useCallback(() => {
    modeRef.current = 'idle'
    peers.current.forEach((p) => { try { p.dc?.close(); p.pc.close() } catch { /* already closed */ } })
    peers.current.clear()
    if (channel.current) void supabase.removeChannel(channel.current)
    channel.current = null
    if (guestAudio.current) { guestAudio.current.pause(); guestAudio.current.removeAttribute('src') }
    if (guestUrl.current) URL.revokeObjectURL(guestUrl.current)
    guestUrl.current = ''
    guestTrack.current = ''
    pending.current = null
    setMode('idle'); setCode(''); setListeners(0); setStatus(''); setProgress(0); setTitle(''); setNeedTap(false)
  }, [])

  useEffect(() => stop, [stop])

  // ---------- host ----------

  const sendFile = useCallback(async (dc: RTCDataChannel) => {
    const t = currentRef.current
    if (!t || dc.readyState !== 'open') return
    const blob = await (await fetch(t.url)).blob()
    dc.bufferedAmountLowThreshold = CHUNK * 8
    dc.send(JSON.stringify({ k: 'file', id: t.id, name: t.name, size: blob.size, mime: blob.type }))
    for (let off = 0; off < blob.size; off += CHUNK) {
      if (dc.readyState !== 'open') return
      if (dc.bufferedAmount > CHUNK * 32) await new Promise<void>((r) => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; r() } })
      dc.send(await blob.slice(off, off + CHUNK).arrayBuffer())
    }
    dc.send(JSON.stringify({ k: 'end', id: t.id }))
  }, [])

  const hostState = useCallback((): SyncState | null => {
    const a = getAudio()
    const t = currentRef.current
    if (!a || !t) return null
    return { track: t.id, playing: !a.paused, pos: a.currentTime }
  }, [getAudio])

  const broadcastState = useCallback(() => {
    const st = hostState()
    if (st && modeRef.current === 'host') send({ type: 'state', st })
  }, [hostState, send])

  const addGuest = useCallback(async (guest: string) => {
    peers.current.get(guest)?.pc.close()
    const pc = new RTCPeerConnection(ICE)
    const dc = pc.createDataChannel('f')
    peers.current.set(guest, { pc, dc })
    pc.onicecandidate = (e) => { if (e.candidate) send({ to: guest, type: 'ice', ice: e.candidate.toJSON() }) }
    dc.onopen = () => {
      setListeners([...peers.current.values()].filter((p) => p.dc?.readyState === 'open').length)
      void sendFile(dc)
      broadcastState()
    }
    dc.onclose = () => setListeners([...peers.current.values()].filter((p) => p.dc?.readyState === 'open').length)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ to: guest, type: 'offer', sdp: offer })
  }, [broadcastState, send, sendFile])

  const startHost = () => {
    if (!current) return
    const c = newCode()
    modeRef.current = 'host'
    setMode('host'); setCode(c); setStatus('Waiting for friends to join…')
    const ch = supabase.channel(`listen-${c}`, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      const m = payload as Msg
      if (m.type === 'hello') void addGuest(m.from)
      else if (m.to === me.current && m.type === 'answer' && m.sdp) void peers.current.get(m.from)?.pc.setRemoteDescription(m.sdp)
      else if (m.to === me.current && m.type === 'ice' && m.ice) void peers.current.get(m.from)?.pc.addIceCandidate(m.ice).catch(() => {})
    })
    channel.current = ch.subscribe()
  }

  // Keep listeners in step with the host's player.
  useEffect(() => {
    if (mode !== 'host') return
    const a = getAudio()
    if (!a) return
    const on = () => broadcastState()
    a.addEventListener('play', on)
    a.addEventListener('pause', on)
    a.addEventListener('seeked', on)
    const beat = window.setInterval(on, 4000)
    return () => {
      a.removeEventListener('play', on)
      a.removeEventListener('pause', on)
      a.removeEventListener('seeked', on)
      window.clearInterval(beat)
    }
  }, [mode, getAudio, broadcastState])

  // A different song on the host: send it to everyone.
  useEffect(() => {
    if (mode !== 'host' || !current) return
    peers.current.forEach((p) => { if (p.dc) void sendFile(p.dc) })
    broadcastState()
  }, [mode, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- guest ----------

  const applyState = useCallback((st: SyncState) => {
    const a = guestAudio.current
    if (!a || guestTrack.current !== st.track) { pending.current = st; return }
    const target = st.pos + 0.15
    if (Math.abs(a.currentTime - target) > 0.5) a.currentTime = target
    if (st.playing && a.paused) void a.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true))
    else if (!st.playing && !a.paused) a.pause()
  }, [])

  const startGuest = () => {
    const c = typed.trim().toUpperCase()
    if (c.length !== 4) { setStatus('Enter the 4-letter code.'); return }
    modeRef.current = 'guest'
    setMode('guest'); setCode(c); setStatus('Connecting…')
    if (!guestAudio.current) guestAudio.current = new Audio()
    const ga = guestAudio.current
    ga.src = '' // the join tap lets this element play later
    void ga.play().catch(() => {})
    const ch = supabase.channel(`listen-${c}`, { config: { broadcast: { self: false } } })
    let pc: RTCPeerConnection | null = null
    let meta: { id: string; name: string; size: number; mime: string } | null = null
    let parts: ArrayBuffer[] = []
    let got = 0
    ch.on('broadcast', { event: 'm' }, async ({ payload }) => {
      const m = payload as Msg
      if (m.type === 'state' && m.st) { applyState(m.st); return }
      if (m.to !== me.current) return
      if (m.type === 'offer' && m.sdp) {
        pc?.close()
        pc = new RTCPeerConnection(ICE)
        peers.current.set(m.from, { pc })
        pc.onicecandidate = (e) => { if (e.candidate) send({ to: m.from, type: 'ice', ice: e.candidate.toJSON() }) }
        pc.ondatachannel = (e) => {
          const dc = e.channel
          dc.binaryType = 'arraybuffer'
          dc.onopen = () => setStatus('Connected. Getting the song…')
          dc.onmessage = (ev) => {
            if (typeof ev.data === 'string') {
              const j = JSON.parse(ev.data) as { k: string; id: string; name?: string; size?: number; mime?: string }
              if (j.k === 'file') {
                meta = { id: j.id, name: j.name ?? 'Song', size: j.size ?? 0, mime: j.mime ?? 'audio/mpeg' }
                parts = []; got = 0
                setTitle(meta.name); setProgress(0); setStatus('Getting the song…')
              } else if (j.k === 'end' && meta) {
                const url = URL.createObjectURL(new Blob(parts, { type: meta.mime }))
                if (guestUrl.current) URL.revokeObjectURL(guestUrl.current)
                guestUrl.current = url
                guestTrack.current = meta.id
                ga.src = url
                setProgress(1); setStatus('Listening together')
                if (pending.current) applyState(pending.current)
              }
            } else if (meta) {
              parts.push(ev.data as ArrayBuffer)
              got += (ev.data as ArrayBuffer).byteLength
              if (meta.size) setProgress(got / meta.size)
            }
          }
        }
        await pc.setRemoteDescription(m.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({ to: m.from, type: 'answer', sdp: answer })
      } else if (m.type === 'ice' && m.ice) {
        await pc?.addIceCandidate(m.ice).catch(() => {})
      }
    })
    channel.current = ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        send({ type: 'hello' })
        window.setTimeout(() => { if (modeRef.current === 'guest' && !guestTrack.current) setStatus('Still looking for that code… check it and the host being online.') }, 12000)
      }
    })
  }

  const tapPlay = () => { void guestAudio.current?.play().then(() => setNeedTap(false)).catch(() => {}) }

  const box = 'rounded-2xl border border-line bg-surface p-4'
  if (mode === 'host') {
    return (
      <div className={`${box} text-center`}>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Listening together</div>
        <div className="my-2 text-4xl font-extrabold tracking-[0.3em] text-[var(--accent-text)]">{code}</div>
        <p className="text-sm text-muted">Friends open Music, type this code and tap Join.</p>
        <p className="mt-1 text-sm font-semibold">{listeners ? `${listeners} listening` : status}</p>
        <button className="btn btn-plain mt-3" onClick={stop}>Stop</button>
      </div>
    )
  }
  if (mode === 'guest') {
    return (
      <div className={`${box} text-center`}>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Room {code}</div>
        <div className="mt-1 truncate text-lg font-bold">{title || 'Waiting for the host…'}</div>
        {progress > 0 && progress < 1 && (
          <div className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--line)]">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <p className="mt-2 text-sm text-muted">{status}</p>
        {needTap && <button className="btn btn-primary mt-3" onClick={tapPlay}>Tap to play</button>}
        <div><button className="btn btn-plain mt-3" onClick={stop}>Leave</button></div>
      </div>
    )
  }
  return (
    <div className={box}>
      <div className="font-semibold">Listen together</div>
      <p className="mb-3 text-sm text-muted">Play a song on everyone’s phone at once. Nothing is saved or uploaded.</p>
      <button className="btn btn-primary w-full" disabled={!current} onClick={startHost}>
        {current ? `Host “${current.name}”` : 'Pick a song to host'}
      </button>
      <div className="mt-3 flex gap-2">
        <input className="input !w-28 text-center font-bold uppercase tracking-widest" maxLength={4} placeholder="CODE" value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^a-zA-Z]/g, ''))} aria-label="Room code" />
        <button className="btn btn-plain flex-1" onClick={startGuest}>Join</button>
      </div>
      {status && <p className="mt-2 text-sm text-danger">{status}</p>}
    </div>
  )
}
