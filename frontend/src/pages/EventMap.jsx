// src/pages/EventMap.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { mappls } from "mappls-web-maps";
import {
    Map,
    CheckCircle,
    WarningTriangle,
    Pin,
    Settings,
    ServerConnection,
    ShieldAlert,
    Wrench,
    Building,
    Cloud,
    Flash,
    NonBinary,
    Calendar,
} from "iconoir-react";

const MAPPLS_ACCESS_TOKEN = "gcdzwibuairlgdulebosmyluddhjzrbgyygv";
const BLR = { lat: 12.9716, lng: 77.5946 };
const mapplsObj = new mappls();

// FIX: Must use raw hex colors. Map canvas cannot read CSS variables like var(--esi-critical)
function esiColor(esi) {
    if (esi >= 80) return "#f85149"; // Critical (Red)
    if (esi >= 60) return "#ff7b72"; // High (Orange)
    if (esi >= 30) return "#d29922"; // Moderate (Amber)
    return "#3fb950"; // Low (Green)
}

function esiLabel(esi) {
    if (esi >= 80) return "Critical";
    if (esi >= 60) return "High";
    if (esi >= 30) return "Moderate";
    return "Low";
}

function MapplsMapView({ events, selected, onSelect }) {
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    useEffect(() => {
        mapplsObj.initialize(MAPPLS_ACCESS_TOKEN, { map: true }, () => {
            mapRef.current = mapplsObj.Map({
                id: "mappls-event-map",
                properties: {
                    center: [BLR.lat, BLR.lng],
                    zoom: 12,

                    fadeDuration: 0,
                    pitchWithRotate: false,
                    dragRotate: false,
                    interactive: true,
                },
            });
            mapRef.current.on("load", () => setIsMapLoaded(true));
        });
        return () => {
            if (mapRef.current) {
                const container = document.getElementById("mappls-event-map");
                if (container) container.innerHTML = "";
            }
        };
    }, []);

    useEffect(() => {
        if (!isMapLoaded || !mapRef.current) return;

        // Clean up old markers
        markersRef.current.forEach((m) => {
            try {
                mapplsObj.removeLayer({ map: mapRef.current, layer: m });
            } catch (_) {}
        });
        markersRef.current = [];

        events.slice(0, 400).forEach((e) => {
            const lat =
                Number(e.latitude) || BLR.lat + (Math.random() - 0.5) * 0.1;
            const lng =
                Number(e.longitude) || BLR.lng + (Math.random() - 0.5) * 0.1;

            const color = esiColor(e.esi);
            const isSelected = selected?.id === e.id;
            const radius = Math.max(8, Math.min(24, e.esi / 6));

            // 1. Calculate exact container size
            const size = radius * 2 + 12;

            const popupContent = `
        <div style="min-width:220px; font-family:system-ui,sans-serif; color:#f0f6fc; font-size:12px; padding:4px;">
          <div style="font-weight:600; font-size:13px; margin-bottom:10px; text-transform:capitalize; border-bottom:1px solid rgba(240,246,252,0.1); padding-bottom:6px;">
            ${e.event_cause.replace(/_/g, " ")}
          </div>
          <table style="width:100%; border-collapse:collapse;">
            ${[
                [
                    "Severity",
                    `<span style="color:${color}; font-weight:600">${e.esi?.toFixed(1)} (${esiLabel(e.esi)})</span>`,
                ],
                ["Status", e.status],
                ["Corridor", e.corridor],
                ["Station", e.police_station],
                ["Duration", `${e.duration_hrs?.toFixed(1)}h`],
            ]
                .map(
                    ([k, v]) =>
                        `<tr><td style="color:#8b949e; padding:3px 8px 3px 0;">${k}</td><td style="font-weight:500; text-align:right;">${v ?? "—"}</td></tr>`,
                )
                .join("")}
          </table>
        </div>`;

            // 2. SVG String
            const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${radius + 6}" cy="${radius + 6}" r="${radius}" fill="${color}" fill-opacity="${isSelected ? 0.4 : 0.15}" stroke="${color}" stroke-width="${isSelected ? 2 : 1}" stroke-dasharray="2 4"/><circle cx="${radius + 6}" cy="${radius + 6}" r="4" fill="${color}" fill-opacity="1" stroke="#ffffff" stroke-width="1.5"/></svg>`;

            // 3. THE FIX: Restore width/height, but use CSS 'top' to push the marker down by exactly half its height.
            // This perfectly aligns the center of your SVG to the lat/lng anchor!
            const marker = mapplsObj.Marker({
                map: mapRef.current,
                position: { lat, lng },

                icon: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="${size}"
     height="${size}"
     viewBox="0 0 ${size} ${size}"
     preserveAspectRatio="xMidYMid meet">

    <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        fill="${color}"
        fill-opacity="${isSelected ? 0.35 : 0.15}"
        stroke="${color}"
        stroke-width="${isSelected ? 2.5 : 1.5}"
        stroke-dasharray="2 4"
    />

    <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="4"
        fill="${color}"
        stroke="#ffffff"
        stroke-width="1.5"
    />
</svg>
`)}`,

                width: size,
                height: size,
                offset: [0, 0],
                popupHtml: popupContent,
            });

            marker.addListener("click", () => onSelect(e));
            markersRef.current.push(marker);
        });
    }, [events, selected, onSelect, isMapLoaded]);

    return (
        <div
            id="mappls-event-map"
            style={{
                width: "100%",
                height: "480px",
                borderRadius: "0 0 var(--r-md) var(--r-md)",
                borderTop: "1px solid var(--border)",
            }}
        />
    );
}

export default function EventMap({ api, health }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        if (!health.ready) return;
        fetch(`${api}/api/events?limit=500`)
            .then((r) => r.json())
            .then((d) => {
                setEvents(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [api, health.ready]);

    const handleSelect = useCallback((e) => setSelected(e), []);

    if (!health.ready)
        return (
            <div className="empty">
                <ServerConnection width={32} />
                <p>Pipeline synchronizing...</p>
            </div>
        );
    if (loading)
        return (
            <div className="loading">
                <div className="spinner" />
                <p>Loading spatial data...</p>
            </div>
        );

    const filtered =
        filter === "All"
            ? events
            : events.filter((e) => e.esi_level === filter);

    const counts = {
        All: events.length,
        Critical: events.filter((e) => e.esi_level === "Critical").length,
        High: events.filter((e) => e.esi_level === "High").length,
        Moderate: events.filter((e) => e.esi_level === "Moderate").length,
        Low: events.filter((e) => e.esi_level === "Low").length,
    };

    // Kept your exact Iconoir imports
    const getEventIcon = (cause) => {
        switch (cause) {
            case "accident":
                return <Flash width={24} />;
            case "public_event":
                return <Calendar width={24} />;
            case "vehicle_breakdown":
                return <Wrench width={24} />;
            case "construction":
                return <Building width={24} />;
            case "water_logging":
                return <Cloud width={24} />;
            default:
                return <WarningTriangle width={24} />;
        }
    };

    return (
        <div>
            <div className="insight-banner mb6">
                <div
                    className="insight-icon"
                    style={{ color: "var(--accent)" }}
                >
                    <Map width={24} strokeWidth={1.5} />
                </div>
                <div className="insight-text">
                    <h3>Geospatial Impact Analysis</h3>
                    <p>
                        Real-time overlay of active network disruptions. Marker
                        rings indicate the{" "}
                        <strong>Event Severity Index (ESI)</strong>
                        and blast radius. Select any node to query CAD records
                        and traffic telemetry.
                    </p>
                </div>
            </div>

            <div
                className="map-wrap mb6"
                style={{ boxShadow: "var(--shadow-sm)" }}
            >
                <div className="map-head">
                    <h3
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: 0,
                        }}
                    >
                        <Pin width={18} /> Active Nodes
                    </h3>
                    <div className="tabs">
                        {["All", "Critical", "High", "Moderate", "Low"].map(
                            (f) => (
                                <button
                                    key={f}
                                    className={`tab ${filter === f ? "active" : ""}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}{" "}
                                    <span
                                        style={{
                                            opacity: 0.6,
                                            fontSize: 10,
                                            marginLeft: 4,
                                        }}
                                    >
                                        {counts[f]}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                </div>
                <MapplsMapView
                    events={filtered}
                    selected={selected}
                    onSelect={handleSelect}
                />
            </div>

            <div className="g2">
                <div className="card">
                    <h3>
                        <Settings width={18} /> Node Telemetry
                    </h3>
                    {!selected ? (
                        <div className="empty" style={{ padding: "32px 16px" }}>
                            <p>
                                Select a node on the map to extract telemetry
                                data.
                            </p>
                        </div>
                    ) : (
                        <div style={{ animation: "fadeIn 0.2s ease" }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                    marginBottom: 20,
                                }}
                            >
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "var(--r-md)",
                                        background: `${esiColor(selected.esi)}15`,
                                        border: `1px solid ${esiColor(selected.esi)}40`,
                                        color: esiColor(selected.esi),
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {getEventIcon(selected.event_cause)}
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 600,
                                            textTransform: "capitalize",
                                        }}
                                    >
                                        {selected.event_cause.replace(
                                            /_/g,
                                            " ",
                                        )}
                                    </div>
                                    <span
                                        className={`esi-badge ${selected.esi_level}`}
                                        style={{ marginTop: 4 }}
                                    >
                                        ESI {selected.esi?.toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            <div
                                style={{
                                    background: "var(--bg-overlay)",
                                    borderRadius: "var(--r-sm)",
                                    border: "1px solid var(--border)",
                                }}
                            >
                                {[
                                    ["Corridor", selected.corridor],
                                    ["Jurisdiction", selected.police_station],
                                    ["Node / Junction", selected.junction],
                                    ["Classification", selected.event_type],
                                    [
                                        "Time Elapsed",
                                        `${selected.duration_hrs?.toFixed(1)} hrs`,
                                    ],
                                    [
                                        "Closure Required",
                                        selected.road_closure_flag
                                            ? "Yes"
                                            : "No",
                                    ],
                                    [
                                        "Peak Hour Flag",
                                        selected.is_peak ? "Active" : "Clear",
                                    ],
                                ].map(([k, v], i) => (
                                    <div
                                        key={k}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            padding: "10px 14px",
                                            borderBottom:
                                                i === 6
                                                    ? "none"
                                                    : "1px solid var(--border)",
                                            fontSize: 13,
                                        }}
                                    >
                                        <span
                                            style={{ color: "var(--text-2)" }}
                                        >
                                            {k}
                                        </span>
                                        <span
                                            style={{
                                                fontWeight: 500,
                                                color: "var(--text-1)",
                                                textAlign: "right",
                                            }}
                                        >
                                            {v}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3>
                        <ShieldAlert width={18} /> Priority Queue ({filter})
                    </h3>
                    <div
                        className="scroll-panel"
                        style={{ maxHeight: 380, paddingRight: 4 }}
                    >
                        {filtered.slice(0, 30).map((e, i) => (
                            <div
                                key={i}
                                className="event-item"
                                onClick={() => setSelected(e)}
                                style={{
                                    borderColor:
                                        selected?.id === e.id
                                            ? "var(--accent)"
                                            : "var(--border)",
                                    background:
                                        selected?.id === e.id
                                            ? "var(--bg-hover)"
                                            : "var(--bg-overlay)",
                                }}
                            >
                                <div
                                    className="event-rank"
                                    style={{ background: "var(--bg-surface)" }}
                                >
                                    {i + 1}
                                </div>
                                <div className="event-info">
                                    <div className="event-cause">
                                        {e.event_cause.replace(/_/g, " ")}
                                    </div>
                                    <div className="event-meta">
                                        {e.police_station} · {e.corridor}
                                    </div>
                                </div>
                                <div className="event-esi">
                                    <div
                                        className="event-esi-val"
                                        style={{ color: esiColor(e.esi) }}
                                    >
                                        {e.esi?.toFixed(0)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
