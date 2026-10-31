// The hidden music player's engine. Songs are picked from the phone and kept on the phone (IndexedDB), never
// uploaded anywhere. One audio element lives here, outside every screen, so the music keeps playing after the
// player sheet is closed. Screens read the state with useSyncExternalStore(subscribe, getState).

export type Track = { id: string; name: string; size: number; added: number }
export type Repeat = 'off' | 'all' | 'one'
export type MusicState = {
  ready: boolean // the saved library has been read
  tracks: Track[]
  index: number // the loaded song, or -1 when none is chosen yet
  playing: boolean
  time: number
  duration: number
  shuffle: boolean
  repeat: Repeat
  busy: boolean // songs are being added
  error: string
}

// ---------- state ----------

const PREFS_KEY = 'cznnect-music-prefs'

function readPrefs(): { shuffle: boolean; repeat: Repeat } {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { shuffle?: unknown; repeat?: unknown }
      return { shuffle: p.shuffle === true, repeat: p.repeat === 'off' || p.repeat === 'one' ? p.repeat : 'all' }
    }
  } catch {
    // Storage can be blocked. The defaults are fine.
  }
  return { shuffle: false, repeat: 'all' }
}

function writePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ shuffle: state.shuffle, repeat: state.repeat }))
  } catch {
    // The choice still holds for this visit.
  }
}

let state: MusicState = {
  ready: false,
  tracks: [],
  index: -1,
  playing: false,
  time: 0,
  duration: 0,
  shuffle: false,
  repeat: 'all',
  busy: false,
  error: '',
}
const listeners = new Set<() => void>()

function set(patch: Partial<MusicState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getState(): MusicState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ---------- the saved library (IndexedDB: a small list of songs, and the songs' own bytes kept apart) ----------

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open('cznnect-music', 1)
      open.onupgradeneeded = () => {
        open.result.createObjectStore('meta', { keyPath: 'id' })
        open.result.createObjectStore('blobs')
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => {
        dbPromise = null
        reject(open.error)
      }
    })
  }
  return dbPromise
}

function result<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function readTracks(): Promise<Track[]> {
  const db = await openDb()
  const all = (await result(db.transaction('meta', 'readonly').objectStore('meta').getAll())) as Track[]
  return all.sort((a, b) => a.added - b.added || a.name.localeCompare(b.name))
}

async function readBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  return (await result(db.transaction('blobs', 'readonly').objectStore('blobs').get(id))) as Blob | undefined
}

async function saveOne(file: File, seq: number): Promise<Track> {
  const db = await openDb()
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const track: Track = { id, name: titleOf(file.name), size: file.size, added: Date.now() + seq }
  const tx = db.transaction(['meta', 'blobs'], 'readwrite')
  tx.objectStore('blobs').put(file, id)
  tx.objectStore('meta').put(track)
  await finished(tx)
  return track
}

async function deleteOne(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['meta', 'blobs'], 'readwrite')
  tx.objectStore('blobs').delete(id)
  tx.objectStore('meta').delete(id)
  await finished(tx)
}

// ---------- helpers ----------

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba|webm|mp4)$/i

function isAudio(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name)
}

// "Night_walk - Intro.mp3" becomes "Night walk - Intro".
function titleOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Untitled'
}

// ---------- playback ----------

let audio: HTMLAudioElement | null = null
let url = ''
let loadToken = 0

function getAudio(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'auto'
  a.addEventListener('play', () => set({ playing: true }))
  a.addEventListener('pause', () => set({ playing: false }))
  a.addEventListener('timeupdate', () => set({ time: a.currentTime }))
  a.addEventListener('loadedmetadata', () => set({ duration: Number.isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('durationchange', () => set({ duration: Number.isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('ended', onEnded)
  a.addEventListener('error', () => {
    if (a.getAttribute('src')) set({ playing: false, error: 'That song could not be played on this phone.' })
  })
  audio = a
  bindMediaSession()
  return a
}

// Lock-screen and headset controls, where the browser offers them.
function bindMediaSession() {
  if (!('mediaSession' in navigator)) return
  const actions: [MediaSessionAction, () => void][] = [
    ['play', () => void play()],
    ['pause', () => pause()],
    ['previoustrack', () => prev()],
    ['nexttrack', () => next()],
  ]
  for (const [name, fn] of actions) {
    try {
      navigator.mediaSession.setActionHandler(name, fn)
    } catch {
      // This action is not supported here.
    }
  }
}

function describe(t: Track) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: 'Cznnect' })
  } catch {
    // Not important.
  }
}

// Load the song at `index`, and start it if asked.
async function load(index: number, autoplay: boolean): Promise<void> {
  const t = state.tracks[index]
  if (!t) return
  const a = getAudio()
  const mine = ++loadToken
  set({ index, time: 0, duration: 0, error: '' })
  let blob: Blob | undefined
  try {
    blob = await readBlob(t.id)
  } catch {
    blob = undefined
  }
  if (mine !== loadToken) return // another song was chosen in the meantime
  if (!blob) {
    set({ error: 'That song is missing from this phone.', playing: false })
    return
  }
  if (url) URL.revokeObjectURL(url)
  url = URL.createObjectURL(blob)
  a.src = url
  describe(t)
  if (autoplay) {
    try {
      await a.play()
    } catch {
      set({ playing: false })
    }
  }
}

function advance(forward: boolean, auto: boolean) {
  const n = state.tracks.length
  if (!n) return
  let i = state.index < 0 ? 0 : state.index
  if (state.shuffle && n > 1) {
    do {
      i = Math.floor(Math.random() * n)
    } while (i === state.index)
  } else if (forward) {
    i += 1
    if (i >= n) {
      if (auto && state.repeat === 'off') {
        // The end of the list with repeat off: stop, and wait on the first song.
        getAudio().pause()
        void load(0, false)
        return
      }
      i = 0
    }
  } else {
    i -= 1
    if (i < 0) i = n - 1
  }
  void load(i, true)
}

function onEnded() {
  const a = getAudio()
  if (state.repeat === 'one') {
    a.currentTime = 0
    void a.play().catch(() => set({ playing: false }))
    return
  }
  advance(true, true)
}

// ---------- what the screens can do ----------

let started = false

// Read the saved library and the saved choices. Safe to call every time the player opens.
export async function initMusic(): Promise<void> {
  if (started) return
  started = true
  const prefs = readPrefs()
  try {
    const tracks = await readTracks()
    set({ ...prefs, tracks, ready: true })
    if (tracks.length && state.index < 0) void load(0, false)
  } catch {
    set({ ...prefs, ready: true, error: 'Music cannot be saved in this browser.' })
  }
}

export async function addFiles(files: FileList | File[]): Promise<void> {
  const picked = Array.from(files).filter(isAudio)
  if (!picked.length) {
    set({ error: 'Pick audio files, such as MP3 or M4A.' })
    return
  }
  set({ busy: true, error: '' })
  const added: Track[] = []
  let failed = 0
  let full = false
  for (let i = 0; i < picked.length; i++) {
    try {
      added.push(await saveOne(picked[i], i))
    } catch (e) {
      failed += 1
      if (e instanceof DOMException && e.name === 'QuotaExceededError') full = true
    }
  }
  const tracks = [...state.tracks, ...added]
  set({
    tracks,
    busy: false,
    error: full ? 'This phone is out of space for more songs.' : failed ? `${failed} song${failed > 1 ? 's' : ''} could not be saved.` : '',
  })
  if (state.index < 0 && tracks.length) void load(0, false)
}

export async function play(): Promise<void> {
  if (!state.tracks.length) return
  if (state.index < 0) {
    await load(0, true)
    return
  }
  const a = getAudio()
  if (!a.getAttribute('src')) {
    await load(state.index, true)
    return
  }
  try {
    await a.play()
  } catch {
    set({ playing: false })
  }
}

export function pause(): void {
  getAudio().pause()
}

export function toggle(): void {
  if (state.playing) pause()
  else void play()
}

export function playIndex(i: number): void {
  if (i === state.index && audio && audio.getAttribute('src')) {
    toggle()
    return
  }
  void load(i, true)
}

export function next(): void {
  advance(true, false)
}

export function prev(): void {
  const a = getAudio()
  if (a.currentTime > 3) {
    a.currentTime = 0
    return
  }
  advance(false, false)
}

export function seek(seconds: number): void {
  const a = getAudio()
  if (a.getAttribute('src') && Number.isFinite(seconds)) a.currentTime = Math.max(0, seconds)
}

export function setShuffle(on: boolean): void {
  set({ shuffle: on })
  writePrefs()
}

export function cycleRepeat(): void {
  set({ repeat: state.repeat === 'all' ? 'one' : state.repeat === 'one' ? 'off' : 'all' })
  writePrefs()
}

export async function removeTrack(id: string): Promise<void> {
  const i = state.tracks.findIndex((t) => t.id === id)
  if (i < 0) return
  try {
    await deleteOne(id)
  } catch {
    set({ error: 'That song could not be removed.' })
    return
  }
  const tracks = state.tracks.filter((t) => t.id !== id)
  if (i === state.index) {
    loadToken += 1
    const a = getAudio()
    a.pause()
    a.removeAttribute('src')
    a.load()
    if (url) URL.revokeObjectURL(url)
    url = ''
    const index = tracks.length ? Math.min(i, tracks.length - 1) : -1
    set({ tracks, index: -1, playing: false, time: 0, duration: 0 })
    if (index >= 0) void load(index, false)
  } else {
    set({ tracks, index: i < state.index ? state.index - 1 : state.index })
  }
}
