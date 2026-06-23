// App.jsx
import { useState, useEffect } from "react";
import {
    DashboardDots,
    Map,
    Calendar,
    UserSquare,
    Shuffle,
    Brain,
    WarningTriangle,
    ServerConnection,
    CheckCircle,
} from "iconoir-react";

import Overview from "./pages/Overview";
import EventMap from "./pages/EventMap";
import EventPlanner from "./pages/EventPlanner";
import ResourcePlanner from "./pages/ResourcePlanner";
import DiversionSim from "./pages/DiversionSim";
import PostEventLearning from "./pages/PostEventLearning";

export const API = "http://localhost:8000";

const NAV = [
    {
        id: "overview",
        label: "Overview",
        icon: <DashboardDots width={18} height={18} strokeWidth={1.5} />,
        section: "Dashboard",
    },
    {
        id: "map",
        label: "Impact Map",
        icon: <Map width={18} height={18} strokeWidth={1.5} />,
        section: null,
    },
    {
        id: "planner",
        label: "Event Planner",
        icon: <Calendar width={18} height={18} strokeWidth={1.5} />,
        section: "Intelligence",
    },
    {
        id: "resources",
        label: "Resource Optimizer",
        icon: <UserSquare width={18} height={18} strokeWidth={1.5} />,
        section: null,
    },
    {
        id: "diversion",
        label: "Diversion Simulator",
        icon: <Shuffle width={18} height={18} strokeWidth={1.5} />,
        section: null,
    },
    {
        id: "learning",
        label: "Learning Engine",
        icon: <Brain width={18} height={18} strokeWidth={1.5} />,
        section: null,
    },
];

export default function App() {
    const [page, setPage] = useState("overview");
    const [health, setHealth] = useState({ ready: false, files: {} });

    useEffect(() => {
        const check = () =>
            fetch(`${API}/api/health`)
                .then((r) => r.json())
                .then(setHealth)
                .catch(() => setHealth({ ready: false, files: {} }));
        check();
        const iv = setInterval(check, 8000);
        return () => clearInterval(iv);
    }, []);

    const renderPage = () => {
        const p = { api: API, health };
        switch (page) {
            case "overview":
                return <Overview {...p} />;
            case "map":
                return <EventMap {...p} />;
            case "planner":
                return <EventPlanner {...p} />;
            case "resources":
                return <ResourcePlanner {...p} />;
            case "diversion":
                return <DiversionSim {...p} />;
            case "learning":
                return <PostEventLearning {...p} />;
            default:
                return <Overview {...p} />;
        }
    };

    const current = NAV.find((n) => n.id === page);

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="logo-row">
                        <div className="logo-icon">
                            <ServerConnection
                                width={20}
                                height={20}
                                strokeWidth={2}
                            />
                        </div>
                        <div className="logo-text">
                            <h1>EventFlow AI</h1>
                            <p>Traffic Intelligence</p>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV.map((item) => (
                        <div key={item.id}>
                            {item.section && (
                                <div className="nav-label">{item.section}</div>
                            )}
                            <div
                                className={`nav-item ${page === item.id ? "active" : ""}`}
                                onClick={() => setPage(item.id)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="pipeline-status">
                        <h4>System Pipeline</h4>
                        {[
                            ["Events Stream", health.files?.["events.json"]],
                            [
                                "Forecast Model",
                                health.files?.["forecast_model.pkl"],
                            ],
                            [
                                "Routing Engine",
                                health.files?.["diversions.json"],
                            ],
                        ].map(([label, ok]) => (
                            <div className="status-row" key={label}>
                                <span>{label}</span>
                                {ok ? (
                                    <CheckCircle
                                        width={14}
                                        height={14}
                                        color="var(--green)"
                                        strokeWidth={2}
                                    />
                                ) : (
                                    <WarningTriangle
                                        width={14}
                                        height={14}
                                        color="var(--amber)"
                                        strokeWidth={2}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <div className="main">
                <header className="topbar">
                    <div className="topbar-title">{current?.label}</div>
                    <div className="topbar-chips">
                        <div
                            className={`chip ${health.ready ? "chip-live" : "chip-ai"}`}
                        >
                            <div
                                className={`dot ${health.ready ? "ok" : "wait"}`}
                            />
                            {health.ready ? "System Active" : "Initializing..."}
                        </div>
                    </div>
                </header>

                <div className="page">{renderPage()}</div>
            </div>
        </div>
    );
}
