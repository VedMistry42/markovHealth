"use client"
import { useRef, useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HUBS, MOBILE_UNITS } from "@/data/mockTrialCriteria"
import { Truck, Package, Navigation, X } from "lucide-react"

import 'mapbox-gl/dist/mapbox-gl.css'

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000"
const POLL_INTERVAL_MS = 3000

interface EmpathyMetrics {
  patient_travel_saved_miles: number
  fragility_accommodated: boolean
  match_score: number
  dropout_risk_pct: number
}

interface RouteResult {
  patientId: string
  trialId: string
  lat: number
  lng: number
  receivedAt: number
  route: {
    selected_action: string
    rationale: string
    cost_analysis: { friction_score: number; cost_usd: number }
    geometry: { type: string; coordinates: [number, number][] }
    empathy_metrics: EmpathyMetrics
  }
}

const ACTION_LABEL: Record<string, string> = {
  MOBILE_UNIT: "Mobile Unit Dispatched",
  TEST_KIT: "Test Kit Shipped",
  LOCAL_CLINIC: "Clinic Referral",
  HUB_FLIGHT: "Hub Flight Booked",
}

const ACTION_COLOR: Record<string, string> = {
  MOBILE_UNIT: "#f59e0b",
  TEST_KIT: "#6366f1",
  LOCAL_CLINIC: "#10b981",
  HUB_FLIGHT: "#ef4444",
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  MOBILE_UNIT: <Truck className="w-4 h-4" />,
  TEST_KIT: <Package className="w-4 h-4" />,
  LOCAL_CLINIC: <Navigation className="w-4 h-4" />,
  HUB_FLIGHT: <Navigation className="w-4 h-4" />,
}

// Dynamically import mapbox-gl only on client to avoid SSR issues
export default function ResearcherMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [toast, setToast] = useState<RouteResult | null>(null)
  const seenIds = useRef<Set<string>>(new Set())
  const routeLayerIds = useRef<Set<string>>(new Set())

  // -------------------------------------------------------------------
  // Add a live route to the Mapbox map
  // -------------------------------------------------------------------
  const addLiveRoute = useCallback((result: RouteResult) => {
    const map = mapRef.current as import("mapbox-gl").Map | null
    if (!map) return

    const layerId = `live-route-${result.patientId}`
    if (routeLayerIds.current.has(layerId)) return

    const action = result.route.selected_action
    const color = ACTION_COLOR[action] ?? "#6b7280"

    // Patient dot
    import("mapbox-gl").then((mapboxgl) => {
      const el = document.createElement("div")
      el.innerHTML = `
        <div class="relative flex h-5 w-5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background:${color};"></span>
          <span class="relative inline-flex rounded-full h-5 w-5 border-2 border-white" style="background:${color};"></span>
        </div>
      `
      new mapboxgl.default.Marker({ element: el })
        .setLngLat([result.lng, result.lat])
        .setPopup(
          new mapboxgl.default.Popup({ offset: 14 }).setHTML(`
            <p style="color:#111;font-size:12px;font-weight:700">${ACTION_LABEL[action] ?? action}</p>
            <p style="color:#555;font-size:11px">Match: ${result.route.empathy_metrics.match_score.toFixed(0)}%</p>
            <p style="color:#555;font-size:11px">Saved ${result.route.empathy_metrics.patient_travel_saved_miles} mi of travel</p>
            <p style="color:#555;font-size:11px">Dropout risk: ${result.route.empathy_metrics.dropout_risk_pct}%</p>
          `)
        )
        .addTo(map)
    })

    // Route line
    if (result.route.geometry?.coordinates?.length > 1) {
      map.addSource(layerId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          // Cast needed: mapbox-gl Geometry union requires a literal type string
          geometry: result.route.geometry as GeoJSON.Geometry,
        },
      })
      map.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        paint: {
          "line-color": color,
          "line-width": 2.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      })
      routeLayerIds.current.add(layerId)
    }
  }, [])

  // -------------------------------------------------------------------
  // Poll FastAPI for live route results
  // -------------------------------------------------------------------
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/clinic/logistics", { cache: "no-store" })
        if (!res.ok) return
        const results: RouteResult[] = await res.json()
        for (const r of results) {
          if (!seenIds.current.has(r.patientId)) {
            seenIds.current.add(r.patientId)
            addLiveRoute(r)
            setToast(r)
            const map = mapRef.current as import("mapbox-gl").Map | null
            if (map) {
              map.flyTo({ center: [r.lng, r.lat], zoom: 7, duration: 1800 })
            }
          }
        }
      } catch { /* silent fail */ }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    poll()   // immediate first call

    // Also poll for already confirmed patients to show them as static markers
    async function pollConfirmed() {
      try {
        const res = await fetch("/api/clinic/confirmed-patients")
        if (!res.ok) return
        const patients = await res.json()
        const map = mapRef.current as any
        if (!map) return

        import("mapbox-gl").then((mapboxgl) => {
          patients.forEach((p: any) => {
            const sid = `confirmed-marker-${p.patientId}`
            if (seenIds.current.has(sid)) return
            seenIds.current.add(sid)

            const el = document.createElement("div")
            el.innerHTML = `
              <div class="relative flex h-4 w-4">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border border-white"></span>
              </div>
            `
            new mapboxgl.default.Marker({ element: el })
              .setLngLat([p.lng, p.lat])
              .setPopup(new mapboxgl.default.Popup({ offset: 12 }).setHTML(`<p style="color:#111;font-size:12px;font-weight:700">${p.patientName}</p><p style="color:#555;font-size:11px">${p.condition}</p><p style="color:#10b981;font-size:10px;font-weight:bold">VERIFIED & CONFIRMED</p>`))
              .addTo(map)
          })
        })
      } catch (e) { /* silent fail */ }
    }
    const cid = setInterval(pollConfirmed, POLL_INTERVAL_MS)
    pollConfirmed()

    return () => { clearInterval(id); clearInterval(cid) }
  }, [addLiveRoute])

  // -------------------------------------------------------------------
  // Mapbox initialisation
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      console.warn("NEXT_PUBLIC_MAPBOX_TOKEN not set")
      return
    }

    let map: import("mapbox-gl").Map

    import("mapbox-gl").then((mapboxgl) => {
      mapboxgl.default.accessToken = token

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-96, 38],
        zoom: 3.5,
        pitch: 20,
      })

      mapRef.current = map

      map.on("load", () => {
        setMapLoaded(true)

        // Hub markers
        HUBS.forEach((hub) => {
          const el = document.createElement("div")
          el.innerHTML = `
            <div style="width:32px;height:32px;background:rgba(6,182,212,0.15);border:2px solid rgb(6,182,212);border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(6,182,212)" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          `
          new mapboxgl.default.Marker({ element: el })
            .setLngLat([hub.lng, hub.lat])
            .setPopup(new mapboxgl.default.Popup({ offset: 20 }).setHTML(`<p style="color:#111;font-size:12px;font-weight:600">${hub.name}</p><p style="color:#555;font-size:11px">${hub.city}</p>`))
            .addTo(map)
        })

        // Live confirmed patients are loaded via pollConfirmed above


        // Mobile unit markers
        MOBILE_UNITS.forEach((unit) => {
          const el = document.createElement("div")
          el.innerHTML = `
            <div style="width:28px;height:28px;background:rgba(245,158,11,0.15);border:2px solid rgb(245,158,11);border-radius:6px;display:flex;align-items:center;justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(245,158,11)" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
          `
          new mapboxgl.default.Marker({ element: el })
            .setLngLat([unit.lng, unit.lat])
            .setPopup(new mapboxgl.default.Popup({ offset: 16 }).setHTML(`<p style="color:#111;font-size:12px;font-weight:600">${unit.label}</p><p style="color:#555;font-size:11px">En route</p>`))
            .addTo(map)
        })

        // Static dispatch routes removed to prioritize live RL routing only
      })
    })

    return () => { if (map) map.remove() }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {!mapLoaded && (
        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        </motion.div>
      )}

      {/* Empathy metrics toast — fires when the RL engine routes a new patient */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.patientId}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 20 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[360px]"
          >
            <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${ACTION_COLOR[toast.route.selected_action]}20`, color: ACTION_COLOR[toast.route.selected_action] }}
                  >
                    {ACTION_ICON[toast.route.selected_action]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-snug">
                      Logistics Optimised — {ACTION_LABEL[toast.route.selected_action] ?? toast.route.selected_action}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {toast.route.empathy_metrics.fragility_accommodated
                        ? `Care delivered at patient location · Saved ${toast.route.empathy_metrics.patient_travel_saved_miles} mi`
                        : `${toast.route.empathy_metrics.patient_travel_saved_miles} mi saved vs. hub flight`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setToast(null)} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <p className="text-white text-sm font-bold">{toast.route.empathy_metrics.match_score.toFixed(0)}%</p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide mt-0.5">Match</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <p className="text-white text-sm font-bold">{toast.route.empathy_metrics.dropout_risk_pct}%</p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide mt-0.5">Dropout Risk</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2 text-center">
                  <p className="text-white text-sm font-bold">${toast.route.cost_analysis.cost_usd}</p>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide mt-0.5">Cost</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
