import { useState } from 'react'

const CAUSES = ['vehicle_breakdown','accident','public_event','construction','water_logging','procession','vip_movement','protest','pot_holes','tree_fall','congestion','road_conditions','others']
const CORRIDORS = ['Non-corridor','Mysore Road','Bellary Road 1','Bellary Road 2','Tumkur Road','Hosur Road','Old Madras Road','ORR North 1','ORR East 1','Magadi Road']
const VEH_TYPES = ['private_car','bmtc_bus','heavy_vehicle','truck','lcv','private_bus','ksrtc_bus','taxi','auto','others']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const HOURS = Array.from({length:24},(_,i) => {
  const l = i===0?'12 AM':i<12?`${i} AM`:i===12?'12 PM':`${i-12} PM`
  return { value:i, label:l }
})

function ESIGauge({ score, level, color }) {
  const angle = (score / 100) * 180 - 90
  return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <svg viewBox="0 0 200 110" width="200" height="110" style={{margin:'0 auto',display:'block'}}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--bg-secondary)" strokeWidth="16" strokeLinecap="round"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none"
          stroke={`url(#eg)`} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${(score/100)*251} 251`}/>
        <defs>
          <linearGradient id="eg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981"/>
            <stop offset="40%" stopColor="#f59e0b"/>
            <stop offset="70%" stopColor="#f97316"/>
            <stop offset="100%" stopColor="#ef4444"/>
          </linearGradient>
        </defs>
        <g transform={`translate(100,100) rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2="-65" stroke={color} strokeWidth="3" strokeLinecap="round"/>
          <circle r="5" fill={color}/>
        </g>
        <text x="100" y="90" textAnchor="middle" fontSize="28" fontWeight="800" fontFamily="Space Grotesk" fill={color}>{score}</text>
        <text x="100" y="108" textAnchor="middle" fontSize="10" fill="var(--text-muted)">ESI Score / 100</text>
      </svg>
      <div style={{fontSize:18,fontWeight:800,fontFamily:'Space Grotesk',color,marginTop:6}}>{level}</div>
    </div>
  )
}

export default function EventPlanner({ api, health }) {
  const [form, setForm] = useState({
    event_cause: 'public_event',
    priority: 'High',
    road_closure: false,
    hour: 18,
    day_of_week: 5,
    is_weekend: 1,
    corridor: 'Mysore Road',
    is_planned: 1,
    veh_type: 'private_car',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const presets = [
    { label:'Cricket Match', cause:'public_event', hour:18, day:5, corridor:'Chinnaswamy Road', priority:'High', closure:true },
    { label:'VIP Movement', cause:'vip_movement', hour:10, day:1, corridor:'Bellary Road 1', priority:'High', closure:true },
    { label:'Procession', cause:'procession', hour:9, day:6, corridor:'Mysore Road', priority:'High', closure:false },
    { label:'Construction', cause:'construction', hour:8, day:0, corridor:'ORR North 1', priority:'Low', closure:false },
  ]

  const applyPreset = (p) => setForm({
    event_cause:p.cause, priority:p.priority,
    road_closure:p.closure, hour:p.hour,
    day_of_week:p.day, is_weekend:p.day>=5?1:0,
    corridor:p.corridor, is_planned:1, veh_type:'private_car'
  })

  const predict = async () => {
    if (!health.ready) { setError('AI model not ready yet.'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${api}/api/predict`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...form,
          road_closure: form.road_closure,
          is_weekend: form.day_of_week>=5?1:0
        })
      })
      if (!r.ok) throw new Error('API error')
      setResult(await r.json())
    } catch(e) { setError('Prediction failed. Is the backend running?') }
    setLoading(false)
  }

  const esiColor = (l) => l==='Critical'?'#ef4444':l==='High'?'#f97316':l==='Moderate'?'#f59e0b':'#10b981'

  return (
    <div>
      <div className="insight-banner mb6">
        <div className="insight-icon">📅</div>
        <div className="insight-text">
          <h3>Event Planner — AI-Powered Impact Forecasting</h3>
          <p>
            Define an upcoming event scenario and our Gradient Boosting + Random Forest ensemble will predict the
            <strong> Event Severity Index (ESI)</strong>, expected congestion delay, affected radius, and
            recommended resource deployment — before the event even occurs.
          </p>
        </div>
      </div>

      <div className="g2">
        {/* Form */}
        <div className="card">
          <h3>🎯 Configure Event Scenario</h3>

          {/* Presets */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>Quick Presets</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {presets.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text-secondary)',
                    borderRadius:6,padding:'5px 12px',fontSize:11,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}
                  onMouseOver={e=>e.target.style.borderColor='#6366f1'}
                  onMouseOut={e=>e.target.style.borderColor='var(--border)'}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="fg">
              <label>Event Cause</label>
              <select id="fc-cause" value={form.event_cause} onChange={e=>setF('event_cause',e.target.value)}>
                {CAUSES.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Priority</label>
              <select id="fc-priority" value={form.priority} onChange={e=>setF('priority',e.target.value)}>
                <option>High</option><option>Low</option>
              </select>
            </div>
            <div className="fg">
              <label>Corridor</label>
              <select id="fc-corridor" value={form.corridor} onChange={e=>setF('corridor',e.target.value)}>
                {CORRIDORS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Vehicle Type</label>
              <select id="fc-veh" value={form.veh_type} onChange={e=>setF('veh_type',e.target.value)}>
                {VEH_TYPES.map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Start Hour</label>
              <select id="fc-hour" value={form.hour} onChange={e=>setF('hour',parseInt(e.target.value))}>
                {HOURS.map(h=><option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Day of Week</label>
              <select id="fc-day" value={form.day_of_week} onChange={e=>setF('day_of_week',parseInt(e.target.value))}>
                {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="fg" style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
              <input type="checkbox" id="fc-closure" checked={form.road_closure}
                onChange={e=>setF('road_closure',e.target.checked)}
                style={{width:16,height:16,accentColor:'var(--accent-indigo)'}}/>
              <label htmlFor="fc-closure" style={{fontSize:13,color:'var(--text-secondary)',cursor:'pointer',textTransform:'none',letterSpacing:'normal'}}>
                Requires Road Closure
              </label>
            </div>
            <div className="fg" style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
              <input type="checkbox" id="fc-planned" checked={form.is_planned===1}
                onChange={e=>setF('is_planned',e.target.checked?1:0)}
                style={{width:16,height:16,accentColor:'var(--accent-indigo)'}}/>
              <label htmlFor="fc-planned" style={{fontSize:13,color:'var(--text-secondary)',cursor:'pointer',textTransform:'none',letterSpacing:'normal'}}>
                Planned Event
              </label>
            </div>
          </div>

          <button id="predict-event-btn" className="btn-predict" onClick={predict}
            disabled={loading || !health.ready}>
            {loading ? '⏳ Forecasting…' : !health.ready ? '⚙️ AI Loading…' : '⚡ Forecast Event Impact'}
          </button>
          {error && (
            <div style={{marginTop:12,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',
              borderRadius:8,padding:'10px 14px',fontSize:13,color:'#f87171'}}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Result */}
        <div className="card">
          <h3>📊 Impact Forecast Result</h3>
          {!result ? (
            <div className="empty" style={{padding:'48px 20px'}}>
              <div className="ei">🎯</div>
              <p>Configure an event scenario and click Forecast to see AI predictions.</p>
            </div>
          ) : (
            <div className="result-box">
              <ESIGauge score={result.esi} level={result.esi_level} color={esiColor(result.esi_level)}/>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,margin:'16px 0'}}>
                {[
                  { label:'Expected Delay', val:`${result.expected_delay_min?.toFixed(0)} min`, sub:'Without diversion', icon:'⏱️' },
                  { label:'With Diversion', val:`${result.expected_delay_with_diversion_min?.toFixed(0)} min`, sub:`-${result.congestion_reduction_pct}% reduction`, icon:'🔀' },
                  { label:'Affected Radius', val:`${result.affected_radius_km} km`, sub:'Around event location', icon:'📍' },
                  { label:'High Impact Prob.', val:`${result.high_impact_probability}%`, sub:'AI confidence', icon:'🤖' },
                ].map(m => (
                  <div key={m.label} style={{background:'var(--bg-secondary)',borderRadius:10,padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:16,marginBottom:4}}>{m.icon}</div>
                    <div style={{fontFamily:'Space Grotesk',fontSize:20,fontWeight:800,color:'#a5b4fc'}}>{m.val}</div>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginTop:2}}>{m.label}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Recommended resources */}
              <div style={{marginTop:4}}>
                <p style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
                  Recommended Deployment
                </p>
                <div className="resource-grid">
                  {[
                    { icon:'👮', val:result.resources?.officers, label:'Officers' },
                    { icon:'🚧', val:result.resources?.barricades, label:'Barricades' },
                    { icon:'🚗', val:result.resources?.tow_vehicles, label:'Tow Vehicles' },
                    { icon:'🚔', val:result.resources?.mobile_patrols, label:'Patrols' },
                  ].map(r => (
                    <div key={r.label} className="resource-card">
                      <div className="rc-icon">{r.icon}</div>
                      <div className="rc-value" style={{color:'#a5b4fc'}}>{r.val}</div>
                      <div className="rc-label">{r.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ESI scale reference */}
      <div className="card" style={{marginTop:18}}>
        <h3>📘 ESI Scale Reference</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {range:'0–30',level:'Low',icon:'✅',desc:'Standard monitoring',color:'#10b981'},
            {range:'31–60',level:'Moderate',icon:'⚠️',desc:'Deploy extra officers',color:'#f59e0b'},
            {range:'61–80',level:'High',icon:'🚨',desc:'Activate diversions',color:'#f97316'},
            {range:'81–100',level:'Critical',icon:'🚔',desc:'Full emergency deployment',color:'#ef4444'},
          ].map(r => (
            <div key={r.range} style={{background:'var(--bg-secondary)',borderRadius:10,padding:14,
              border:`1px solid ${r.color}30`,textAlign:'center'}}>
              <div style={{fontSize:22,marginBottom:6}}>{r.icon}</div>
              <div style={{fontFamily:'Space Grotesk',fontSize:16,fontWeight:800,color:r.color}}>{r.range}</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text-secondary)',margin:'4px 0'}}>{r.level}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
