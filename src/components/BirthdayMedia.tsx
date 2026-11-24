import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Media = { image_url: string; video_url: string; poster_url: string; caption: string }
const EMPTY: Media = { image_url: '', video_url: '', poster_url: '', caption: '' }
const BUCKET = 'birthday-media'
const MAX_VIDEO = 50 * 1024 * 1024
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the image.')), 'image/jpeg', 0.86))
}

async function photoBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('That picture could not be read.'))
      image.src = url
    })
    const scale = Math.min(1, 1200 / img.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the picture.')
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await canvasBlob(canvas)
  } finally { URL.revokeObjectURL(url) }
}

async function videoPoster(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Could not read that video. Try an MP4.'))
    })
    video.currentTime = Math.min(1, (video.duration || 2) / 2)
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      window.setTimeout(resolve, 2500)
    })
    const width = video.videoWidth || 1200
    const height = video.videoHeight || 675
    const scale = Math.min(1, 1200 / width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the video preview.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(0,0,0,.28)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const radius = Math.min(canvas.width, canvas.height) * .13
    context.beginPath()
    context.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2)
    context.fillStyle = 'rgba(255,255,255,.92)'
    context.fill()
    context.beginPath()
    context.moveTo(canvas.width / 2 - radius * .3, canvas.height / 2 - radius * .45)
    context.lineTo(canvas.width / 2 - radius * .3, canvas.height / 2 + radius * .45)
    context.lineTo(canvas.width / 2 + radius * .5, canvas.height / 2)
    context.closePath()
    context.fillStyle = '#101a36'
    context.fill()
    return await canvasBlob(canvas)
  } finally { URL.revokeObjectURL(url) }
}

export default function BirthdayMedia() {
  const [media, setMedia] = useState<Media>(EMPTY)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [testNotice, setTestNotice] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('birthday_media').select('image_url, video_url, poster_url, caption').eq('id', 1).maybeSingle()
    if (error) { setNotice('Run supabase/33_birthday_media.sql in Supabase first.'); return }
    const saved = (data as Media | null) ?? EMPTY
    setMedia(saved)
    setCaption(saved.caption)
  }, [])
  useEffect(() => { void load() }, [load])

  const upload = async (blob: Blob, filename: string, contentType: string) => {
    const path = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true })
    if (error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }
  const save = async (next: Media, message: string) => {
    const { error } = await supabase.from('birthday_media').upsert({ id: 1, ...next, updated_at: new Date().toISOString() })
    if (error) throw error
    setMedia(next)
    setCaption(next.caption)
    setNotice(message)
  }
  const work = async (task: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setNotice('')
    try { await task() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  const sendTestEmail = async () => {
    if (testBusy || busy) return
    setTestBusy(true)
    setTestNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('send-birthday-test', { body: {} })
      if (error) {
        const detail = data?.error || error.message
        throw new Error(detail || 'Could not send the test email.')
      }
      if (data?.error) throw new Error(data.error)
      setTestNotice(`Test email sent to ${data?.to ?? 'your account'}. Check your inbox and spam folder.`)
    } catch (error) {
      setTestNotice(error instanceof Error ? error.message : 'Could not send the test email.')
    } finally {
      setTestBusy(false)
    }
  }

  const choosePhoto = (file?: File) => file && void work(async () => {
    if (!file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG or WebP picture.')
    if (file.size > 20 * 1024 * 1024) throw new Error('That picture is over 20 MB.')
    const url = await upload(await photoBlob(file), 'birthday-photo.jpg', 'image/jpeg')
    await save({ ...media, image_url: url }, 'Photo added. It will appear in birthday emails.')
  })
  const chooseVideo = (file?: File) => file && void work(async () => {
    if (!VIDEO_TYPES.includes(file.type)) throw new Error('Choose an MP4, MOV or WebM video.')
    if (file.size > MAX_VIDEO) throw new Error('That video is over 50 MB.')
    const poster = await upload(await videoPoster(file), 'birthday-video-poster.jpg', 'image/jpeg')
    const video = await upload(file, file.name, file.type)
    await save({ ...media, video_url: video, poster_url: poster }, 'Video added. Birthday emails will link to it.')
  })

  return (
    <section className="flex flex-col gap-3" aria-label="Birthday email media">
      <div className="card flex flex-col gap-3">
        <p className="eyebrow">Preview delivery</p>
        <p className="text-sm text-muted">Send a private test to your owner account using the currently saved birthday photo, video preview and caption. This does not mark or send anyone’s birthday email.</p>
        <button type="button" className="btn btn-primary" disabled={busy || testBusy} onClick={() => void sendTestEmail()}>{testBusy ? 'Sending test…' : 'Send test birthday email'}</button>
        {testNotice && <p role="status" className="text-sm font-semibold">{testNotice}</p>}
      </div>
      <div className="card flex flex-col gap-3">
        <p className="eyebrow">Birthday photo</p>
        {media.image_url && <img src={media.image_url} alt="Birthday email photo" className="max-h-56 w-full rounded-xl object-cover" />}
        <input className="input !h-auto !py-2" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} aria-label="Choose a birthday photo" />
        {media.image_url && <button type="button" className="btn btn-plain" disabled={busy} onClick={() => void work(() => save({ ...media, image_url: '' }, 'Photo removed from future emails.'))}>Remove photo</button>}
      </div>
      <div className="card flex flex-col gap-3">
        <p className="eyebrow">Birthday video</p>
        {media.video_url && <video src={media.video_url} poster={media.poster_url || undefined} controls playsInline preload="none" className="max-h-64 w-full rounded-xl" />}
        <input className="input !h-auto !py-2" type="file" accept="video/mp4,video/quicktime,video/webm" disabled={busy} onChange={(event) => { chooseVideo(event.target.files?.[0]); event.target.value = '' }} aria-label="Choose a birthday video" />
        <p className="text-xs text-muted">MP4, MOV or WebM, up to 50 MB. Email apps show a preview with a play button; tapping it opens the video.</p>
        {media.video_url && <button type="button" className="btn btn-plain" disabled={busy} onClick={() => void work(() => save({ ...media, video_url: '', poster_url: '' }, 'Video removed from future emails.'))}>Remove video</button>}
      </div>
      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="birthday-email-caption">Caption (optional)</label>
        <input id="birthday-email-caption" className="input" maxLength={140} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="A little message from us" />
        <button type="button" className="btn btn-primary" disabled={busy || caption === media.caption} onClick={() => void work(() => save({ ...media, caption: caption.trim() }, 'Caption saved.'))}>Save caption</button>
        {notice && <p role="status" className="text-sm font-semibold">{notice}</p>}
        <p className="text-xs text-muted">The same photo and video are included in birthday emails until changed or removed.</p>
      </div>
    </section>
  )
}
