import { useState } from 'react'
import { supabase } from '../supabase'
import Sheet from './Sheet'
import { friendlyError } from '../lib/offline'

// One message, sent to everyone in the family as a notification. There are no personal messages.
export default function MessageSheet({ familyId, onClose }: { familyId: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [sent, setSent] = useState(false)

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('send-push', { body: { body: text, family_id: familyId } })
      if (data?.error) throw new Error(data.error)
      if (error) throw error
      setSent(true)
      setNotice(data?.sent ? `Sent to ${data.sent} ${data.sent === 1 ? 'phone' : 'phones'}.` : 'Sent. Nobody else has notifications turned on yet.')
      setText('')
    } catch (e) {
      setNotice(friendlyError(e, 'Could not send the message. Check your connection and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Message everyone" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">This goes to everyone in your family as a notification. It is not a private message.</p>
        <label className="label" htmlFor="family-message">Message</label>
        <textarea id="family-message" className="input min-h-24" maxLength={200} value={text} onChange={(e) => { setText(e.target.value); setSent(false) }} placeholder="Who is coming on Friday?" />
        <div className="flex items-center justify-between text-xs text-muted">
          <span role="status">{notice}</span>
          <span>{text.length}/200</span>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => void send()}>
          {busy ? 'Sending…' : sent ? 'Send another' : 'Send to everyone'}
        </button>
      </div>
    </Sheet>
  )
}
