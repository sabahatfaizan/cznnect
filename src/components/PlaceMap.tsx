import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { boundsOf, type Place } from '../lib/places'

type Spot = { lat: number; lng: number }

// The map. Leaflet draws it with free OpenStreetMap tiles. Each saved place is a pin:
// round for a place, square for a restaurant, filled when the family has been there and
// hollow when it is somewhere they want to go.
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
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const tempPin = useRef<L.Marker | null>(null)
  const fitted = useRef(false)

  // Always call the newest callbacks without rebuilding the map.
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const pickingRef = useRef(picking)
  pickingRef.current = picking

  useEffect(() => {
    const el = box.current
    if (!el) return
    const m = L.map(el, { zoomControl: true, attributionControl: true }).setView([23.8103, 90.4125], 7)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (pickingRef.current) pickRef.current(e.latlng.lat, e.latlng.lng)
    })
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      layer.current = null
      tempPin.current = null
      fitted.current = false
    }
  }, [])

  // Draw the pins.
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    for (const p of places) {
      const cls = [
        'pin',
        p.kind === 'restaurant' ? 'pin-sq' : 'pin-round',
        p.status === 'want' ? 'pin-want' : 'pin-been',
        p.id === selectedId ? 'pin-sel' : '',
      ].join(' ')
      L.marker([p.lat, p.lng], {
        title: p.name,
        alt: p.name,
        keyboard: true,
        icon: L.divIcon({ className: 'pin-wrap', html: `<span class="${cls}"></span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      })
        .on('click', () => selectRef.current(p.id))
        .addTo(g)
    }
    // Fit everything in view the first time places arrive.
    if (!fitted.current && places.length > 0) {
      fitted.current = true
      const b = boundsOf(places)
      if (b) {
        if (places.length === 1) m.setView(b[0], 14)
        else m.fitBounds(b, { padding: [40, 40], maxZoom: 15 })
      }
    }
  }, [places, selectedId])

  // The temporary pin shown while adding a place.
  useEffect(() => {
    const m = map.current
    if (!m) return
    tempPin.current?.remove()
    tempPin.current = null
    if (pin) {
      tempPin.current = L.marker([pin.lat, pin.lng], {
        interactive: false,
        icon: L.divIcon({ className: 'pin-wrap', html: '<span class="pin pin-round pin-new"></span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      }).addTo(m)
    }
  }, [pin])

  useEffect(() => {
    const m = map.current
    if (m && focus) m.setView([focus.lat, focus.lng], Math.max(m.getZoom(), 15))
  }, [focus])

  return (
    <div className={`map-wrap ${picking ? 'map-picking' : ''}`}>
      <div ref={box} className="h-[58dvh] min-h-72 w-full" role="region" aria-label="Map of saved places" />
    </div>
  )
}
