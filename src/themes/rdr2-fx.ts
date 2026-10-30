// Red Dead feel: a puff of dust and a short buzz where a finger lands, and a slow drift of the sunset
// scene against the scroll. It only acts while the Red Dead theme is on, so other themes cost nothing.

const TAPPABLE = '.btn, .tab, .tab-active, .menu-item, .menu-btn, .seg, button'

function isRdr2(): boolean {
  return document.documentElement.dataset.theme === 'rdr2'
}

export function initRdr2Fx(): void {
  if (typeof window === 'undefined') return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let lastPuff = 0

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!isRdr2()) return
      const el = (e.target as Element | null)?.closest?.(TAPPABLE)
      if (!el || (el as HTMLButtonElement).disabled) return
      try {
        navigator.vibrate?.(8)
      } catch {
        // Some browsers block vibration until the page has been tapped once. Nothing to do.
      }
      if (reduced.matches) return
      const now = performance.now()
      if (now - lastPuff < 70) return
      lastPuff = now
      const puff = document.createElement('span')
      puff.className = 'rdr-puff'
      puff.style.left = `${e.clientX}px`
      puff.style.top = `${e.clientY}px`
      puff.addEventListener('animationend', () => puff.remove(), { once: true })
      document.body.appendChild(puff)
    },
    { passive: true },
  )

  // Parallax: the scene moves up a little slower than the page, capped so its edge never shows.
  let frame = 0
  const root = document.documentElement
  const update = () => {
    frame = 0
    if (!isRdr2() || reduced.matches) {
      root.style.removeProperty('--rdr-par')
      return
    }
    const max = window.innerHeight * 0.05
    root.style.setProperty('--rdr-par', `${-Math.min(window.scrollY * 0.06, max).toFixed(1)}px`)
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(update)
    },
    { passive: true },
  )
}
