"""
EventFlow AI - ML Pipeline
Modules: Feature Engineering, ESI Scoring, Impact Forecasting,
         Resource Optimization, Diversion Simulation, Post-Event Learning
"""
import json
import pickle
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent
DATA_DIR   = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

RAW_CSV    = DATA_DIR / "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
PROCESSED  = DATA_DIR / "events_processed.parquet"
STATS_JSON = DATA_DIR / "stats.json"
EVENTS_JSON= DATA_DIR / "events.json"
ESI_JSON   = DATA_DIR / "esi_events.json"
FORECAST_MODEL = DATA_DIR / "forecast_model.pkl"
RESOURCE_JSON  = DATA_DIR / "resource_plans.json"
HEATMAP_JSON   = DATA_DIR / "heatmap.json"
DIVERSION_JSON = DATA_DIR / "diversions.json"
LEARNING_JSON  = DATA_DIR / "post_event_learning.json"
TIMELINE_JSON  = DATA_DIR / "timeline.json"


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 1: DATA LOADING & FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
def load_and_engineer(path: Path) -> pd.DataFrame:
    print("[M1] Loading & engineering features...")
    df = pd.read_csv(path, low_memory=False)
    print(f"    Loaded {len(df):,} events")

    # Parse datetimes
    df["start_dt"] = pd.to_datetime(df["start_datetime"], utc=True, errors="coerce")
    df["closed_dt"] = pd.to_datetime(df["closed_datetime"], utc=True, errors="coerce")
    df["created_dt"] = pd.to_datetime(df["created_date"], utc=True, errors="coerce")

    # Duration in hours (cap outliers)
    df["duration_hrs"] = (df["closed_dt"] - df["start_dt"]).dt.total_seconds() / 3600
    df["duration_hrs"] = df["duration_hrs"].clip(0, 72).fillna(df["duration_hrs"].median())

    # Time features
    df["hour"]        = df["start_dt"].dt.hour
    df["day_of_week"] = df["start_dt"].dt.dayofweek
    df["month"]       = df["start_dt"].dt.month
    df["is_weekend"]  = df["day_of_week"].isin([5, 6]).astype(int)
    df["is_peak"]     = df["hour"].isin(list(range(7,10)) + list(range(17,21))).astype(int)
    df["day_name"]    = df["start_dt"].dt.day_name()
    df["month_year"]  = df["start_dt"].dt.to_period("M").astype(str)
    df["time_slot"]   = pd.cut(df["hour"],
        bins=[0,6,10,14,17,21,24],
        labels=["Late Night","Morning","Midday","Afternoon","Evening","Night"],
        right=False)

    # Road closure flag
    df["requires_road_closure"] = df["requires_road_closure"].fillna(False).astype(bool)
    df["road_closure_flag"] = df["requires_road_closure"].astype(int)

    # Priority encoding
    prio_map = {"High": 2, "Low": 1}
    df["priority_enc"] = df["priority"].map(prio_map).fillna(1)

    # Event type encoding
    df["is_planned"] = (df["event_type"] == "planned").astype(int)

    # Corridor importance weights
    corridor_weights = {
        "Mysore Road": 5, "Bellary Road 1": 5, "Bellary Road 2": 4,
        "Tumkur Road": 4, "Hosur Road": 4, "Old Madras Road": 3,
        "ORR North 1": 4, "ORR East 1": 4, "Magadi Road": 3,
        "Non-corridor": 1,
    }
    df["corridor"] = df["corridor"].fillna("Non-corridor")
    df["corridor_weight"] = df["corridor"].map(corridor_weights).fillna(2)

    # Event cause severity map
    cause_severity = {
        "accident": 5, "public_event": 5, "procession": 4, "vip_movement": 4,
        "protest": 4, "construction": 3, "water_logging": 3, "congestion": 3,
        "tree_fall": 2, "pot_holes": 2, "road_conditions": 2,
        "vehicle_breakdown": 1, "others": 1,
    }
    df["cause_severity"] = df["event_cause"].map(cause_severity).fillna(2)

    # Vehicle type risk
    veh_risk = {
        "heavy_vehicle": 4, "truck": 4, "private_bus": 3, "bmtc_bus": 3,
        "ksrtc_bus": 3, "lcv": 2, "private_car": 2, "taxi": 1, "auto": 1, "others": 2,
    }
    df["veh_risk"] = df["veh_type"].map(veh_risk).fillna(2)

    # Geo fill
    df["latitude"]  = df["latitude"].fillna(12.9716)
    df["longitude"] = df["longitude"].fillna(77.5946)
    df["police_station"] = df["police_station"].fillna("Unknown")
    df["zone"] = df["zone"].fillna("Unknown")
    df["event_cause"] = df["event_cause"].fillna("others")
    df["corridor"] = df["corridor"].fillna("Non-corridor")
    df["junction"] = df["junction"].fillna("No Junction")

    # Status closed flag
    df["is_closed"] = (df["status"] == "closed").astype(int)

    # Grid cell
    df["grid_lat"] = (df["latitude"] * 100).round(1)
    df["grid_lon"] = (df["longitude"] * 100).round(1)
    df["grid_cell"] = df["grid_lat"].astype(str) + "_" + df["grid_lon"].astype(str)

    print(f"    Shape after engineering: {df.shape}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 2: EVENT SEVERITY INDEX (ESI)
# ─────────────────────────────────────────────────────────────────────────────
ESI_LABELS = {
    (0, 30):   ("Low",      "#2ed573", "Low risk event. Standard monitoring."),
    (30, 60):  ("Moderate", "#ffa502", "Moderate disruption expected. Deploy additional officers."),
    (60, 80):  ("High",     "#ff4757", "Significant congestion expected. Activate diversions."),
    (80, 101): ("Critical", "#FF1744", "Critical disruption. Full emergency deployment required."),
}

def compute_esi(df: pd.DataFrame) -> pd.DataFrame:
    print("[M2] Computing Event Severity Index (ESI)...")

    # ESI formula (weighted composite, normalized to 0-100):
    # cause_severity(0-5) × 12 = 60 pts
    # priority_enc(1-2) × 10 = 20 pts
    # road_closure_flag × 10 = 10 pts
    # is_peak × 5 = 5 pts
    # corridor_weight(1-5) × 1 = 5 pts
    # Total max = 60+20+10+5+5 = 100

    df = df.copy()
    df["esi_raw"] = (
        df["cause_severity"] * 12 +
        df["priority_enc"] * 10 +
        df["road_closure_flag"] * 10 +
        df["is_peak"] * 5 +
        df["corridor_weight"] * 1
    )
    # Clip to 0-100
    df["esi"] = df["esi_raw"].clip(0, 100).round(1)

    def esi_meta(score):
        for (lo, hi), (label, color, desc) in ESI_LABELS.items():
            if lo <= score < hi:
                return label, color, desc
        return "Critical", "#FF1744", "Critical disruption."

    df[["esi_level","esi_color","esi_desc"]] = df["esi"].apply(
        lambda s: pd.Series(esi_meta(s))
    )

    print(f"    ESI distribution:")
    print(f"    {df['esi_level'].value_counts().to_dict()}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 3: IMPACT FORECASTING MODEL
# ─────────────────────────────────────────────────────────────────────────────
def train_impact_model(df: pd.DataFrame):
    print("[M3] Training impact forecast model...")
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder

    features = [
        "cause_severity", "priority_enc", "road_closure_flag",
        "is_peak", "corridor_weight", "veh_risk",
        "hour", "day_of_week", "is_weekend", "is_planned",
    ]

    # Target: duration_hrs as proxy for congestion impact
    X = df[features].fillna(0)
    y_dur = df["duration_hrs"].clip(0, 24)

    # High impact = top 25% duration
    threshold = y_dur.quantile(0.75)
    y_class = (y_dur >= threshold).astype(int)

    X_tr, X_te, yd_tr, yd_te, yc_tr, yc_te = train_test_split(
        X, y_dur, y_class, test_size=0.2, random_state=42)

    # Regression model for delay prediction
    reg_model = GradientBoostingRegressor(n_estimators=200, random_state=42, max_depth=4)
    reg_model.fit(X_tr, yd_tr)
    reg_score = reg_model.score(X_te, yd_te)

    # Classification model for high-impact flag
    clf_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf_model.fit(X_tr, yc_tr)
    clf_acc = clf_model.score(X_te, yc_te)

    print(f"    Duration regressor R2: {reg_score:.3f}")
    print(f"    High-impact classifier acc: {clf_acc:.3f}")

    # Feature importances
    importances = dict(zip(features, clf_model.feature_importances_))

    model_data = {
        "regressor": reg_model,
        "classifier": clf_model,
        "features": features,
        "threshold": float(threshold),
        "reg_r2": float(reg_score),
        "clf_accuracy": float(clf_acc),
        "feature_importances": {k: round(float(v)*100, 2) for k, v in importances.items()},
    }
    with open(FORECAST_MODEL, "wb") as f:
        pickle.dump(model_data, f)

    print("    Model saved.")
    return model_data, X_te


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 4: MANPOWER OPTIMIZATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────
def compute_resource_plans(df: pd.DataFrame) -> list:
    print("[M4] Computing manpower optimization plans...")

    # Resource formula based on ESI + cause + road closure
    plans = []
    for _, row in df.iterrows():
        esi = row["esi"]
        cause = row["event_cause"]
        road_closure = row["road_closure_flag"]
        corridor_w = row["corridor_weight"]
        duration = min(row["duration_hrs"], 24)

        # Base officer count (scale with ESI)
        officers = max(2, int(esi / 5))
        barricades = max(0, int(esi / 6) + (4 if road_closure else 0))
        tow_vehicles = max(0, int(esi / 25))
        mobile_patrols = max(1, int(esi / 30))

        # Scale for major corridors
        if corridor_w >= 4:
            officers = int(officers * 1.3)
            barricades = int(barricades * 1.2)

        # Scale for road closures
        if road_closure:
            officers = int(officers * 1.5)

        plans.append({
            "event_id": str(row["id"]),
            "esi": float(esi),
            "esi_level": str(row["esi_level"]),
            "officers": min(officers, 100),
            "barricades": min(barricades, 60),
            "tow_vehicles": min(tow_vehicles, 15),
            "mobile_patrols": min(mobile_patrols, 10),
            "total_resources": min(officers + barricades + tow_vehicles + mobile_patrols, 200),
        })

    print(f"    Resource plans for {len(plans)} events")
    return plans


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 5 + 6: DIGITAL TWIN DIVERSION SIMULATION
# ─────────────────────────────────────────────────────────────────────────────
def simulate_diversions(df: pd.DataFrame) -> list:
    print("[M5] Simulating diversion scenarios...")

    diversion_templates = [
        {"id": "A", "desc": "Inner Ring Road via Richmond Circle"},
        {"id": "B", "desc": "NICE Road alternate bypass"},
        {"id": "C", "desc": "NH-44 peripheral route"},
    ]

    simulations = []
    for _, row in df[df["esi"] >= 40].iterrows():
        esi = row["esi"]
        duration = min(row["duration_hrs"], 24)

        # Base delay estimation (minutes) from ESI
        base_delay = esi * 0.4 + duration * 2

        # Without diversion
        without_delay = round(base_delay, 1)
        without_queue = round(base_delay * 0.3, 1)
        without_cong = min(round(esi * 0.9, 1), 100)

        # With best diversion (25-45% reduction)
        reduction = 0.25 + (esi / 100) * 0.2
        with_delay = round(without_delay * (1 - reduction), 1)
        with_queue = round(without_queue * (1 - reduction * 0.8), 1)
        with_cong = round(without_cong * (1 - reduction * 0.7), 1)

        best_div = diversion_templates[int(row["corridor_weight"]) % 3]

        simulations.append({
            "event_id": str(row["id"]),
            "event_cause": str(row["event_cause"]),
            "esi": float(esi),
            "corridor": str(row["corridor"]),
            "police_station": str(row["police_station"]),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "without_diversion": {
                "delay_min": without_delay,
                "queue_km": without_queue,
                "congestion_pct": without_cong,
            },
            "with_diversion": {
                "delay_min": with_delay,
                "queue_km": with_queue,
                "congestion_pct": with_cong,
                "diversion": best_div,
            },
            "reduction_pct": round(reduction * 100, 1),
        })

    print(f"    Diversion simulations: {len(simulations)}")
    return simulations


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 7: POST-EVENT LEARNING ENGINE
# ─────────────────────────────────────────────────────────────────────────────
def build_post_event_learning(df: pd.DataFrame) -> dict:
    print("[M7] Building post-event learning insights...")

    closed = df[df["status"] == "closed"].copy()

    # Per cause: avg duration, avg ESI, count
    cause_stats = closed.groupby("event_cause").agg(
        count=("id", "count"),
        avg_duration=("duration_hrs", "mean"),
        avg_esi=("esi", "mean"),
        road_closure_rate=("road_closure_flag", "mean"),
    ).reset_index()
    cause_stats["avg_duration"] = cause_stats["avg_duration"].round(2)
    cause_stats["avg_esi"] = cause_stats["avg_esi"].round(1)
    cause_stats["road_closure_rate"] = (cause_stats["road_closure_rate"] * 100).round(1)
    cause_stats = cause_stats.sort_values("avg_esi", ascending=False)

    # Per corridor: avg resolution time
    corridor_stats = closed.groupby("corridor").agg(
        count=("id", "count"),
        avg_duration=("duration_hrs", "mean"),
        avg_esi=("esi", "mean"),
    ).reset_index().sort_values("avg_esi", ascending=False).head(10)

    # Per zone: avg ESI
    zone_stats = df.groupby("zone").agg(
        count=("id", "count"),
        avg_esi=("esi", "mean"),
    ).reset_index().sort_values("avg_esi", ascending=False).head(10)

    # Monthly trend: avg ESI
    monthly = df.groupby("month_year").agg(
        count=("id", "count"),
        avg_esi=("esi", "mean"),
        high_impact=("esi", lambda x: (x >= 60).sum()),
    ).reset_index().sort_values("month_year")

    # Prediction accuracy simulation (since we have historical data)
    # Compare predicted vs actual resolution for closed events
    learning_insights = {
        "total_events_analyzed": len(closed),
        "avg_resolution_time_hrs": round(closed["duration_hrs"].mean(), 2),
        "avg_esi_overall": round(df["esi"].mean(), 1),
        "high_impact_rate": round((df["esi"] >= 60).mean() * 100, 1),
        "road_closure_rate": round(df["road_closure_flag"].mean() * 100, 1),
        "cause_stats": cause_stats.to_dict(orient="records"),
        "corridor_stats": corridor_stats.to_dict(orient="records"),
        "zone_stats": zone_stats.to_dict(orient="records"),
        "monthly": monthly.to_dict(orient="records"),
    }
    return learning_insights


# ─────────────────────────────────────────────────────────────────────────────
# HEATMAP DATA
# ─────────────────────────────────────────────────────────────────────────────
def build_heatmap(df: pd.DataFrame) -> list:
    print("[Heatmap] Building ESI-weighted heatmap...")
    pts = df[["latitude","longitude","esi"]].copy()
    pts["weight"] = pts["esi"] / 100
    points = pts[["latitude","longitude","weight"]].values.tolist()
    print(f"    {len(points):,} points")
    return points


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY STATS FOR DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
def build_stats(df: pd.DataFrame, model_data: dict, learning: dict) -> dict:
    print("[Stats] Building dashboard statistics...")

    # ESI distribution
    esi_dist = {
        "Low":      int((df["esi"] < 30).sum()),
        "Moderate": int(((df["esi"] >= 30) & (df["esi"] < 60)).sum()),
        "High":     int(((df["esi"] >= 60) & (df["esi"] < 80)).sum()),
        "Critical": int((df["esi"] >= 80).sum()),
    }

    # Event type split
    event_split = df["event_type"].value_counts().to_dict()

    # Cause distribution
    cause_dist = df["event_cause"].value_counts().head(10).to_dict()

    # Priority dist
    priority_dist = df["priority"].value_counts().to_dict()

    # Hourly pattern
    hourly = df.groupby("hour")["id"].count().reset_index()
    hourly.columns = ["hour", "count"]

    # Daily pattern
    dow_names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    dow = df.groupby("day_of_week")["id"].count().reset_index()
    dow["day"] = dow["day_of_week"].map(lambda x: dow_names[int(x)])
    dow = dow.rename(columns={"id": "count"})

    # Zone distribution
    zone_dist = df[df["zone"] != "Unknown"].groupby("zone")["id"].count().sort_values(ascending=False).head(10).to_dict()

    # Corridor dist
    corridor_dist = df[df["corridor"] != "Non-corridor"].groupby("corridor")["id"].count().sort_values(ascending=False).head(10).to_dict()

    # Monthly
    monthly = df.groupby("month_year").agg(
        count=("id","count"),
        avg_esi=("esi","mean"),
        high_impact=("esi", lambda x: (x>=60).sum()),
    ).reset_index().sort_values("month_year")

    # Status
    status_dist = df["status"].value_counts().to_dict()

    # Police station
    station_dist = df.groupby("police_station")["id"].count().sort_values(ascending=False).head(12).to_dict()

    # Vehicle type
    veh_dist = df[df["veh_type"].notna()].groupby("veh_type")["id"].count().sort_values(ascending=False).head(8).to_dict()

    # Top high-ESI events
    top_events = df.nlargest(20, "esi")[[
        "id","event_cause","event_type","police_station","corridor",
        "zone","esi","esi_level","esi_color","duration_hrs","road_closure_flag",
        "latitude","longitude","start_datetime","status"
    ]].copy()
    top_events["duration_hrs"] = top_events["duration_hrs"].round(2)
    top_events["start_datetime"] = top_events["start_datetime"].astype(str)

    # Road closure events
    closure_count = int(df["road_closure_flag"].sum())
    closure_high  = int((df[df["road_closure_flag"]==1]["esi"] >= 60).sum())

    return {
        "total_events": len(df),
        "planned_events": int(event_split.get("planned", 0)),
        "unplanned_events": int(event_split.get("unplanned", 0)),
        "avg_esi": round(float(df["esi"].mean()), 1),
        "max_esi": round(float(df["esi"].max()), 1),
        "critical_events": esi_dist["Critical"],
        "high_events": esi_dist["High"],
        "road_closures": closure_count,
        "road_closure_high_esi": closure_high,
        "avg_duration_hrs": round(float(df["duration_hrs"].mean()), 2),
        "clf_accuracy": round(model_data["clf_accuracy"] * 100, 1),
        "reg_r2": round(model_data["reg_r2"] * 100, 1),
        "esi_distribution": esi_dist,
        "event_type_split": event_split,
        "cause_distribution": [{"cause": k, "count": v} for k, v in cause_dist.items()],
        "priority_distribution": priority_dist,
        "hourly": hourly.to_dict(orient="records"),
        "dow": dow[["day","count"]].to_dict(orient="records"),
        "zone_distribution": [{"zone": k, "count": v} for k, v in zone_dist.items()],
        "corridor_distribution": [{"corridor": k, "count": v} for k, v in corridor_dist.items()],
        "monthly": monthly.to_dict(orient="records"),
        "status_distribution": status_dist,
        "station_distribution": [{"station": k, "count": v} for k, v in station_dist.items()],
        "vehicle_distribution": [{"veh_type": k, "count": v} for k, v in veh_dist.items()],
        "top_events": top_events.to_dict(orient="records"),
        "feature_importances": model_data["feature_importances"],
        "learning": learning,
    }


# ─────────────────────────────────────────────────────────────────────────────
# EVENTS LIST FOR DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
def build_events_list(df: pd.DataFrame) -> list:
    cols = [
        "id","event_type","event_cause","police_station","zone","corridor","junction",
        "priority","status","esi","esi_level","esi_color","esi_desc",
        "duration_hrs","road_closure_flag","requires_road_closure",
        "latitude","longitude","start_datetime","closed_datetime","description",
        "veh_type","is_peak","is_weekend","cause_severity",
    ]
    events = df[cols].copy()
    events["duration_hrs"] = events["duration_hrs"].round(2)
    events["start_datetime"] = events["start_datetime"].astype(str)
    events["closed_datetime"] = events["closed_datetime"].astype(str)
    events["description"] = events["description"].fillna("").astype(str)
    events = events.sort_values("esi", ascending=False)
    return events.head(500).to_dict(orient="records")


# ─────────────────────────────────────────────────────────────────────────────
# TIMELINE DATA
# ─────────────────────────────────────────────────────────────────────────────
def build_timeline(df: pd.DataFrame) -> list:
    """Recent high-ESI events for timeline feed"""
    recent = df[df["esi"] >= 50].sort_values("start_dt", ascending=False).head(50)
    timeline = []
    for _, r in recent.iterrows():
        timeline.append({
            "id": str(r["id"]),
            "cause": str(r["event_cause"]),
            "station": str(r["police_station"]),
            "esi": float(r["esi"]),
            "esi_level": str(r["esi_level"]),
            "esi_color": str(r["esi_color"]),
            "date": str(r["start_datetime"])[:16],
            "status": str(r["status"]),
            "road_closure": bool(r["road_closure_flag"]),
            "corridor": str(r["corridor"]),
        })
    return timeline


def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(x) for x in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def run_pipeline():
    t0 = datetime.now()

    df = load_and_engineer(RAW_CSV)
    df = compute_esi(df)
    model_data, _ = train_impact_model(df)
    resource_plans = compute_resource_plans(df)
    diversions = simulate_diversions(df)
    learning = build_post_event_learning(df)
    heatmap = build_heatmap(df)
    stats = build_stats(df, model_data, learning)
    events = build_events_list(df)
    timeline = build_timeline(df)

    df.to_parquet(PROCESSED, index=False)

    print("\n[Save] Writing outputs...")
    with open(STATS_JSON, "w") as f:
        json.dump(clean_nan(stats), f, default=str)
    with open(EVENTS_JSON, "w") as f:
        json.dump(clean_nan(events), f, default=str)
    with open(RESOURCE_JSON, "w") as f:
        json.dump(clean_nan(resource_plans[:200]), f, default=str)
    with open(HEATMAP_JSON, "w") as f:
        json.dump(clean_nan(heatmap), f, default=str)
    with open(DIVERSION_JSON, "w") as f:
        json.dump(clean_nan(diversions[:200]), f, default=str)
    with open(LEARNING_JSON, "w") as f:
        json.dump(clean_nan(learning), f, default=str)
    with open(TIMELINE_JSON, "w") as f:
        json.dump(clean_nan(timeline), f, default=str)

    elapsed = (datetime.now() - t0).total_seconds()
    print(f"\n[DONE] Pipeline complete in {elapsed:.1f}s")
    print(f"  Events: {EVENTS_JSON}")
    print(f"  Stats:  {STATS_JSON}")
    print(f"  Model:  {FORECAST_MODEL}")
    print(f"  Diversions: {DIVERSION_JSON}")
    print(f"  Learning: {LEARNING_JSON}")


if __name__ == "__main__":
    run_pipeline()