import type { ThemePref } from '../theme'

// What each theme is called, how it is described, and the colours of its little preview in Settings.
export type ThemePreview = { page: string; surface: string; ink: string; muted: string; accent: string; soft: string; border: string }
export type ThemeMeta = { id: ThemePref; label: string; hint: string; badge?: 'Exclusive' | 'Owner'; preview: ThemePreview }

export const THEMES: ThemeMeta[] = [
  {
    id: 'light', label: 'Light', hint: 'Clean, bright, everyday use',
    preview: { page: '#f1f4f8', surface: '#ffffff', ink: '#172333', muted: '#657287', accent: '#2457d6', soft: '#e5edff', border: '#d9e0ea' },
  },
  {
    id: 'dark', label: 'Dark', hint: 'Clean, comfortable low-light use',
    preview: { page: '#111318', surface: '#1b1e25', ink: '#edf0f5', muted: '#a0a7b4', accent: '#7ea7ff', soft: '#26334d', border: '#343945' },
  },
  {
    id: 'midnight', label: 'Midnight', hint: 'Pure black, easy on the eyes',
    preview: { page: '#000000', surface: '#0c0c0e', ink: '#f2f2f4', muted: '#9a9aa3', accent: '#8ab4ff', soft: '#16171c', border: '#26262c' },
  },
  {
    id: 'dusk', label: 'Dusk', hint: 'Deep, dark purple', 
    preview: { page: '#15101f', surface: '#1f1830', ink: '#efe9fb', muted: '#a99dc4', accent: '#b794f6', soft: '#2e2347', border: '#3b2f58' },
  },
  {
    id: 'glass', label: 'Liquid Glass', hint: 'Glass-inspired finish', badge: 'Owner',
    preview: { page: '#101b35', surface: 'rgba(116,151,213,.24)', ink: '#eaf1ff', muted: '#b6c8e8', accent: '#75b8ff', soft: 'rgba(117,184,255,.18)', border: 'rgba(205,225,255,.3)' },
  },
]

export function themeLabel(id: ThemePref): string {
  return THEMES.find((t) => t.id === id)?.label ?? 'Light'
}
