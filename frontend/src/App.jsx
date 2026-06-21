import { useState, useEffect } from 'react'
import Overview from './pages/Overview'
import EventMap from './pages/EventMap'
import EventPlanner from './pages/EventPlanner'
import ResourcePlanner from './pages/ResourcePlanner'
import DiversionSim from './pages/DiversionSim'
import PostEventLearning from './pages/PostEventLearning'

export const API = 'http://localhost:8000'

const NAV = [
  { id: 'overview', label: 'Overview', icon: '📊', section: 'DASHBOARD' },
  { id: 'map', label: 'Event Impact Map', icon: '🗺️', section: null },
  { id: 'planner', label: 'Event Planner', icon: '📅', section: 'AI MODULES' },
  { id: 'resources', label: 'Resource Optimizer', icon: '👮', section: null },
  { id: 'diversion', label: 'Diversion Simulator', icon: '🔀', section: null },
  { id: 'learning', label: 'Post-Event Learning', icon: '🧠', section: null },
]

export default function App() {
  const [page, setPage] = useState('overview')
  const [health, setHealth] = useState({ ready: false, files: {} })

  useEffect(() => {
    const check = () =>
      fetch(`${API}/api/health`)
        .then(r => r.json()).then(setHealth)
        .catch(() => setHealth({ ready: false, files: {} }))
    check()
    const iv = setInterval(check, 8000)
    return () => clearInterval(iv)
  }, [])

  const renderPage = () => {
    const p = { api: API, health }
    switch (page) {
      case 'overview': return <Overview {...p} />
      case 'map': return <EventMap {...p} />
      case 'planner': return <EventPlanner {...p} />
      case 'resources': return <ResourcePlanner {...p} />
      case 'diversion': return <DiversionSim {...p} />
      case 'learning': return <PostEventLearning {...p} />
      default: return <Overview {...p} />
    }
  }

  const current = NAV.find(n => n.id === page)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-icon">⚡</div>
            <div className="logo-text">
              <h1>EventFlow AI</h1>
              <p>Traffic Intelligence Platform</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <div key={item.id}>
              {item.section && <div className="nav-label">{item.section}</div>}
              <div
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
                id={`nav-${item.id}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="pipeline-status">
            <h4>Pipeline Status</h4>
            {[
              ['Events', health.files?.['events.json']],
              ['ESI Model', health.files?.['forecast_model.pkl']],
              ['Heatmap', health.files?.['heatmap.json']],
              ['Diversions', health.files?.['diversions.json']],
              ['Learning', health.files?.['post_event_learning.json']],
            ].map(([label, ok]) => (
              <div className="status-row" key={label}>
                <span>{label}</span>
                <div className={`dot ${ok ? 'ok' : 'wait'}`} />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span>{current?.icon}</span>
            {current?.label}
          </div>
          <div className="topbar-chips">
            <div className={`chip ${health.ready ? 'chip-live' : 'chip-ai'}`}>
              <div className={`dot ${health.ready ? 'ok' : 'wait'}`} />
              {health.ready ? 'System Ready' : 'Processing…'}
            </div>
            <div className="chip chip-ai">GBM · RF Ensemble</div>
          </div>
        </header>

        <div className="page">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
