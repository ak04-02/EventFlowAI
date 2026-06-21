import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter } from 'recharts'

const COLORS = ['#6366f1','#8b5cf6','#14b8a6','#22d3ee','#f59e0b','#f97316','#ef4444']

function ScoreBar({ value, max=100, color }) {
  return (
    <div className="sbar">
      <div className="sbar-bg">
        <div className="sbar-fill" style={{width:`${(value/max)*100}%`,background:color}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color}}>{Math.round(value)}</span>
    </div>
  )
}

export default function ResourcePlanner({ api, health }) {
  const [resources, setResources] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (!health.ready) return
    Promise.all([
      fetch(`${api}/api/resources?limit=200`).then(r=>r.json()),
      fetch(`${api}/api/stats`).then(r=>r.json()),
    ]).then(([res, st]) => { setResources(res); setStats(st); setLoading(false) })
      .catch(() => setLoading(false))
  }, [api, health.ready])

  if (!health.ready) return <div className="empty"><div className="ei">⚙️</div><p>Processing…</p></div>
  if (loading) return <div className="loading"><div className="spinner"/><p>Loading resource data…</p></div>

  const filtered = filter==='All' ? resources : resources.filter(r=>r.esi_level===filter)

  // Aggregate resource needs by ESI level
  const agg = ['Low','Moderate','High','Critical'].map(level => {
    const g = resources.filter(r=>r.esi_level===level)
    if (!g.length) return {level, officers:0, barricades:0, tow:0, patrols:0, count:0}
    return {
      level,
      count: g.length,
      officers: Math.round(g.reduce((s,r)=>s+r.officers,0)/g.length),
      barricades: Math.round(g.reduce((s,r)=>s+r.barricades,0)/g.length),
      tow: Math.round(g.reduce((s,r)=>s+r.tow_vehicles,0)/g.length),
      patrols: Math.round(g.reduce((s,r)=>s+r.mobile_patrols,0)/g.length),
    }
  })

  const totalOfficers = resources.slice(0,50).reduce((s,r)=>s+r.officers,0)
  const totalBarricades = resources.slice(0,50).reduce((s,r)=>s+r.barricades,0)
  const totalTow = resources.slice(0,50).reduce((s,r)=>s+r.tow_vehicles,0)

  return (
    <div>
      <div className="insight-banner mb6">
        <div className="insight-icon">👮</div>
        <div className="insight-text">
          <h3>Manpower Optimization Engine</h3>
          <p>
            Instead of guessing how many officers to deploy, EventFlow AI computes optimal resource allocation
            using the ESI formula: <strong>Officers = ESI ÷ 5</strong>, scaled by corridor importance and road closure.
            Barricades, tow trucks, and mobile patrols are calculated similarly.
          </p>
        </div>
      </div>

      {/* Summary totals */}
      <div className="kpi-grid mb6">
        <div className="kpi indigo">
          <div className="kpi-icon">👮</div>
          <div className="kpi-value">{totalOfficers.toLocaleString()}</div>
          <div className="kpi-label">Officers Needed</div>
          <div className="kpi-sub">Top 50 active events</div>
        </div>
        <div className="kpi amber">
          <div className="kpi-icon">🚧</div>
          <div className="kpi-value">{totalBarricades.toLocaleString()}</div>
          <div className="kpi-label">Barricades Required</div>
          <div className="kpi-sub">Top 50 active events</div>
        </div>
        <div className="kpi rose">
          <div className="kpi-icon">🚗</div>
          <div className="kpi-value">{totalTow}</div>
          <div className="kpi-label">Tow Vehicles</div>
          <div className="kpi-sub">Top 50 active events</div>
        </div>
        <div className="kpi teal">
          <div className="kpi-icon">🚔</div>
          <div className="kpi-value">{resources.slice(0,50).reduce((s,r)=>s+r.mobile_patrols,0)}</div>
          <div className="kpi-label">Mobile Patrols</div>
          <div className="kpi-sub">Top 50 active events</div>
        </div>
      </div>

      {/* Average by ESI level */}
      <div className="g2 mb6">
        <div className="card">
          <h3>📊 Avg Officers by ESI Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agg} margin={{top:5,right:8,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="level" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}}/>
              <Bar dataKey="officers" name="Officers" radius={[4,4,0,0]}>
                {agg.map((_,i) => <Cell key={i} fill={['#10b981','#f59e0b','#f97316','#ef4444'][i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>🚧 Avg Resources by ESI Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agg} margin={{top:5,right:8,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="level" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}}/>
              <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}}/>
              <Bar dataKey="barricades" name="Barricades" fill="#6366f1" radius={[4,4,0,0]}/>
              <Bar dataKey="tow" name="Tow Vehicles" fill="#14b8a6" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resource Decision Matrix */}
      <div className="card mb6">
        <h3>🧮 Resource Allocation Decision Matrix</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {agg.map((g,i) => {
            const colors=['#10b981','#f59e0b','#f97316','#ef4444']
            const c = colors[i]
            return (
              <div key={g.level} style={{background:'var(--bg-secondary)',borderRadius:12,padding:'16px',border:`1px solid ${c}30`}}>
                <div style={{fontFamily:'Space Grotesk',fontSize:16,fontWeight:800,color:c,marginBottom:12}}>{g.level}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>{g.count} events</div>
                {[
                  {label:'Officers',val:g.officers,icon:'👮'},
                  {label:'Barricades',val:g.barricades,icon:'🚧'},
                  {label:'Tow Vehicles',val:g.tow,icon:'🚗'},
                  {label:'Patrols',val:g.patrols,icon:'🚔'},
                ].map(r=>(
                  <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:11,color:'var(--text-secondary)'}}>{r.icon} {r.label}</span>
                    <span style={{fontFamily:'Space Grotesk',fontWeight:700,fontSize:14,color:c}}>{r.val}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Detailed table */}
      <div className="section-head mb4">
        <span>📋</span><h2>Event Resource Plans</h2>
        <div className="tabs" style={{marginLeft:'auto'}}>
          {['All','Critical','High','Moderate','Low'].map(f=>(
            <button key={f} className={`tab ${filter===f?'active':''}`}
              onClick={()=>setFilter(f)} id={`res-filter-${f.toLowerCase()}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>#</th><th>ESI Level</th><th>ESI Score</th>
              <th>Officers</th><th>Barricades</th><th>Tow Vehicles</th><th>Mobile Patrols</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0,30).map((r,i) => {
                const c=r.esi_level==='Critical'?'#ef4444':r.esi_level==='High'?'#f97316':r.esi_level==='Moderate'?'#f59e0b':'#10b981'
                return (
                  <tr key={i}>
                    <td style={{color:'var(--text-muted)'}}>{i+1}</td>
                    <td><span className={`esi-badge ${r.esi_level}`}>{r.esi_level}</span></td>
                    <td><ScoreBar value={r.esi} color={c}/></td>
                    <td style={{fontFamily:'Space Grotesk',fontWeight:700,color:'#a5b4fc'}}>{r.officers}</td>
                    <td style={{fontFamily:'Space Grotesk',fontWeight:700,color:'#f59e0b'}}>{r.barricades}</td>
                    <td style={{fontFamily:'Space Grotesk',fontWeight:700,color:'#f97316'}}>{r.tow_vehicles}</td>
                    <td style={{fontFamily:'Space Grotesk',fontWeight:700,color:'#14b8a6'}}>{r.mobile_patrols}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
