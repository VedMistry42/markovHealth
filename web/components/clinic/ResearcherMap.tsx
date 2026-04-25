"use client"
import { useRef, useEffect, useState } from "react"
import { HUBS } from "@/data/mockTrialCriteria"
import 'mapbox-gl/dist/mapbox-gl.css'

interface PatientPin {
  patientId: string
  patientName: string
  lat: number
  lng: number
  status: string // PENDING | CONFIRMED
}

export default function ResearcherMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<unknown>(null)
  const [mapLoaded,  setMapLoaded]  = useState(false)
  const markersRef   = useRef<Map<string, unknown>>(new Map())

  // ── Mapbox init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) { console.warn("NEXT_PUBLIC_MAPBOX_TOKEN not set"); return }

    let map: import("mapbox-gl").Map

    import("mapbox-gl").then((mapboxgl) => {
      mapboxgl.default.accessToken = token
      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-90, 38],
        zoom: 4,
        pitch: 20,
      })
      mapRef.current = map

      map.on("load", () => {
        setMapLoaded(true)

        // Hub marker — clinical centre
        const hub = HUBS[0]
        const hEl = document.createElement("div")
        hEl.innerHTML = `
          <div style="width:36px;height:36px;background:rgba(244,63,94,0.12);border:2px solid #f43f5e;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>`
        new mapboxgl.default.Marker({ element: hEl })
          .setLngLat([hub.lng, hub.lat])
          .setPopup(new mapboxgl.default.Popup({ offset: 20 }).setHTML(
            `<p style="font-weight:700;font-size:12px;color:#111;">${hub.name}</p>
             <p style="color:#f43f5e;font-size:10px;font-weight:bold;">CLINICAL HUB</p>`
          ))
          .addTo(map)
      })
    })

    return () => { if (map) map.remove() }
  }, [])

  // ── Poll for patient status & update markers ──────────────────────────────────
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/clinic/confirmed-patients")
        if (!res.ok) return
        const pins: PatientPin[] = await res.json()
        const map = mapRef.current as import("mapbox-gl").Map | null
        if (!map) return

        import("mapbox-gl").then((mapboxgl) => {
          for (const pin of pins) {
            const key     = `pin-${pin.patientId}`
            const isGreen = pin.status === "CONFIRMED"
            const color   = isGreen ? "#10b981" : "#f97316"  // green or orange
            const ping    = isGreen ? "#34d399" : "#fb923c"

            const existing = markersRef.current.get(key) as import("mapbox-gl").Marker | undefined
            if (existing) {
              const el = existing.getElement()
              const dot  = el.querySelector(".dot")  as HTMLElement | null
              const ring = el.querySelector(".ring") as HTMLElement | null
              if (dot)  dot.style.background  = color
              if (ring) ring.style.background = ping
              existing.getPopup()?.setHTML(makePopupHtml(pin.patientName, pin.status))
              continue
            }

            // New marker
            const el = document.createElement("div")
            el.innerHTML = `
              <div style="position:relative;width:18px;height:18px;cursor:pointer;">
                <span class="ring" style="position:absolute;inset:0;border-radius:50%;background:${ping};opacity:0.6;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
                <span class="dot"  style="position:absolute;inset:2px;border-radius:50%;background:${color};border:2px solid white;"></span>
              </div>`

            const style = document.createElement("style")
            style.textContent = `@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`
            el.appendChild(style)

            const marker = new mapboxgl.default.Marker({ element: el })
              .setLngLat([pin.lng, pin.lat])
              .setPopup(new mapboxgl.default.Popup({ offset: 14 }).setHTML(makePopupHtml(pin.patientName, pin.status)))
              .addTo(map)

            markersRef.current.set(key, marker)
          }
        })
      } catch { /* silent */ }
    }

    const id = setInterval(poll, 2500)
    poll()
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {mapLoaded && (
        <div className="absolute bottom-6 left-6 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-xs text-white space-y-1.5">
          <p className="font-semibold text-gray-300 uppercase tracking-wider text-[9px] mb-2">Patient Status</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 border border-white/30 flex-shrink-0" /><span className="text-gray-300">Contacted — awaiting confirmation</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-400 border border-white/30 flex-shrink-0" /><span className="text-gray-300">Confirmed — contact info shared</span></div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-rose-400/20 border-2 border-rose-400 flex-shrink-0" /><span className="text-gray-300">Clinical hub</span></div>
        </div>
      )}
    </div>
  )
}

function makePopupHtml(name: string, status: string): string {
  const isGreen = status === "CONFIRMED"
  const color   = isGreen ? "#10b981" : "#f97316"
  const label   = isGreen ? "✓ CONFIRMED — contact info shared" : "⏳ CONTACTED — awaiting patient"
  return `
    <p style="font-weight:700;font-size:12px;color:#111;margin-bottom:2px;">${name}</p>
    <p style="font-size:10px;font-weight:600;color:${color};">${label}</p>`
}
