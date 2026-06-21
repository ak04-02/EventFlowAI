import { useState, useEffect, useRef, useCallback } from 'react'
import { mappls } from 'mappls-web-maps'

// ─── Mappls API Key ────────────────────────────────────────────────────────────
// Get your key from: https://auth.mappls.com/console
const MAPPLS_ACCESS_TOKEN = 'gcdzwibuairlgdulebosmyluddhjzrbgyygv'

// Bengaluru centre coordinates
const BLR = { lat: 12.9716, lng: 77.5946 }

// Initialize the Mappls wrapper class exactly once outside the component 
// to prevent React re-renders from creating infinite map instances.
const mapplsObj = new mappls()

// ─── ESI helpers ──────────────────────────────────────────────────────────────
function esiColor(esi) {
  if (esi >= 80) return '#ef4444'
  if (esi >= 60) return '#f97316'
  if (esi >= 30) return '#f59e0b'
  return '#10b981'
}
function esiLabel(esi) {
  if (esi >= 80) return 'Critical'
  if (esi >= 60) return 'High'
  if (esi >= 30) return 'Moderate'
  return 'Low'
}

// ─── Mappls Map Component ─────────────────────────────────────────────────────
function MapplsMapView({ events, selected, onSelect }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // 1. Initialize map once
  useEffect(() => {
    mapplsObj.initialize(MAPPLS_ACCESS_TOKEN, { map: true }, () => {
      mapRef.current = mapplsObj.Map({
        id: 'mappls-event-map',
        properties: {
          center: [BLR.lat, BLR.lng],
          zoom: 12,
        }
      })

      mapRef.current.on('load', () => {
        setIsMapLoaded(true)
      })
    })

    return () => {
      if (mapRef.current) {
        const container = document.getElementById('mappls-event-map')
        if (container) container.innerHTML = ''
      }
    }
  }, [])

  // 2. Render event markers
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return

    // Remove old markers correctly
    markersRef.current.forEach(m => {
      try { mapplsObj.removeLayer({ map: mapRef.current, layer: m }) } catch (_) { }
    })
    markersRef.current = []

    events.slice(0, 400).forEach((e) => {
      const color = esiColor(e.esi)
      const radius = Math.max(6, Math.min(22, e.esi / 7))
      const isSelected = selected?.id === e.id

      // Build popup HTML
      const popupContent = `
        <div style="min-width:210px;font-family:Inter,sans-serif;color:#e2e8f0;font-size:13px;padding:4px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;text-transform:capitalize">
            ${e.event_cause.replace(/_/g, ' ')}
          </div>
          <table style="font-size:12px;width:100%;border-collapse:collapse">
            ${[
          ['ESI Score', `${e.esi?.toFixed(1)} — ${esiLabel(e.esi)}`],
          ['Status', e.status],
          ['Corridor', e.corridor],
          ['Station', e.police_station],
          ['Zone', e.zone],
          ['Duration', `${e.duration_hrs?.toFixed(1)}h`],
          ['Road Closure', e.road_closure_flag ? 'Yes' : 'No'],
          ['Type', e.event_type],
        ].map(([k, v]) => `
              <tr>
                <td style="color:#94a3b8;padding-right:8px;padding-bottom:3px">${k}</td>
                <td style="font-weight:600;color:#e2e8f0">${v ?? '—'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `

      // 🛑 THE FIX IS HERE
      const marker = mapplsObj.Marker({
        map: mapRef.current,
        position: { lat: e.latitude, lng: e.longitude },

        // 1. Pass the SVG directly as a string URL (prevents the crash)
        icon: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="${radius * 2 + 8}" height="${radius * 2 + 8}">
            <circle
              cx="${radius + 4}" cy="${radius + 4}" r="${radius}"
              fill="${color}" fill-opacity="${isSelected ? 0.95 : 0.6}"
              stroke="${color}" stroke-width="${isSelected ? 3 : 1.5}"
            />
          </svg>
        `)}`,

        // 2. Set dimensions natively so Mapbox knows how big the image is
        width: radius * 2 + 8,
        height: radius * 2 + 8,

        // 3. Offset [0,0] strictly anchors the exact center of the SVG to the coordinate, eliminating zoom drift!
        offset: [0, 0],

        popupHtml: popupContent
      })

      marker.addListener('click', () => {
        onSelect(e)
      })

      markersRef.current.push(marker)
    })
  }, [events, selected, onSelect, isMapLoaded])

  return (
    <div
      id="mappls-event-map"
      style={{ width: '100%', height: '480px', borderRadius: '0 0 12px 12px' }}
    />
  )
}

// ─── Main EventMap Page ───────────────────────────────────────────────────────
export default function EventMap({ api, health }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!health.ready) return
    fetch(`${api}/api/events?limit=500`)
      .then(r => r.json())
      .then(d => { setEvents(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [api, health.ready])

  const handleSelect = useCallback((e) => setSelected(e), [])

  if (!health.ready) return (
    <div className="empty"><div className="ei">⚙️</div><p>ML pipeline processing…</p></div>
  )
  if (loading) return <div className="loading"><div className="spinner" /><p>Loading map data…</p></div>

  const filtered = filter === 'All' ? events : events.filter(e => e.esi_level === filter)

  const counts = {
    All: events.length,
    Critical: events.filter(e => e.esi_level === 'Critical').length,
    High: events.filter(e => e.esi_level === 'High').length,
    Moderate: events.filter(e => e.esi_level === 'Moderate').length,
    Low: events.filter(e => e.esi_level === 'Low').length,
  }

  return (
    <div>
      <div className="insight-banner mb6">
        <div className="insight-icon">🗺️</div>
        <div className="insight-text">
          <h3>Event Impact Map — Bengaluru Traffic Events</h3>
          <p>
            Circle size and color reflect the <strong>Event Severity Index (ESI)</strong>.
            Red = Critical (ESI ≥ 80) · Orange = High (60–80) · Yellow = Moderate (30–60) · Green = Low.
            Click any marker to see detailed impact analysis. Powered by <strong>Mappls (MapMyIndia)</strong>.
          </p>
        </div>
      </div>

      <div className="map-wrap mb6">
        <div className="map-head">
          <h3>📍 Bengaluru Event Intelligence Map</h3>
          <div className="tabs">
            {['All', 'Critical', 'High', 'Moderate', 'Low'].map(f => (
              <button
                key={f}
                className={`tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
                id={`map-filter-${f.toLowerCase()}`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {/* ── Mappls Map ── */}
        <MapplsMapView
          events={filtered}
          selected={selected}
          onSelect={handleSelect}
        />
      </div>

      {/* Selected event detail + event list */}
      <div className="g2">
        {/* Detail panel */}
        <div className="card">
          <h3>📋 {selected ? 'Selected Event Detail' : 'Click a map marker to inspect'}</h3>
          {!selected ? (
            <div className="empty" style={{ padding: '32px 16px' }}>
              <div className="ei">📍</div>
              <p>Click any event circle on the map to see full details here.</p>
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  background: `${esiColor(selected.esi)}20`,
                  border: `2px solid ${esiColor(selected.esi)}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {selected.event_cause === 'accident' ? '💥' : selected.event_cause === 'public_event' ? '🎉' :
                    selected.event_cause === 'vehicle_breakdown' ? '🔧' : selected.event_cause === 'construction' ? '🏗️' :
                      selected.event_cause === 'water_logging' ? '🌊' : '⚠️'}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>
                    {selected.event_cause.replace(/_/g, ' ')}
                  </div>
                  <span className={`esi-badge ${selected.esi_level}`}>ESI {selected.esi?.toFixed(1)} — {selected.esi_level}</span>
                </div>
              </div>
              {[
                ['Corridor', selected.corridor],
                ['Police Station', selected.police_station],
                ['Zone', selected.zone],
                ['Junction', selected.junction],
                ['Status', selected.status],
                ['Type', selected.event_type],
                ['Duration', `${selected.duration_hrs?.toFixed(1)} hours`],
                ['Road Closure', selected.road_closure_flag ? '🚧 Required' : 'No'],
                ['Vehicle Type', selected.veh_type || '—'],
                ['Peak Hour', selected.is_peak ? '⚡ Yes' : 'No'],
                ['Date', selected.start_datetime?.slice(0, 16)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: 180 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {selected.esi_desc}
              </div>
            </div>
          )}
        </div>

        {/* Event list */}
        <div className="card">
          <h3>🔥 High Impact Events ({filter})</h3>
          <div className="scroll-panel" style={{ maxHeight: 380 }}>
            {filtered.slice(0, 30).map((e, i) => (
              <div
                key={i}
                className="event-item"
                onClick={() => setSelected(e)}
                style={{ borderColor: selected?.id === e.id ? esiColor(e.esi) + '60' : undefined }}
              >
                <div className="event-rank">{i + 1}</div>
                <div className="event-info">
                  <div className="event-cause">{e.event_cause.replace(/_/g, ' ')}</div>
                  <div className="event-meta">{e.police_station} · {e.corridor} · {e.duration_hrs?.toFixed(1)}h</div>
                </div>
                <div className="event-esi">
                  <div className="event-esi-val" style={{ color: esiColor(e.esi) }}>{e.esi?.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.esi_level}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}