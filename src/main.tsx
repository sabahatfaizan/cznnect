import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './motion.css'
import '@fontsource/cinzel/latin-600.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { applyTheme, getThemePref } from './theme'
import { applyIcon } from './appIcon'

applyTheme(getThemePref())
applyIcon()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
)

// Offline support and "Install app". Only in the built site, not while developing.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.warn('Cznnect offline support could not start:', error)
    })
  })
}

// Marks the page as scrolled, which shows the strip behind the phone's status bar (see index.css).
function markScrolled() {
  document.documentElement.classList.toggle('page-scrolled', window.scrollY > 2)
}
window.addEventListener('scroll', markScrolled, { passive: true })
window.addEventListener('popstate', markScrolled)
markScrolled()
