import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from 'recharts'

const ESI_COLORS = {
  Critical: '#ef4444', High: '#f97316', Moderate: '#f59e0b', Low: '#10b981'
}
const COLORS = ['#6366f1','#8b5cf6','#14b8a6','#22d3ee','#f59e0b','#f97316','#ef4444','#10b981','#f43f5e','#a78bfa']

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ fontSize:14, fontWeight:700, color: p.color || '#a5b4fc' }}>
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

function KPI({ icon, value, label, sub, variant='indigo' }) {
  return (
    <div className={`kpi ${variant}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export default function Overview({ api, health }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${api}/api/stats`)
      .then(r => r.json()).then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [api, health.ready])

  if (loading) return <div className="loading"><div className="spinner"/><p>Loading analytics…</p></div>
  if (!stats)  return <div className="empty"><div className="ei">⚙️</div><p>Run the ML pipeline then refresh.</p></div>

  const esiPie = Object.entries(stats.esi_distribution || {}).map(([name, value]) => ({ name, value }))

  const radarData = [
    { axis: 'High ESI', val: Math.round((stats.high_events/stats.total_events)*100) },
    { axis: 'Critical', val: Math.round((stats.critical_events/stats.total_events)*100) },
    { axis: 'Road Closures', val: Math.round((stats.road_closures/stats.total_events)*100) },
    { axis: 'Peak Hour', val: Math.round(stats.avg_esi) },
    { axis: 'Planned', val: Math.round((stats.planned_events/stats.total_events)*100) },
  ]

  return (
    <div>
      <div className="insight-banner mb6">
        <div className="insight-icon">⚡</div>
        <div className="insight-text">
          <h3>EventFlow AI — {stats.total_events?.toLocaleString()} Traffic Events Analyzed</h3>
          <p>
            Our AI engine scored every event with the <strong>Event Severity Index (ESI)</strong>,
            achieving <strong>{stats.clf_accuracy}% classification accuracy</strong> on high-impact prediction.
            <strong> {stats.critical_events}</strong> Critical and <strong>{stats.high_events}</strong> High severity
            events were detected requiring immediate traffic management response.
          </p>
        </div>
      </div>

      <div className="kpi-grid mb8">
        <KPI icon="📋" value={stats.total_events?.toLocaleString()} label="Total Events" sub="Nov 23 – Apr 24" variant="indigo" />
        <KPI icon="🔴" value={stats.critical_events} label="Critical ESI Events" sub="ESI ≥ 80" variant="rose" />
        <KPI icon="🟠" value={stats.high_events} label="High Severity" sub="ESI 60–80" variant="amber" />
        <KPI icon="🚧" value={stats.road_closures} label="Road Closures" sub="Requires closure" variant="violet" />
        <KPI icon="📅" value={stats.planned_events} label="Planned Events" sub="Public events, VIP, etc." variant="teal" />
        <KPI icon="🤖" value={`${stats.clf_accuracy}%`} label="AI Accuracy" sub="High-impact classifier" variant="emerald" />
      </div>

      {/* Charts Row 1 */}
      <div className="g2 mb6">
        <div className="card">
          <h3>⏰ Event Activity by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.hourly} margin={{top:5,right:8,left:-22,bottom:0}}>
              <defs>
                <linearGradient id="gHour" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="hour" tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#gHour)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>📅 Events by Day of Week</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.dow} margin={{top:5,right:8,left:-22,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="day" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {stats.dow?.map((_,i) => <Cell key={i} fill={[5,6].includes(i)?'#8b5cf6':'#6366f1'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ESI Distribution + Radar */}
      <div className="g3 mb6">
        <div className="card">
          <h3>🎯 ESI Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={esiPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}>
                {esiPie.map((e,i) => <Cell key={i} fill={ESI_COLORS[e.name] || '#6366f1'}/>)}
              </Pie>
              <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}}/>
              <Legend formatter={v => <span style={{fontSize:11,color:'var(--text-secondary)'}}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{gridColumn:'span 2'}}>
          <h3>📈 Monthly Event Trend (Count + Avg ESI)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthly} margin={{top:5,right:8,left:-22,bottom:0}}>
              <defs>
                <linearGradient id="gMonth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <YAxis yAxisId="left" tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <Tooltip content={<Tip/>}/>
              <Area yAxisId="left" type="monotone" dataKey="count" stroke="#14b8a6" fill="url(#gMonth)" strokeWidth={2} name="Events"/>
              <Area yAxisId="right" type="monotone" dataKey="avg_esi" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Avg ESI"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cause + Zone + Corridor */}
      <div className="g3 mb6">
        <div className="card">
          <h3>⚠️ Event Causes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.cause_distribution?.slice(0,8)} layout="vertical" margin={{top:0,right:8,left:8,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <YAxis type="category" dataKey="cause" tick={{fontSize:9,fill:'var(--text-muted)'}} width={90}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="count" radius={[0,4,4,0]}>
                {stats.cause_distribution?.slice(0,8).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>🏙️ Zone Distribution</h3>
          <div style={{overflowY:'auto',maxHeight:200}}>
            {stats.zone_distribution?.map((z,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                <div style={{flex:1,fontSize:12,color:'var(--text-secondary)'}}>{z.zone}</div>
                <div style={{fontFamily:'Space Grotesk',fontWeight:700,fontSize:13}}>{z.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>🛣️ Top Corridors</h3>
          <div style={{overflowY:'auto',maxHeight:200}}>
            {stats.corridor_distribution?.map((c,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                <div style={{flex:1,fontSize:12,color:'var(--text-secondary)'}}>{c.corridor}</div>
                <div style={{fontFamily:'Space Grotesk',fontWeight:700,fontSize:13}}>{c.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top events */}
      <div className="section-head mb4">
        <span>🔥</span>
        <h2>Top Critical Events</h2>
        <span className="section-tag">Highest ESI</span>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>#</th><th>Cause</th><th>Corridor</th><th>Station</th>
              <th>ESI</th><th>Duration (h)</th><th>Road Closure</th><th>Status</th>
            </tr></thead>
            <tbody>
              {stats.top_events?.slice(0,15).map((e,i) => (
                <tr key={e.id}>
                  <td style={{color:'var(--text-muted)'}}>{i+1}</td>
                  <td style={{fontWeight:600,textTransform:'capitalize'}}>{e.event_cause}</td>
                  <td style={{fontSize:12}}>{e.corridor}</td>
                  <td style={{fontSize:12}}>{e.police_station}</td>
                  <td>
                    <span className={`esi-badge ${e.esi_level}`}>{e.esi_level} {e.esi?.toFixed(0)}</span>
                  </td>
                  <td style={{fontFamily:'Space Grotesk',fontWeight:600}}>{e.duration_hrs?.toFixed(1)}</td>
                  <td>{e.road_closure_flag ? '🚧 Yes' : '—'}</td>
                  <td style={{fontSize:11,color:e.status==='closed'?'var(--esi-low)':e.status==='active'?'var(--esi-high)':'var(--text-muted)'}}>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
