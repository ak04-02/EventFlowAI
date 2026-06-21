import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function SimCard({ sim, isSelected, onSelect }) {
  const esi = sim.esi
  const color = esi>=80?'#ef4444':esi>=60?'#f97316':esi>=30?'#f59e0b':'#10b981'
  const saved = (sim.without_diversion.delay_min - sim.with_diversion.delay_min).toFixed(1)

  return (
    <div
      className="event-item"
      onClick={() => onSelect(sim)}
      style={{borderColor: isSelected ? color+'60' : undefined, marginBottom:8}}
    >
      <div className="event-rank" style={{borderColor:color+'40',color}}>
        {esi.toFixed(0)}
      </div>
      <div className="event-info">
        <div className="event-cause" style={{textTransform:'capitalize'}}>
          {sim.event_cause.replace(/_/g,' ')} — {sim.corridor}
        </div>
        <div className="event-meta">
          {sim.police_station} · Without: {sim.without_diversion.delay_min.toFixed(0)}min
          → With: {sim.with_diversion.delay_min.toFixed(0)}min
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontFamily:'Space Grotesk',fontSize:16,fontWeight:800,color:'#10b981'}}>
          -{sim.reduction_pct}%
        </div>
        <div style={{fontSize:10,color:'var(--text-muted)'}}>delay saved</div>
      </div>
    </div>
  )
}

export default function DiversionSim({ api, health }) {
  const [diversions, setDiversions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!health.ready) return
    fetch(`${api}/api/diversions?limit=200`)
      .then(r=>r.json()).then(d => {
        setDiversions(d)
        if (d.length) setSelected(d[0])
        setLoading(false)
      }).catch(()=>setLoading(false))
  }, [api, health.ready])

  if (!health.ready) return <div className="empty"><div className="ei">⚙️</div><p>Processing…</p></div>
  if (loading) return <div className="loading"><div className="spinner"/><p>Loading simulation data…</p></div>

  const chartData = selected ? [
    { scenario:'Without Diversion', delay:selected.without_diversion.delay_min, queue:selected.without_diversion.queue_km, cong:selected.without_diversion.congestion_pct },
    { scenario:'With Diversion', delay:selected.with_diversion.delay_min, queue:selected.with_diversion.queue_km, cong:selected.with_diversion.congestion_pct },
  ] : []

  const avgReduction = diversions.length
    ? Math.round(diversions.reduce((s,d)=>s+d.reduction_pct,0)/diversions.length)
    : 0

  const maxSaved = diversions.length
    ? Math.max(...diversions.map(d=>d.without_diversion.delay_min - d.with_diversion.delay_min))
    : 0

  return (
    <div>
      <div className="insight-banner mb6">
        <div className="insight-icon">🔀</div>
        <div className="insight-text">
          <h3>Digital Twin Diversion Simulator — What-If Analysis</h3>
          <p>
            For each high-impact event, the simulator computes two parallel scenarios:
            <strong> without diversion</strong> (baseline congestion) vs
            <strong> with optimal diversion</strong> (estimated reduction).
            Average delay reduction across {diversions.length} events: <strong>{avgReduction}%</strong>.
          </p>
        </div>
      </div>

      <div className="kpi-grid mb6">
        <div className="kpi teal">
          <div className="kpi-icon">🔀</div>
          <div className="kpi-value">{diversions.length}</div>
          <div className="kpi-label">Events Simulated</div>
          <div className="kpi-sub">ESI ≥ 40 events</div>
        </div>
        <div className="kpi emerald">
          <div className="kpi-icon">📉</div>
          <div className="kpi-value">{avgReduction}%</div>
          <div className="kpi-label">Avg Delay Reduction</div>
          <div className="kpi-sub">With optimal diversion</div>
        </div>
        <div className="kpi indigo">
          <div className="kpi-icon">⏱️</div>
          <div className="kpi-value">{maxSaved.toFixed(0)}</div>
          <div className="kpi-label">Max Minutes Saved</div>
          <div className="kpi-sub">Best case diversion</div>
        </div>
        <div className="kpi amber">
          <div className="kpi-icon">🛣️</div>
          <div className="kpi-value">3</div>
          <div className="kpi-label">Diversion Routes</div>
          <div className="kpi-sub">Modeled alternatives</div>
        </div>
      </div>

      <div className="g2 mb6">
        {/* Selected simulation detail */}
        <div className="card">
          <h3>📊 {selected ? 'Simulation: ' + selected.event_cause?.replace(/_/g,' ') : 'Select an event'}</h3>
          {!selected ? (
            <div className="empty" style={{padding:32}}><div className="ei">🔀</div><p>Click an event to see its simulation.</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{top:5,right:8,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="scenario" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
                  <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}}/>
                  <Tooltip
                    contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8}}
                    formatter={(v,n)=>[`${v.toFixed(1)} min`,n]}
                  />
                  <Bar dataKey="delay" name="Delay (min)" radius={[4,4,0,0]}>
                    <Cell fill="#ef4444"/>
                    <Cell fill="#10b981"/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="sim-row" style={{marginTop:14}}>
                <div className="sim-box">
                  <div className="sim-label">❌ Without Diversion</div>
                  <div className="sim-metric"><span>Delay</span><strong style={{color:'#ef4444'}}>{selected.without_diversion.delay_min.toFixed(1)} min</strong></div>
                  <div className="sim-metric"><span>Queue Length</span><strong style={{color:'#f97316'}}>{selected.without_diversion.queue_km.toFixed(1)} km</strong></div>
                  <div className="sim-metric"><span>Congestion</span><strong style={{color:'#ef4444'}}>{selected.without_diversion.congestion_pct.toFixed(0)}%</strong></div>
                </div>
                <div className="sim-box" style={{borderColor:'rgba(16,185,129,0.3)'}}>
                  <div className="sim-label">✅ With Diversion</div>
                  <div className="sim-metric"><span>Delay</span><strong style={{color:'#10b981'}}>{selected.with_diversion.delay_min.toFixed(1)} min</strong></div>
                  <div className="sim-metric"><span>Queue Length</span><strong style={{color:'#14b8a6'}}>{selected.with_diversion.queue_km.toFixed(1)} km</strong></div>
                  <div className="sim-metric"><span>Congestion</span><strong style={{color:'#10b981'}}>{selected.with_diversion.congestion_pct.toFixed(0)}%</strong></div>
                </div>
              </div>

              <div style={{marginTop:12,padding:'12px 14px',background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:10}}>
                <div style={{fontSize:13,fontWeight:700,color:'#10b981',marginBottom:4}}>
                  🔀 Best Route: {selected.with_diversion.diversion?.desc}
                </div>
                <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                  Estimated congestion reduction: <strong>{selected.reduction_pct}%</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Event list */}
        <div className="card">
          <h3>📋 Simulated Events</h3>
          <div style={{maxHeight:420,overflowY:'auto'}}>
            {diversions.slice(0,40).map((d,i) => (
              <SimCard key={i} sim={d} isSelected={selected?.event_id===d.event_id} onSelect={setSelected}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
