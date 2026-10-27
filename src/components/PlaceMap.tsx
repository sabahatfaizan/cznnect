import { useEffect, useRef } from 'react'
import maplibregl, { type Map as MapLibreMap, type Marker as MapLibreMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { boundsOf, type Place } from '../lib/places'

type Spot = { lat: number; lng: number }

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// OpenFreeMap vector basemap with MapLibre. Saved places stay interactive:
// round for places, square for restaurants, filled for visited, hollow for wanted.
export default function PlaceMap({
  places,
  selectedId,
  onSelect,
  picking,
  onPick,
  pin,
  focus,
}: {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string) => void
  picking: boolean
  onPick: (lat: number, lng: number) => void
  pin: Spot | null
  focus: (Spot & { tick: number }) | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<Map<string, MapLibreMarker>>(new Map())
  const tempPin = useRef<MapLibreMarker | null>(null)
  const fitted = useRef(false)

  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const pickingRef = useRef(picking)
  pickingRef.current = picking

  useEffect(() => {
    const el = box.current
    if (!el) return

    const m = new maplibregl.Map({
      container: el,
      style: OPENFREEMAP_STYLE,
      center: [90.4125, 23.8103],
      zoom: 7,
      attributionControl: true,
      cooperativeGestures: true,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('click', (event) => {
      if (pickingRef.current) pickRef.current(event.lngLat.lat, event.lngLat.lng)
    })
    map.current = m

    const ro = new ResizeObserver(() => m.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      markers.current.forEach((marker) => marker.remove())
      markers.current.clear()
      tempPin.current?.remove()
      tempPin.current = null
      m.remove()
      map.current = null
      fitted.current = false
    }
  }, [])

  // Rebuild saved-place markers while keeping the map instance alive.
  useEffect(() => {
    const m = map.current
    if (!m) return

    markers.current.forEach((marker) => marker.remove())
    markers.current.clear()

    for (const p of places) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'map-place-marker'
      el.setAttribute('aria-label', p.name)
      el.title = p.name
      const cls = [
        'pin',
        p.kind === 'restaurant' ? 'pin-sq' : 'pin-round',
        p.status === 'want' ? 'pin-want' : 'pin-been',
        p.id === selectedId ? 'pin-sel' : '',
      ].join(' ')
      el.innerHTML = `<span class="${cls}"></span>`
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        selectRef.current(p.id)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lng, p.lat])
        .addTo(m)
      markers.current.set(p.id, marker)
    }

    if (!fitted.current && places.length > 0) {
      fitted.current = true
      const b = boundsOf(places)
      if (b) {
        if (places.length === 1) m.setCenter([b[0][1], b[0][0]]).setZoom(14)
        else {
          const bounds = new maplibregl.LngLatBounds()
          for (const p of places) bounds.extend([p.lng, p.lat])
          m.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 })
        }
      }
    }
  }, [places, selectedId])

  useEffect(() => {
    const m = map.current
    tempPin.current?.remove()
    tempPin.current = null
    if (m && pin) {
      const el = document.createElement('div')
      el.className = 'map-place-marker'
      el.innerHTML = '<span class="pin pin-round pin-new"></span>'
      tempPin.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m)
    }
  }, [pin])

  useEffect(() => {
    const m = map.current
    if (m && focus) m.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(m.getZoom(), 15), essential: true })
  }, [focus])

  return (
    <div className={`map-wrap ${picking ? 'map-picking' : ''}`}>
      <div ref={box} className="h-[58dvh] min-h-72 w-full" role="region" aria-label="Map of saved places" />
    </div>
  )
}
