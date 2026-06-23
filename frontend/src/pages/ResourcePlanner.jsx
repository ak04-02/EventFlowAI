// src/pages/ResourcePlanner.jsx

import { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import {
    UserSquare,
    Car,
    ShieldCheck,
    Activity,
    Table2Columns,
    CheckCircle,
} from "iconoir-react";

// Reusable Tactical Tooltip
const TacticalTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: "var(--bg-overlay)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "12px 16px",
                boxShadow: "var(--shadow-md)",
            }}
        >
            <p
                style={{
                    fontSize: 12,
                    color: "var(--text-2)",
                    marginBottom: 6,
                }}
            >
                {label}
            </p>
            {payload.map((p, i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                    }}
                >
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: p.color || "var(--text-1)",
                        }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                        {p.name}:
                    </span>
                    <span
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-1)",
                        }}
                    >
                        {p.value} Units
                    </span>
                </div>
            ))}
        </div>
    );
};

function ScoreBar({ value, max = 100, color }) {
    return (
        <div className="sbar">
            <div className="sbar-bg">
                <div
                    className="sbar-fill"
                    style={{
                        width: `${(value / max) * 100}%`,
                        background: color,
                    }}
                />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>
                {Math.round(value)}
            </span>
        </div>
    );
}

export default function ResourcePlanner({ api, health }) {
    const [resources, setResources] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        if (!health.ready) return;
        Promise.all([
            fetch(`${api}/api/resources?limit=200`).then((r) => r.json()),
            fetch(`${api}/api/stats`).then((r) => r.json()),
        ])
            .then(([res, st]) => {
                setResources(res);
                setStats(st);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [api, health.ready]);

    if (!health.ready)
        return (
            <div className="empty">
                <p>System initializing...</p>
            </div>
        );
    if (loading)
        return (
            <div className="loading">
                <div className="spinner" />
                <p>Computing allocation arrays...</p>
            </div>
        );

    const filtered =
        filter === "All"
            ? resources
            : resources.filter((r) => r.esi_level === filter);

    const agg = ["Low", "Moderate", "High", "Critical"].map((level) => {
        const g = resources.filter((r) => r.esi_level === level);
        if (!g.length)
            return {
                level,
                officers: 0,
                barricades: 0,
                tow: 0,
                patrols: 0,
                count: 0,
            };
        return {
            level,
            count: g.length,
            officers: Math.round(
                g.reduce((s, r) => s + r.officers, 0) / g.length,
            ),
            barricades: Math.round(
                g.reduce((s, r) => s + r.barricades, 0) / g.length,
            ),
            tow: Math.round(
                g.reduce((s, r) => s + r.tow_vehicles, 0) / g.length,
            ),
            patrols: Math.round(
                g.reduce((s, r) => s + r.mobile_patrols, 0) / g.length,
            ),
        };
    });

    const totalOfficers = resources
        .slice(0, 50)
        .reduce((s, r) => s + r.officers, 0);
    const totalBarricades = resources
        .slice(0, 50)
        .reduce((s, r) => s + r.barricades, 0);
    const totalTow = resources
        .slice(0, 50)
        .reduce((s, r) => s + r.tow_vehicles, 0);

    return (
        <div>
            <div className="insight-banner mb6">
                <div
                    className="insight-icon"
                    style={{ color: "var(--accent)" }}
                >
                    <UserSquare width={24} strokeWidth={1.5} />
                </div>
                <div className="insight-text">
                    <h3>Logistics & Manpower Engine</h3>
                    <p>
                        Algorithmic resource allocation. Based on ESI severity
                        parameters, corridor criticality, and closure
                        requirements, the system automatically computes optimal
                        unit dispatch minimums to stabilize network flow.
                    </p>
                </div>
            </div>

            <div className="kpi-grid mb6">
                <div className="kpi">
                    <div className="kpi-icon">
                        <UserSquare width={22} color="var(--accent)" />
                    </div>
                    <div className="kpi-value">
                        {totalOfficers.toLocaleString()}
                    </div>
                    <div className="kpi-label">Active Personnel</div>
                    <div className="kpi-sub">Required for top 50 nodes</div>
                </div>
                <div className="kpi">
                    <div className="kpi-icon">
                        <Activity width={22} color="var(--amber)" />
                    </div>
                    <div className="kpi-value">
                        {totalBarricades.toLocaleString()}
                    </div>
                    <div className="kpi-label">Deployed Barriers</div>
                    <div className="kpi-sub">Required for top 50 nodes</div>
                </div>
                <div className="kpi">
                    <div className="kpi-icon">
                        <Car width={22} color="var(--red)" />
                    </div>
                    <div className="kpi-value">{totalTow}</div>
                    <div className="kpi-label">Tow / Recovery</div>
                    <div className="kpi-sub">Required for top 50 nodes</div>
                </div>
                <div className="kpi">
                    <div className="kpi-icon">
                        <ShieldCheck width={22} color="var(--green)" />
                    </div>
                    <div className="kpi-value">
                        {resources
                            .slice(0, 50)
                            .reduce((s, r) => s + r.mobile_patrols, 0)}
                    </div>
                    <div className="kpi-label">Mobile Patrols</div>
                    <div className="kpi-sub">Required for top 50 nodes</div>
                </div>
            </div>

            <div className="g2 mb6">
                <div className="card">
                    <h3>
                        <Activity width={18} /> Baseline Personnel by Severity
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                            data={agg}
                            margin={{
                                top: 10,
                                right: 10,
                                left: -20,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="level"
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                content={<TacticalTooltip />}
                                cursor={{ fill: "var(--bg-hover)" }}
                            />
                            <Bar
                                dataKey="officers"
                                name="Officers"
                                radius={[4, 4, 0, 0]}
                            >
                                {agg.map((_, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            [
                                                "var(--green)",
                                                "var(--amber)",
                                                "var(--esi-high)",
                                                "var(--red)",
                                            ][i]
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="card">
                    <h3>Baseline Hardware by Severity</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                            data={agg}
                            margin={{
                                top: 10,
                                right: 10,
                                left: -20,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="level"
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                content={<TacticalTooltip />}
                                cursor={{ fill: "var(--bg-hover)" }}
                            />
                            <Bar
                                dataKey="barricades"
                                name="Barricades"
                                fill="var(--accent)"
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="tow"
                                name="Recovery Units"
                                fill="var(--violet)"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card mb6">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 20,
                    }}
                >
                    <h3>
                        <Table2Columns width={18} /> Standard Operating Matrix
                    </h3>
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            letterSpacing: "0.05em",
                        }}
                    >
                        SYSTEM-GENERATED ALLOCATION
                    </span>
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4,1fr)",
                        gap: 16,
                    }}
                >
                    {agg.map((g, i) => {
                        const colors = [
                            "var(--green)",
                            "var(--amber)",
                            "var(--esi-high)",
                            "var(--red)",
                        ];
                        const c = colors[i];
                        return (
                            <div
                                key={g.level}
                                style={{
                                    background: "var(--bg-overlay)",
                                    borderRadius: "var(--r-sm)",
                                    padding: "20px",
                                    border: `1px solid var(--border)`,
                                    borderTop: `3px solid ${c}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: "var(--text-1)",
                                        marginBottom: 4,
                                    }}
                                >
                                    {g.level} Risk
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-3)",
                                        marginBottom: 16,
                                    }}
                                >
                                    {g.count} active profiles
                                </div>
                                {[
                                    {
                                        label: "Officers",
                                        val: g.officers,
                                        icon: <UserSquare width={16} />,
                                    },
                                    {
                                        label: "Barricades",
                                        val: g.barricades,
                                        icon: <Activity width={16} />,
                                    },
                                    {
                                        label: "Recovery",
                                        val: g.tow,
                                        icon: <Car width={16} />,
                                    },
                                    {
                                        label: "Patrols",
                                        val: g.patrols,
                                        icon: <ShieldCheck width={16} />,
                                    },
                                ].map((r) => (
                                    <div
                                        key={r.label}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: 10,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: "var(--text-2)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            {r.icon} {r.label}
                                        </span>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                fontSize: 14,
                                                color: "var(--text-1)",
                                            }}
                                        >
                                            {r.val}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="card">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <h3>
                        <CheckCircle width={18} /> Active Node Dispatch Orders
                    </h3>
                    <div className="tabs">
                        {["All", "Critical", "High", "Moderate", "Low"].map(
                            (f) => (
                                <button
                                    key={f}
                                    className={`tab ${filter === f ? "active" : ""}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </button>
                            ),
                        )}
                    </div>
                </div>
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Queue ID</th>
                                <th>Threat Level</th>
                                <th>ESI Telemetry</th>
                                <th>Personnel</th>
                                <th>Barriers</th>
                                <th>Recovery</th>
                                <th>Patrols</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 30).map((r, i) => {
                                const c =
                                    r.esi_level === "Critical"
                                        ? "var(--red)"
                                        : r.esi_level === "High"
                                          ? "var(--esi-high)"
                                          : r.esi_level === "Moderate"
                                            ? "var(--amber)"
                                            : "var(--green)";
                                return (
                                    <tr key={i}>
                                        <td
                                            style={{
                                                color: "var(--text-3)",
                                                fontFamily: "monospace",
                                            }}
                                        >
                                            {String(i + 1).padStart(3, "0")}
                                        </td>
                                        <td>
                                            <span
                                                className={`esi-badge ${r.esi_level}`}
                                            >
                                                {r.esi_level}
                                            </span>
                                        </td>
                                        <td>
                                            <ScoreBar value={r.esi} color={c} />
                                        </td>
                                        <td
                                            style={{
                                                fontWeight: 600,
                                                color: "var(--text-1)",
                                            }}
                                        >
                                            {r.officers}
                                        </td>
                                        <td
                                            style={{
                                                fontWeight: 600,
                                                color: "var(--text-1)",
                                            }}
                                        >
                                            {r.barricades}
                                        </td>
                                        <td
                                            style={{
                                                fontWeight: 600,
                                                color: "var(--text-1)",
                                            }}
                                        >
                                            {r.tow_vehicles}
                                        </td>
                                        <td
                                            style={{
                                                fontWeight: 600,
                                                color: "var(--text-1)",
                                            }}
                                        >
                                            {r.mobile_patrols}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
