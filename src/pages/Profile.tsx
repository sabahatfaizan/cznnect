import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import { Icon, type IconName } from '../components/Icons'
import { AVATAR_COLORS, AVATAR_EMOJI, encodeAvatar, parseAvatar } from '../lib/avatars'

const BIO_MAX = 140

export default function Profile({ userId }: { userId: string }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [birthday, setBirthday] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(0)
  const [phone, setPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [share, setShare] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'avatar' | 'about' | 'contact' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      let r = await supabase.from('profiles').select('display_name, birthday, nickname, bio, avatar').eq('id', userId).single()
      // Older database without supabase/08_profile.sql: show the basics only.
      if (r.error) r = (await supabase.from('profiles').select('display_name, birthday').eq('id', userId).single()) as typeof r
      if (r.error) {
        setMsg({ kind: 'error', text: r.error.message })
        return
      }
      const d = r.data as { display_name: string; birthday: string | null; nickname?: string | null; bio?: string | null; avatar?: string | null }
      setName(d.display_name ?? '')
      setBirthday(d.birthday ?? '')
      setNickname(d.nickname ?? '')
      setBio(d.bio ?? '')
      const a = parseAvatar(d.avatar)
      if (a) {
        setEmoji(a.emoji)
        setColor(a.color)
      }
      const c = await supabase.from('profile_contacts').select('phone, contact_email, share_contact').eq('user_id', userId).maybeSingle()
      if (c.data) {
        setPhone(c.data.phone ?? '')
        setContactEmail(c.data.contact_email ?? '')
        setShare(!!c.data.share_contact)
      }
    })()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [userId])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const p = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        birthday: birthday || null,
        nickname: nickname.trim() || null,
        bio: bio.trim() || null,
        avatar: emoji ? encodeAvatar({ emoji, color }) : null,
      })
      .eq('id', userId)
    let error = p.error
    if (!error) {
      const c = await supabase.from('profile_contacts').upsert({
        user_id: userId,
        phone: phone.trim() || null,
        contact_email: contactEmail.trim() || null,
        share_contact: share,
        updated_at: new Date().toISOString(),
      })
      error = c.error
    }
    setBusy(false)
    setMsg(
      error
        ? {
            kind: 'error',
            text: /column|relation|schema cache|does not exist/i.test(error.message)
              ? 'The database needs the profile update first. Ask the owner to run supabase/08_profile.sql.'
              : error.message,
          }
        : { kind: 'ok', text: 'Saved' },
    )
  }

  const avatarValue = emoji ? encodeAvatar({ emoji, color }) : null
  const tile = (id: 'about' | 'contact', label: string, icon: IconName, hint: string) => (
    <button type="button" className="set-tile" onClick={() => setPanel(id)} aria-haspopup="dialog">
      <span className="set-tile-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="set-tile-label">{label}</span>
      <span className="set-tile-hint">{hint}</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">My Profile</h1>

      <form onSubmit={save} className="flex flex-col gap-4">
        <section className="card flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="p-name">
              Name
            </label>
            <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="p-birthday">
              Birthday
            </label>
            <input id="p-birthday" type="date" className="input" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            <p className="mt-1 text-sm text-muted">Shown to your family on the Birthdays page.</p>
          </div>
          <div>
            <p className="label">Email</p>
            <p className="break-all">{email}</p>
          </div>
        </section>

        <div className="set-grid">
          <button type="button" className="set-tile" onClick={() => setPanel('avatar')} aria-haspopup="dialog">
            <Avatar value={avatarValue} name={nickname || name} size={34} />
            <span className="set-tile-label">Avatar</span>
            <span className="set-tile-hint">{emoji ? 'Chosen' : 'Pick one'}</span>
          </button>
          {tile('about', 'About you', 'me', nickname || bio || 'Nickname, bio')}
          {tile('contact', 'Contact', 'phone', share ? 'Shared' : 'Private')}
        </div>

        {msg && (
          <p role="status" className={`text-sm font-bold ${msg.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {msg.text}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </form>

      <button className="btn btn-plain w-full" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>

      {panel === 'avatar' && (
        <Sheet title="Avatar" onClose={() => setPanel(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar value={avatarValue} name={nickname || name} size={64} />
              <p className="text-sm text-muted">Nothing is uploaded, so it costs no storage. Remember to press Save.</p>
            </div>
          <div role="radiogroup" aria-label="Avatar symbol" className="grid grid-cols-8 gap-1.5">
            {AVATAR_EMOJI.map((em) => (
              <button
                type="button"
                key={em}
                role="radio"
                aria-checked={emoji === em}
                aria-label={em}
                onClick={() => setEmoji(em)}
                className={`flex aspect-square items-center justify-center rounded-[var(--radius-ctl)] border text-xl ${
                  emoji === em ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Avatar colour" className="flex flex-wrap gap-2.5">
            {AVATAR_COLORS.map((c, i) => (
              <button
                type="button"
                key={i}
                role="radio"
                aria-checked={color === i}
                aria-label={`Colour ${i + 1}`}
                onClick={() => setColor(i)}
                style={{ backgroundImage: `linear-gradient(145deg, ${c[0]}, ${c[1]})` }}
                className={`size-9 rounded-full ${color === i ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
              />
            ))}
          </div>
          {emoji && (
            <button type="button" className="link self-start" onClick={() => setEmoji('')}>
              Use my initial instead
            </button>
          )}
          </div>
        </Sheet>
      )}

      {panel === 'about' && (
        <Sheet title="About you" onClose={() => setPanel(null)}>
          <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="p-nick">
              Nickname
            </label>
            <input
              id="p-nick"
              className="input"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What the family calls you"
            />
            <p className="mt-1 text-sm text-muted">Shown instead of your name around the app.</p>
          </div>
          <div>
            <label className="label" htmlFor="p-bio">
              Bio
            </label>
            <textarea
              id="p-bio"
              className="input min-h-20"
              value={bio}
              maxLength={BIO_MAX}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about you"
            />
            <p className="mt-1 text-right text-sm text-muted">
              {bio.length}/{BIO_MAX}
            </p>
          </div>
          </div>
        </Sheet>
      )}

      {panel === 'contact' && (
        <Sheet title="Contact details" onClose={() => setPanel(null)}>
          <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="p-phone">
              Phone
            </label>
            <input
              id="p-phone"
              type="tel"
              inputMode="tel"
              className="input"
              value={phone}
              maxLength={30}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 ..."
            />
          </div>
          <div>
            <label className="label" htmlFor="p-cemail">
              Contact email
            </label>
            <input
              id="p-cemail"
              type="email"
              className="input"
              value={contactEmail}
              maxLength={120}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={email || 'you@example.com'}
            />
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 flex-none accent-[var(--accent)]"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
            />
            <span>
              <span className="block font-bold">Show to my family</span>
              <span className="block text-sm text-muted">
                {share
                  ? 'Your cousins can see this phone and email on the Home members list.'
                  : 'Private. Only you can see these. Your sign-in email is never shown.'}
              </span>
            </span>
          </label>
          </div>
        </Sheet>
      )}
    </div>
  )
}
