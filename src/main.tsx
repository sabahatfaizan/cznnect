import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource/cinzel/latin-600.css'
import App from './App'
import { applyTheme, getThemePref, watchSystemTheme } from './theme'
import { applyIcon } from './appIcon'

applyTheme(getThemePref())
applyIcon()
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Offline support and "Install app". Only in the built site, not while developing.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}
