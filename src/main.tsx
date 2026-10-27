import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes/rdr2.css'
import './themes/uncharted.css'
import './themes/mw4.css'
import '@fontsource/cinzel/latin-600.css'
import App from './App'
import { applyTheme, getThemePref } from './theme'
import { applyIcon } from './appIcon'

applyTheme(getThemePref())
applyIcon()

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
