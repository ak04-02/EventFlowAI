// src/pages/EventPlanner.jsx

import { useState } from "react";
import {
    Calendar,
    CheckCircle,
    WarningTriangle,
    Activity,
    Settings,
    Flash,
    ShieldCheck,
    Pin,
    UserSquare,
} from "iconoir-react";

const CAUSES = [
    "vehicle_breakdown",
    "accident",
    "public_event",
    "construction",
    "water_logging",
    "procession",
    "vip_movement",
    "protest",
    "pot_holes",
    "tree_fall",
    "congestion",
    "road_conditions",
    "others",
];
const CORRIDORS = [
    "Non-corridor",
    "Mysore Road",
    "Bellary Road 1",
    "Bellary Road 2",
    "Tumkur Road",
    "Hosur Road",
    "Old Madras Road",
    "ORR North 1",
    "ORR East 1",
    "Magadi Road",
];
const VEH_TYPES = [
    "private_car",
    "bmtc_bus",
    "heavy_vehicle",
    "truck",
    "lcv",
    "private_bus",
    "ksrtc_bus",
    "taxi",
    "auto",
    "others",
];
const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];
const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i === 0 ? "00:00 (12 AM)" : i < 10 ? `0${i}:00` : `${i}:00`,
}));

// Refined Tactical Gauge
function ESIGauge({ score, level, color }) {
    const angle = (score / 100) * 180 - 90;
    return (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
            <svg
                viewBox="0 0 200 110"
                width="220"
                height="120"
                style={{ margin: "0 auto", display: "block" }}
            >
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="var(--bg-overlay)"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke={`url(#eg)`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 251} 251`}
                    style={{
                        transition:
                            "stroke-dasharray 1s cubic-bezier(0.2, 0, 0, 1)",
                    }}
                />
                <defs>
                    <linearGradient id="eg" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--green)" />
                        <stop offset="40%" stopColor="var(--amber)" />
                        <stop offset="100%" stopColor="var(--red)" />
                    </linearGradient>
                </defs>
                <g
                    transform={`translate(100,100) rotate(${angle})`}
                    style={{
                        transition: "transform 1s cubic-bezier(0.2, 0, 0, 1)",
                    }}
                >
                    <line
                        x1="0"
                        y1="-10"
                        x2="0"
                        y2="-65"
                        stroke={color}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <circle
                        r="4"
                        fill="var(--bg-surface)"
                        stroke={color}
                        strokeWidth="2"
                    />
                </g>
                <text
                    x="100"
                    y="85"
                    textAnchor="middle"
                    fontSize="32"
                    fontWeight="600"
                    fill="var(--text-1)"
                    letterSpacing="-0.02em"
                >
                    {score}
                </text>
                <text
                    x="100"
                    y="105"
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-3)"
                    letterSpacing="0.05em"
                >
                    ESI PROJECTION
                </text>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color, marginTop: 8 }}>
                {level} RISK
            </div>
        </div>
    );
}

export default function EventPlanner({ api, health }) {
    const [form, setForm] = useState({
        event_cause: "public_event",
        priority: "High",
        road_closure: false,
        hour: 18,
        day_of_week: 5,
        is_weekend: 1,
        corridor: "Mysore Road",
        is_planned: 1,
        veh_type: "private_car",
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const presets = [
        {
            label: "Cricket Match",
            cause: "public_event",
            hour: 18,
            day: 5,
            corridor: "Chinnaswamy Road",
            priority: "High",
            closure: true,
        },
        {
            label: "VIP Movement",
            cause: "vip_movement",
            hour: 10,
            day: 1,
            corridor: "Bellary Road 1",
            priority: "High",
            closure: true,
        },
        {
            label: "Procession",
            cause: "procession",
            hour: 9,
            day: 6,
            corridor: "Mysore Road",
            priority: "High",
            closure: false,
        },
    ];

    const applyPreset = (p) =>
        setForm({
            event_cause: p.cause,
            priority: p.priority,
            road_closure: p.closure,
            hour: p.hour,
            day_of_week: p.day,
            is_weekend: p.day >= 5 ? 1 : 0,
            corridor: p.corridor,
            is_planned: 1,
            veh_type: "private_car",
        });

    const predict = async () => {
        if (!health.ready) {
            setError("Pipeline inactive.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const r = await fetch(`${api}/api/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    is_weekend: form.day_of_week >= 5 ? 1 : 0,
                }),
            });
            if (!r.ok) throw new Error("API error");
            setResult(await r.json());
        } catch (e) {
            setError("Prediction telemetry failed.");
        }
        setLoading(false);
    };

    const esiColor = (l) =>
        l === "Critical"
            ? "var(--red)"
            : l === "High"
              ? "var(--amber)"
              : l === "Moderate"
                ? "var(--amber)"
                : "var(--green)";

    return (
        <div>
            <div className="insight-banner mb6">
                <div
                    className="insight-icon"
                    style={{ color: "var(--accent)" }}
                >
                    <Calendar width={24} strokeWidth={1.5} />
                </div>
                <div className="insight-text">
                    <h3>Predictive Operations Planner</h3>
                    <p>
                        Input parameters for upcoming operations. The Gradient
                        Boosting + Random Forest ensemble will compute the
                        theoretical Event Severity Index (ESI), expected network
                        degradation, and calculate optimal resource deployment
                        quotas.
                    </p>
                </div>
            </div>

            <div className="g2">
                {/* Form Column */}
                <div className="card">
                    <h3>
                        <Settings width={18} /> Scenario Parameters
                    </h3>

                    <div style={{ marginBottom: 24 }}>
                        <p
                            style={{
                                fontSize: 10,
                                color: "var(--text-3)",
                                marginBottom: 8,
                                fontWeight: 600,
                                letterSpacing: "0.05em",
                            }}
                        >
                            QUICK PROTOCOLS
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                            {presets.map((p) => (
                                <button
                                    key={p.label}
                                    onClick={() => applyPreset(p)}
                                    style={{
                                        background: "var(--bg-overlay)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-2)",
                                        borderRadius: "var(--r-sm)",
                                        padding: "6px 12px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        fontWeight: 500,
                                    }}
                                    onMouseOver={(e) =>
                                        (e.target.style.color = "var(--text-1)")
                                    }
                                    onMouseOut={(e) =>
                                        (e.target.style.color = "var(--text-2)")
                                    }
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="fg">
                            <label>Classification</label>
                            <select
                                value={form.event_cause}
                                onChange={(e) =>
                                    setF("event_cause", e.target.value)
                                }
                            >
                                {CAUSES.map((c) => (
                                    <option key={c} value={c}>
                                        {c.replace(/_/g, " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="fg">
                            <label>Corridor Segment</label>
                            <select
                                value={form.corridor}
                                onChange={(e) =>
                                    setF("corridor", e.target.value)
                                }
                            >
                                {CORRIDORS.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="fg">
                            <label>Time of Day (24h)</label>
                            <select
                                value={form.hour}
                                onChange={(e) =>
                                    setF("hour", parseInt(e.target.value))
                                }
                            >
                                {HOURS.map((h) => (
                                    <option key={h.value} value={h.value}>
                                        {h.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="fg">
                            <label>Day of Week</label>
                            <select
                                value={form.day_of_week}
                                onChange={(e) =>
                                    setF(
                                        "day_of_week",
                                        parseInt(e.target.value),
                                    )
                                }
                            >
                                {DAYS.map((d, i) => (
                                    <option key={i} value={i}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Toggles */}
                        <div
                            className="fg"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                paddingTop: 16,
                            }}
                        >
                            <input
                                type="checkbox"
                                id="fc-closure"
                                checked={form.road_closure}
                                onChange={(e) =>
                                    setF("road_closure", e.target.checked)
                                }
                                style={{
                                    width: 16,
                                    height: 16,
                                    accentColor: "var(--accent)",
                                }}
                            />
                            <label
                                htmlFor="fc-closure"
                                style={{
                                    cursor: "pointer",
                                    margin: 0,
                                    textTransform: "none",
                                    letterSpacing: "normal",
                                }}
                            >
                                Requires Road Closure
                            </label>
                        </div>
                        <div
                            className="fg"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                paddingTop: 16,
                            }}
                        >
                            <input
                                type="checkbox"
                                id="fc-planned"
                                checked={form.is_planned === 1}
                                onChange={(e) =>
                                    setF("is_planned", e.target.checked ? 1 : 0)
                                }
                                style={{
                                    width: 16,
                                    height: 16,
                                    accentColor: "var(--accent)",
                                }}
                            />
                            <label
                                htmlFor="fc-planned"
                                style={{
                                    cursor: "pointer",
                                    margin: 0,
                                    textTransform: "none",
                                    letterSpacing: "normal",
                                }}
                            >
                                Planned Operation
                            </label>
                        </div>
                    </div>

                    <button
                        className="btn-predict"
                        onClick={predict}
                        disabled={loading || !health.ready}
                        style={{ marginTop: 8 }}
                    >
                        {loading
                            ? "Computing Output..."
                            : "Execute Forecast Model"}
                    </button>

                    {error && (
                        <div
                            style={{
                                marginTop: 16,
                                background: "var(--red-bg)",
                                border: "1px solid rgba(248,81,73,0.3)",
                                borderRadius: "var(--r-sm)",
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "var(--red)",
                                display: "flex",
                                gap: 8,
                            }}
                        >
                            <WarningTriangle width={16} /> {error}
                        </div>
                    )}
                </div>

                {/* Result Column */}
                <div className="card">
                    <h3>
                        <Activity width={18} /> Forecast Output
                    </h3>
                    {!result ? (
                        <div className="empty" style={{ padding: "48px 20px" }}>
                            <p>
                                Configure scenario parameters and execute the
                                model to view projections.
                            </p>
                        </div>
                    ) : (
                        <div className="result-box">
                            <ESIGauge
                                score={result.esi}
                                level={result.esi_level}
                                color={esiColor(result.esi_level)}
                            />

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 12,
                                    margin: "16px 0",
                                }}
                            >
                                {[
                                    {
                                        label: "Expected Delay",
                                        val: `${result.expected_delay_min?.toFixed(0)} min`,
                                        sub: "Baseline condition",
                                        icon: <Flash width={18} />,
                                    },
                                    {
                                        label: "With Diversion",
                                        val: `${result.expected_delay_with_diversion_min?.toFixed(0)} min`,
                                        sub: `-${result.congestion_reduction_pct}% delta`,
                                        icon: (
                                            <CheckCircle
                                                width={18}
                                                color="var(--green)"
                                            />
                                        ),
                                    },
                                    {
                                        label: "Impact Radius",
                                        val: `${result.affected_radius_km} km`,
                                        sub: "Blast zone",
                                        icon: <Pin width={18} />,
                                    },
                                    {
                                        label: "Confidence",
                                        val: `${result.high_impact_probability}%`,
                                        sub: "Model certainty",
                                        icon: <ShieldCheck width={18} />,
                                    },
                                ].map((m, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: "var(--bg-surface)",
                                            borderRadius: "var(--r-sm)",
                                            padding: "12px",
                                            border: "1px solid var(--border)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                marginBottom: 6,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    color: "var(--text-3)",
                                                }}
                                            >
                                                {m.icon}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 600,
                                                    color: "var(--text-1)",
                                                }}
                                            >
                                                {m.val}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: "var(--text-2)",
                                            }}
                                        >
                                            {m.label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--text-3)",
                                            }}
                                        >
                                            {m.sub}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Resource Quotas */}
                            <div style={{ marginTop: 24 }}>
                                <p
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: "var(--text-3)",
                                        letterSpacing: "0.05em",
                                        marginBottom: 10,
                                    }}
                                >
                                    COMPUTED DEPLOYMENT QUOTAS
                                </p>
                                <div className="resource-grid">
                                    {[
                                        {
                                            val: result.resources?.officers,
                                            label: "Officers",
                                        },
                                        {
                                            val: result.resources?.barricades,
                                            label: "Barricades",
                                        },
                                        {
                                            val: result.resources?.tow_vehicles,
                                            label: "Tow Trucks",
                                        },
                                        {
                                            val: result.resources
                                                ?.mobile_patrols,
                                            label: "Patrols",
                                        },
                                    ].map((r, i) => (
                                        <div
                                            key={i}
                                            className="resource-card"
                                            style={{ padding: "12px 8px" }}
                                        >
                                            <div
                                                className="rc-value"
                                                style={{
                                                    color: "var(--accent)",
                                                    fontSize: 20,
                                                }}
                                            >
                                                {r.val}
                                            </div>
                                            <div
                                                className="rc-label"
                                                style={{ marginTop: 2 }}
                                            >
                                                {r.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
