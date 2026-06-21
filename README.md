# EventFlow AI — Event-Driven Traffic Intelligence & Resource Planning Platform

An event-driven smart city decision-support system that forecasts traffic volume/congestion caused by public and planned gatherings, optimizes police manpower & barricade deployment, plans diversions via what-if simulations, and updates future models continuously through a post-event learning loop.

## Architecture

```
experiments/idea2/
├── ml/
│   └── pipeline.py           # ML Pipeline (M1 - M7)
├── backend/
│   ├── main.py               # FastAPI server
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx           # Sidebar layout + routing
│   │   ├── index.css         # Ultra premium CSS design system
│   │   └── pages/
│   │       ├── Overview.jsx          # Statistics & overall analytics
│   │       ├── EventMap.jsx          # Interactive leaflet map
│   │       ├── EventPlanner.jsx      # Scenario planner + predictive ESI gauge
│   │       ├── ResourcePlanner.jsx   # Police & barricade allocation matrix
│   │       ├── DiversionSim.jsx      # Digital Twin route-diversion simulation
│   │       └── PostEventLearning.jsx # Prediction vs Actual resolution accuracy
│   └── package.json
└── start.bat                 # One-click startup script
```

## Quick Start

### 1. Preprocess & Train Models
```bash
cd D:\GridFlow\GridFlow\experiments\idea2
python ml/pipeline.py
```

### 2. Run Servers
Double-click `start.bat` or run:
```bash
# Terminal 1: Backend
uvicorn backend.main:app --port 8001 --reload

# Terminal 2: Frontend
cd frontend
npm run dev -- --port 5174
```

- **Dashboard:** http://localhost:5174
- **API Docs:** http://localhost:8001/docs
