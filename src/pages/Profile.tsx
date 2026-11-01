import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import { Icon, type IconName } from '../components/Icons'
import ColorWheel from '../components/ColorWheel'
import { AVATAR_ICONS, DEFAULT_AVATAR_COLOR, EMOJI_GROUPS, TYPO_AVATARS, TYPO_PACKS, encodeAvatar, encodeTypoAvatar, parseAvatar, parseTypoAvatar } from '../lib/avatars'
import { getUnlockedThemes, onUnlocksChanged } from '../theme'

const BIO_MAX = 140

export default function Profile({ userId }: { userId: string }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [birthday, setBirthday] = useState('')
  const [symbol, setSymbol] = useState('') // an emoji, or "i:<id>" for a drawn icon
  const [color, setColor] = useState(DEFAULT_AVATAR_COLOR)
  const [typo, setTypo] = useState('')
  const [tab, setTab] = useState<'emoji' | 'letters'>('emoji')
  const [unlocked, setUnlocked] = useState(getUnlockedThemes)
  useEffect(() => onUnlocksChanged(() => setUnlocked(getUnlockedThemes())), [])
  const [typoBg, setTypoBg] = useState('') // wheel colour for a lettering avatar; '' keeps its themed background
  const [colorTouched, setColorTouched] = useState(false)
  // A pack is offered once its theme is unlocked. The one already in use stays visible.
  const inUse = typo ? TYPO_AVATARS.find((t) => t.id === typo)?.pack : AVATAR_ICONS.find((i) => symbol === `i:${i.id}`)?.pack
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
      const t = parseTypoAvatar(d.avatar)
      if (t) {
        setTypo(t.id)
        setTab('letters')
        if (t.custom) {
          setTypoBg(t.custom)
          setColor(t.custom)
        }
      }
      const a = parseAvatar(d.avatar)
      if (a) {
        setSymbol(a.symbol)
        setColor(a.color)
        setTab(a.symbol.startsWith('i:') ? 'letters' : 'emoji')
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
        avatar: typo ? encodeTypoAvatar(typo) : symbol ? encodeAvatar({ symbol, color }) : null,
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

  const avatarValue = typo ? encodeTypoAvatar(typo, typoBg || undefined) : symbol ? encodeAvatar({ symbol, color }) : null
  const tile = (id: 'about' | 'contact', label: string, icon: IconName) => (
    <button type="button" className="set-tile" onClick={() => setPanel(id)} aria-haspopup="dialog">
      <span className="set-tile-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="set-tile-label">{label}</span>
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
          </button>
          {tile('about', 'Nickname', 'me')}
          {tile('contact', 'Contact', 'phone')}
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
            </div>
          <div className="seg-row grid grid-cols-3 gap-2" role="tablist" aria-label="Avatar type">
            {([['emoji', 'Emoji'], ['letters', 'Letters']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`seg !min-h-10 items-center justify-center ${tab === id ? 'seg-on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'emoji' && (
            <div className="flex flex-col gap-3">
              {EMOJI_GROUPS.map((group) => (
                <div key={group.name} role="radiogroup" aria-label={`${group.name} emoji`}>
                  <p className="label mb-1.5">{group.name}</p>
                  <div className="avatar-grid grid grid-cols-7 gap-1.5">
                    {group.items.map((em) => {
                      const on = !typo && symbol === em
                      return (
                        <button
                          type="button"
                          key={em}
                          role="radio"
                          aria-checked={on}
                          aria-label={em}
                          onClick={() => { setSymbol(em); setTypo('') }}
                          className={`avatar-pick flex aspect-square items-center justify-center rounded-[var(--radius-ctl)] border text-xl ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'}`}
                        >
                          {em}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(
            <details className="expander border-t border-line pt-3" open>
              <summary>
                <span className="font-bold">Background colour</span>
                <span aria-hidden="true" className="expander-chevron">›</span>
              </summary>
              <div className="mt-3">
                <ColorWheel value={color} onChange={(c) => { setColor(c); setColorTouched(true); if (typo) setTypoBg(c) }} />
                {typo && typoBg && (
                  <button type="button" className="link mt-2" onClick={() => { setTypoBg(''); setColorTouched(false) }}>
                    Use this avatar's own background
                  </button>
                )}
              </div>
            </details>
          )}

          {tab === 'letters' && (
            <>
              {TYPO_PACKS.filter((pack) => !pack.requires || unlocked.includes(pack.requires) || inUse === pack.name).map((pack) => (
                <div key={pack.name} role="radiogroup" aria-label={`${pack.name} avatars`}>
                  <p className="label mb-1.5">{pack.name}</p>
                  <div className="flex flex-wrap gap-2.5">
                    {AVATAR_ICONS.filter((ic) => ic.pack === pack.name).map((ic) => {
                      const value = `i:${ic.id}`
                      const on = !typo && symbol === value
                      return (
                        <button
                          type="button"
                          key={ic.id}
                          role="radio"
                          aria-checked={on}
                          aria-label={`${pack.name} ${ic.label}`}
                          onClick={() => { setSymbol(value); setTypo('') }}
                          className={`rounded-full ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                        >
                          <Avatar value={encodeAvatar({ symbol: value, color })} name="" size={44} />
                        </button>
                      )
                    })}
                    {TYPO_AVATARS.filter((t) => t.pack === pack.name).map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        role="radio"
                        aria-checked={typo === t.id}
                        aria-label={`${pack.name} ${t.text || 'plain'}`}
                        onClick={() => { setTypo(t.id); setSymbol(''); setTypoBg(colorTouched ? color : '') }}
                        className={`rounded-full ${typo === t.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                      >
                        <Avatar value={encodeTypoAvatar(t.id, colorTouched ? color : undefined)} name={nickname || name} size={44} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {(symbol || typo) && (
            <button type="button" className="link self-start" onClick={() => { setSymbol(''); setTypo(''); setTypoBg('') }}>
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
