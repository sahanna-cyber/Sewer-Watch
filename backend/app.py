from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pathlib import Path
from database import init_db, insert_reading, get_latest, get_history

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)
init_db()

VALID_NODES = {"M-01", "M-02", "M-03"}
REQUIRED = [
    "water_level_cm",
    "water_level_2_cm",
    "turbidity_raw",
    "methane_raw",
    "co_raw",
    "temperature_c",
    "humidity_pct",
    "flow_lps"
]
@app.get("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "SEWERWATCH", "version": "2.0"})

@app.get("/api/nodes")
def nodes():
    return jsonify([
        {"node_id":"M-01","name":"Canteen Kitchen Line"},
        {"node_id":"M-02","name":"Toilet Block Line"},
        {"node_id":"M-03","name":"Block B Sewage Line"}
    ])

@app.post("/api/telemetry")
def telemetry():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error":"Send a JSON object"}), 400
    node_id = data.get("node_id", "M-01")
    if node_id not in VALID_NODES:
        return jsonify({"error":"node_id must be M-01, M-02 or M-03"}), 400
    missing = [key for key in REQUIRED if key not in data or data[key] is None]
    if missing:
        return jsonify({"error":"Missing required fields", "fields":missing}), 400
    try:
        clean = {"node_id":node_id}
        numeric = REQUIRED + ["pipe_distance_m", "battery_pct"]
        for key in numeric:
            value = data.get(key)
            clean[key] = None if value is None else float(value)
        timestamp = insert_reading(clean)
        return jsonify({"status":"saved","node_id":node_id,"timestamp":timestamp}), 201
    except (TypeError, ValueError):
        return jsonify({"error":"Sensor values must be numeric"}), 400

@app.get("/api/latest")
def latest():
    node_id = request.args.get("node_id")
    if node_id and node_id not in VALID_NODES:
        return jsonify({"error":"Unknown node"}), 400
    return jsonify(get_latest(node_id))

@app.get("/api/history")
def history():
    node_id = request.args.get("node_id", "M-01")
    if node_id not in VALID_NODES:
        return jsonify({"error":"Unknown node"}), 400
    return jsonify(get_history(node_id, request.args.get("limit", 100)))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
