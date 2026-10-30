import { useEffect, useMemo, useState } from 'react'
import AppAvatar from '../components/Avatar'
import { Icon } from '../components/Icons'
import { parseAvatar } from '../lib/avatars'
import {
  countdownText,
  dateText,
  rank,
  tierOf,
  type BirthdayPerson,
  type Tier,
  type Upcoming,
} from '../lib/birthdays'
import { askPermission, loadPrefs, notificationState, savePrefs, type ReminderPrefs } from '../lib/birthdayReminders'

type Props = {
  people: BirthdayPerson[]
  loaded: boolean
  error: string
  reload: () => void
  onOpenProfile: () => void
}

const SECTIONS: { tier: Tier[]; title: string }[] = [
  { tier: ['today'], title: 'Today' },
  { tier: ['tomorrow', 'week'], title: 'This week' },
  { tier: ['month'], title: 'This month' },
  { tier: ['later'], title: 'Later' },
]

function Avatar({ name, avatar, hot }: { name: string; avatar?: string | null; hot?: boolean }) {
  if (parseAvatar(avatar)) return <AppAvatar value={avatar} name={name} size={40} className="flex-none" />
  return (
    <span aria-hidden="true" className={`bd-avatar ${hot ? 'bd-avatar-hot' : ''}`}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  )
}

function Row({ u }: { u: Upcoming }) {
  const tier = tierOf(u.days)
  return (
    <li className="bd-row">
      <Avatar name={u.name} avatar={u.avatar} hot={u.days <= 1} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {u.name}
          {u.isMe ? ' (you)' : ''}
        </p>
        <p className="text-sm text-muted">
          {dateText(u.date)}
          {u.turning ? ` · turning ${u.turning}` : ''}
        </p>
      </div>
      <span className={`bd-chip bd-chip-${tier}`}>{countdownText(u.days)}</span>
    </li>
  )
}

export default function Birthdays({ people, loaded, error, reload, onOpenProfile }: Props) {
  useEffect(() => {
    reload()
  }, [reload])

  const { upcoming, missing } = useMemo(() => rank(people), [people])
  const next = upcoming[0]
  const alerts = upcoming.filter((u) => u.days <= 7)

  const [prefs, setPrefs] = useState<ReminderPrefs>(loadPrefs)
  const [perm, setPerm] = useState(notificationState)
  const [note, setNote] = useState('')

  function update(p: ReminderPrefs) {
    setPrefs(p)
    savePrefs(p)
  }

  async function toggleReminders() {
    setNote('')
    if (prefs.enabled) {
      update({ ...prefs, enabled: false })
      return
    }
    let state = perm
    if (state === 'default') state = await askPermission()
    setPerm(state)
    if (state === 'granted') update({ ...prefs, enabled: true })
    else if (state === 'denied') setNote('Notifications are blocked for this app. Allow them in your phone or browser settings, then try again.')
    else setNote('This browser cannot show notifications here. On iPhone, add Cznnect to your Home Screen first.')
  }

  const meMissing = missing.some((p) => p.isMe)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">Birthdays</h1>
      </header>

      {error && (
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold text-danger">{error}</p>
          <button className="btn btn-plain" onClick={reload}>Try again</button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2" aria-label="Birthday alerts">
          {alerts.map((u) => (
            <p key={u.userId} role="status" className={`bd-alert ${u.days === 0 ? 'bd-alert-today' : ''}`}>
              <Icon name="cake" size={20} />
              <span>
                {u.days === 0
                  ? u.isMe
                    ? `Happy birthday${u.turning ? `! You turn ${u.turning} today.` : '!'}`
                    : `It's ${u.name}'s birthday today${u.turning ? ` · turning ${u.turning}` : ''}.`
                  : `${u.isMe ? 'Your' : `${u.name}'s`} birthday is ${u.days === 1 ? 'tomorrow' : `in ${u.days} days`}.`}
              </span>
            </p>
          ))}
        </div>
      )}

      {next && (
        <section className="bd-hero" aria-label="Next birthday">
          <p className="eyebrow">{next.days === 0 ? 'Celebrating today' : 'Next birthday'}</p>
          <div className="flex items-center gap-4">
            <div className="bd-count" aria-hidden="true">
              <span className="bd-count-num">{next.days}</span>
              <span className="bd-count-unit">{next.days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-xl font-extrabold">
                {next.name}
                {next.isMe ? ' (you)' : ''}
              </p>
              <p className="text-sm text-muted">
                {dateText(next.date)}
                {next.turning ? ` · turning ${next.turning}` : ''}
              </p>
              <p className="mt-1 text-sm font-bold text-accent-text">
                {next.days === 0 ? 'Today!' : next.days === 1 ? 'Tomorrow' : `${next.days} days to go`}
              </p>
            </div>
          </div>
        </section>
      )}

      {SECTIONS.map(({ tier, title }) => {
        const list = upcoming.filter((u) => tier.includes(tierOf(u.days)))
        if (list.length === 0) return null
        return (
          <section key={title} aria-label={title} className="flex flex-col gap-2">
            <h2 className="eyebrow">{title}</h2>
            <ul className="card bd-list">{list.map((u) => <Row key={u.userId} u={u} />)}</ul>
          </section>
        )
      })}

      {loaded && upcoming.length === 0 && !error && (
        <p className="px-1 text-sm text-muted">No birthdays yet.</p>
      )}

      {missing.length > 0 && (
        <section aria-label="No birthday added" className="flex flex-col gap-2">
          <h2 className="eyebrow">No birthday added</h2>
          <ul className="card bd-list">
            {missing.map((p) => (
              <li key={p.userId} className="bd-row">
                <Avatar name={p.name} avatar={p.avatar} />
                <p className="min-w-0 flex-1 truncate font-bold">
                  {p.name}
                  {p.isMe ? ' (you)' : ''}
                </p>
                {p.isMe && (
                  <button className="btn btn-plain !min-h-9 !px-3 text-sm" onClick={onOpenProfile}>
                    Add yours
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col gap-3" aria-label="Reminders">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold">Reminders</h2>
            <p className="text-sm text-muted">Shown when you open the app.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.enabled}
            aria-label="Birthday reminders"
            className={`bd-switch ${prefs.enabled ? 'bd-switch-on' : ''}`}
            onClick={toggleReminders}
          >
            <span />
          </button>
        </div>
        {note && <p role="alert" className="text-sm font-bold text-danger">{note}</p>}
        {prefs.enabled && (
          <div className="flex flex-col gap-1 border-t border-line pt-3">
            {(
              [
                ['today', 'On the day'],
                ['tomorrow', 'The day before'],
                ['week', 'One week before'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center justify-between gap-3">
                <span>{label}</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={prefs[key]}
                  onChange={(e) => update({ ...prefs, [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
