"""EventFlow AI - FastAPI Backend"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import json, pickle
import numpy as np

app = FastAPI(title="EventFlow AI API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATA_DIR = Path(__file__).parent.parent / "data"

def load_json(name):
    p = DATA_DIR / name
    return json.load(open(p)) if p.exists() else None


@app.get("/")
def root(): return {"message": "EventFlow AI API", "status": "running"}

@app.get("/api/health")
def health():
    files = {f: (DATA_DIR / f).exists() for f in [
        "stats.json","events.json","heatmap.json",
        "diversions.json","resource_plans.json","post_event_learning.json",
        "forecast_model.pkl"
    ]}
    return {"ready": all(files.values()), "files": files}

@app.get("/api/stats")
def get_stats():
    d = load_json("stats.json")
    if not d: raise HTTPException(503, "Run ML pipeline first")
    return d

@app.get("/api/events")
def get_events(limit: int = 100, esi_min: float = 0):
    d = load_json("events.json")
    if not d: raise HTTPException(503)
    return [e for e in d if e.get("esi", 0) >= esi_min][:limit]

@app.get("/api/heatmap")
def get_heatmap():
    d = load_json("heatmap.json")
    if not d: raise HTTPException(503)
    return {"points": d}

@app.get("/api/diversions")
def get_diversions(limit: int = 100):
    d = load_json("diversions.json")
    if not d: raise HTTPException(503)
    return d[:limit]

@app.get("/api/resources")
def get_resources(limit: int = 100):
    d = load_json("resource_plans.json")
    if not d: raise HTTPException(503)
    return d[:limit]

@app.get("/api/learning")
def get_learning():
    d = load_json("post_event_learning.json")
    if not d: raise HTTPException(503)
    return d

@app.get("/api/timeline")
def get_timeline():
    d = load_json("timeline.json")
    if not d: raise HTTPException(503)
    return d


class EventScenario(BaseModel):
    event_cause: str = "public_event"
    priority: str = "High"
    road_closure: bool = False
    hour: int = 18
    day_of_week: int = 5
    is_weekend: int = 1
    corridor: str = "Mysore Road"
    is_planned: int = 1
    veh_type: str = "private_car"


@app.post("/api/predict")
def predict_event(scenario: EventScenario):
    model_path = DATA_DIR / "forecast_model.pkl"
    if not model_path.exists(): raise HTTPException(503, "Model not trained")
    with open(model_path, "rb") as f:
        md = pickle.load(f)

    cause_map = {
        "accident":5,"public_event":5,"procession":4,"vip_movement":4,
        "protest":4,"construction":3,"water_logging":3,"congestion":3,
        "tree_fall":2,"pot_holes":2,"road_conditions":2,"vehicle_breakdown":1,"others":1
    }
    corridor_map = {
        "Mysore Road":5,"Bellary Road 1":5,"Bellary Road 2":4,
        "Tumkur Road":4,"Hosur Road":4,"Old Madras Road":3,
        "ORR North 1":4,"ORR East 1":4,"Magadi Road":3,"Non-corridor":1
    }
    veh_map = {
        "heavy_vehicle":4,"truck":4,"private_bus":3,"bmtc_bus":3,
        "ksrtc_bus":3,"lcv":2,"private_car":2,"taxi":1,"auto":1,"others":2
    }
    prio_map = {"High":2,"Low":1}

    cause_sev  = cause_map.get(scenario.event_cause, 2)
    prio_enc   = prio_map.get(scenario.priority, 1)
    road_flag  = int(scenario.road_closure)
    is_peak    = 1 if scenario.hour in list(range(7,10))+list(range(17,21)) else 0
    corr_w     = corridor_map.get(scenario.corridor, 2)
    veh_r      = veh_map.get(scenario.veh_type, 2)

    X = np.array([[
        cause_sev, prio_enc, road_flag, is_peak, corr_w,
        veh_r, scenario.hour, scenario.day_of_week,
        scenario.is_weekend, scenario.is_planned
    ]])

    pred_duration = float(md["regressor"].predict(X)[0])
    prob_high = float(md["classifier"].predict_proba(X)[0][1])

    # ESI
    esi = min(100, cause_sev*12 + prio_enc*10 + road_flag*10 + is_peak*5 + corr_w*1)

    # ESI level
    if esi >= 80: esi_level, esi_color = "Critical", "#FF1744"
    elif esi >= 60: esi_level, esi_color = "High", "#ff4757"
    elif esi >= 30: esi_level, esi_color = "Moderate", "#ffa502"
    else: esi_level, esi_color = "Low", "#2ed573"

    # Resources
    officers    = min(max(2, int(esi/5)), 100)
    barricades  = min(max(0, int(esi/6)+(4 if road_flag else 0)), 60)
    tow_vehicles= min(max(0, int(esi/25)), 15)
    patrols     = min(max(1, int(esi/30)), 10)
    if corr_w >= 4:
        officers  = int(officers*1.3)
        barricades= int(barricades*1.2)
    if road_flag:
        officers  = int(officers*1.5)

    # Diversion simulation
    base_delay = esi*0.4 + pred_duration*2
    reduction  = 0.25+(esi/100)*0.2
    with_delay = round(base_delay*(1-reduction),1)

    affected_radius = round(0.5 + esi/40, 1)

    return {
        "esi": round(esi, 1),
        "esi_level": esi_level,
        "esi_color": esi_color,
        "predicted_duration_hrs": round(pred_duration, 2),
        "high_impact_probability": round(prob_high*100, 1),
        "expected_delay_min": round(base_delay, 1),
        "expected_delay_with_diversion_min": with_delay,
        "congestion_reduction_pct": round(reduction*100, 1),
        "affected_radius_km": affected_radius,
        "resources": {
            "officers": officers,
            "barricades": barricades,
            "tow_vehicles": tow_vehicles,
            "mobile_patrols": patrols,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
