import { useEffect, useState, type RefObject } from 'react'

// The pixel height from the top of `ref` down to just above the bottom bar, so a one-screen page ends exactly where the
// bar starts. Returns null until measured (use a calc() guess meanwhile). Re-measures when the screen or bar changes,
// and when the page is shown again (a hidden page measures nothing).
export function useFitAboveNav(ref: RefObject<HTMLElement | null>, gap = 14): number | null {
  const [h, setH] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      if (!el.offsetParent) return
      const nav = document.querySelector('.app-nav')
      const bottom = nav ? nav.getBoundingClientRect().top : window.innerHeight
      setH(Math.max(260, Math.floor(bottom - el.getBoundingClientRect().top - gap)))
    }
    fit()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(el)
    ro?.observe(document.body)
    const nav = document.querySelector('.app-nav')
    if (nav) ro?.observe(nav)
    window.addEventListener('resize', fit)
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit) }
  }, [ref, gap])
  return h
}
