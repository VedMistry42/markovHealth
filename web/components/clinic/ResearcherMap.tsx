"use client"
import { useRef, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { HUBS, MOCK_PATIENTS, MOBILE_UNITS } from "@/data/mockTrialCriteria"

import 'mapbox-gl/dist/mapbox-gl.css'

// Dynamically import mapbox-gl only on client to avoid SSR issues
export default function ResearcherMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

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

        // Patient markers (soft pulsing avatars)
        MOCK_PATIENTS.forEach((patient) => {
          const color = patient.status === "dispatched" ? "#f59e0b" : patient.status === "matched" ? "#10b981" : "#6b7280"
          const el = document.createElement("div")
          el.innerHTML = `
            <div class="relative flex h-4 w-4">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background:${color};"></span>
              <span class="relative inline-flex rounded-full h-4 w-4" style="background:${color}; border: 1.5px solid rgba(255,255,255,0.7);"></span>
            </div>
          `
          new mapboxgl.default.Marker({ element: el })
            .setLngLat([patient.lng, patient.lat])
            .setPopup(new mapboxgl.default.Popup({ offset: 12 }).setHTML(`<p style="color:#111;font-size:12px;font-weight:600">${patient.label}</p><p style="color:#555;font-size:11px;text-transform:capitalize">${patient.status}</p>`))
            .addTo(map)
        })

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

        // Dispatch routes — animated dashed lines from hubs to dispatched patients
        const dispatchedPatients = MOCK_PATIENTS.filter((p) => p.status === "dispatched")
        dispatchedPatients.forEach((patient, i) => {
          const nearestHub = HUBS[i % HUBS.length]
          const routeId = `route-${patient.id}`

          map.addSource(routeId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [nearestHub.lng, nearestHub.lat],
                  [patient.lng, patient.lat],
                ],
              },
            },
          })

          map.addLayer({
            id: routeId,
            type: "line",
            source: routeId,
            paint: {
              "line-color": "#f59e0b",
              "line-width": 2,
              "line-dasharray": [2, 2],
              "line-opacity": 0.7,
            },
          })
        })
      })
    })

    return () => {
      if (map) map.remove()
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gray-950 flex items-center justify-center"
        >
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
