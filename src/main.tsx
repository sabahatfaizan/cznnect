import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './motion.css'
import './themes/rdr2.css'
import './themes/rdr2-grit.css'
import './themes/uncharted.css'
import './themes/moonknight.css'
import './themes/moonpaper.css'
import './themes/moon-comic.css'
import '@fontsource/cinzel/latin-600.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { applyTheme, getThemePref } from './theme'
import { applyIcon } from './appIcon'
import { initRdr2Fx } from './themes/rdr2-fx'

applyTheme(getThemePref())
applyIcon()
initRdr2Fx()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
)

// Offline support and "Install app". Only in the built site, not while developing.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' }).catch((error) => {\n      console.warn('Cznnect offline support could not start:', error)\n    })
  })
}
