import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { getThemePref, setThemePref, type ThemePref } from '../theme'

const OWNER_EMAIL = 'faizanplayz11@gmail.com'

const THEMES: { id: ThemePref; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Clean and bright' },
  { id: 'tactical', label: 'Tactical Dark', hint: 'Dark, HUD style' },
  { id: 'midnight', label: 'Midnight', hint: 'Black and deep blue' },
  { id: 'glass', label: 'Liquid Glass', hint: 'Owner only' },
  { id: 'system', label: 'System', hint: 'Match my phone' },
]

export default function Settings() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  function pickTheme(id: ThemePref) {
    setThemePref(id)
    setTheme(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Settings</h1>
      <section className="card flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Choose how Cznnect looks on this device.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.filter((t) => t.id !== 'glass' || email.toLowerCase() === OWNER_EMAIL).map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              className={`seg ${theme === t.id ? 'seg-on' : ''}`}
              onClick={() => pickTheme(t.id)}
            >
              {t.label}
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">Saved on this device. Liquid Glass is only available to the app owner.</p>
      </section>
    </div>
  )
}
