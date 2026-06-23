// src/pages/Overview.jsx
import { useState, useEffect } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import {
    ClipboardCheck,
    ShieldAlert,
    WarningTriangle,
    MapPinXmark,
    Calendar,
    Activity,
} from "iconoir-react";

const ESI_COLORS = {
    Critical: "var(--esi-critical)",
    High: "var(--esi-high)",
    Moderate: "var(--esi-moderate)",
    Low: "var(--esi-low)",
};
const COLORS = ["#58a6ff", "#bc8cff", "#3fb950", "#d29922", "#f85149"];

const Tip = ({ active, payload, label }) => {
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
                    marginBottom: 4,
                }}
            >
                {label}
            </p>
            {payload.map((p, i) => (
                <p
                    key={i}
                    style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: p.color || "var(--text-1)",
                    }}
                >
                    {typeof p.value === "number"
                        ? p.value.toLocaleString()
                        : p.value}
                </p>
            ))}
        </div>
    );
};

function KPI({ icon, value, label, sub }) {
    return (
        <div className="kpi">
            <div className="kpi-icon">{icon}</div>
            <div className="kpi-value">{value}</div>
            <div className="kpi-label">{label}</div>
            {sub && <div className="kpi-sub">{sub}</div>}
        </div>
    );
}

export default function Overview({ api, health }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${api}/api/stats`)
            .then((r) => r.json())
            .then((d) => {
                setStats(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [api, health.ready]);

    if (loading)
        return (
            <div className="loading">
                <div className="spinner" />
                <p>Loading intelligence data...</p>
            </div>
        );
    if (!stats)
        return (
            <div className="empty">
                <p>Awaiting ML pipeline execution.</p>
            </div>
        );

    const esiPie = Object.entries(stats.esi_distribution || {}).map(
        ([name, value]) => ({ name, value }),
    );

    return (
        <div>
            <div className="insight-banner mb6">
                <div className="insight-text">
                    <h3>Intelligence Summary</h3>
                    <p>
                        System has processed{" "}
                        <strong>{stats.total_events?.toLocaleString()}</strong>{" "}
                        traffic events with a classification accuracy of{" "}
                        <strong>{stats.clf_accuracy}%</strong>. Currently
                        monitoring
                        <strong> {stats.critical_events}</strong> Critical
                        severity incidents requiring immediate dispatch.
                    </p>
                </div>
            </div>

            <div className="kpi-grid mb8">
                <KPI
                    icon={<ClipboardCheck width={24} />}
                    value={stats.total_events?.toLocaleString()}
                    label="Total Events"
                    sub="Year to date"
                />
                <KPI
                    icon={
                        <ShieldAlert width={24} color="var(--esi-critical)" />
                    }
                    value={stats.critical_events}
                    label="Critical ESI"
                    sub="Immediate response required"
                />
                <KPI
                    icon={
                        <WarningTriangle width={24} color="var(--esi-high)" />
                    }
                    value={stats.high_events}
                    label="High Severity"
                    sub="Monitor closely"
                />
                <KPI
                    icon={<MapPinXmark width={24} />}
                    value={stats.road_closures}
                    label="Active Closures"
                    sub="Impacting routing"
                />
                <KPI
                    icon={<Calendar width={24} />}
                    value={stats.planned_events}
                    label="Planned Operations"
                    sub="Public & VIP movement"
                />
                <KPI
                    icon={<Activity width={24} color="var(--green)" />}
                    value={`${stats.clf_accuracy}%`}
                    label="Model Confidence"
                    sub="Predictive baseline"
                />
            </div>

            {/* Charts Row */}
            <div className="g2 mb6">
                <div className="card">
                    <h3>Temporal Activity Profile</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart
                            data={stats.hourly}
                            margin={{
                                top: 10,
                                right: 10,
                                left: -20,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient
                                    id="gHour"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="hour"
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<Tip />} />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="var(--accent)"
                                fill="url(#gHour)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <h3>Severity Distribution</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie
                                data={esiPie}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={2}
                                stroke="none"
                            >
                                {esiPie.map((e, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            ESI_COLORS[e.name] ||
                                            "var(--accent)"
                                        }
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(v) => v.toLocaleString()}
                                content={<Tip />}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(v) => (
                                    <span
                                        style={{
                                            color: "var(--text-2)",
                                            fontSize: 12,
                                        }}
                                    >
                                        {v}
                                    </span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
