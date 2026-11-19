import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent / "sewerwatch.db"
COLUMNS = {
    "water_level_cm": "REAL",
    "particle_distance_cm": "REAL",
    "pipe_distance_m": "REAL",
    "flow_lps": "REAL",
    "turbidity_raw": "REAL",
    "methane_raw": "REAL",
    "co_raw": "REAL",
    "temperature_c": "REAL",
    "humidity_pct": "REAL",
    "battery_pct": "REAL",
}

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        existing = {row["name"] for row in db.execute("PRAGMA table_info(readings)")}
        for name, kind in COLUMNS.items():
            if name not in existing:
                db.execute(f"ALTER TABLE readings ADD COLUMN {name} {kind}")
        db.execute("CREATE INDEX IF NOT EXISTS idx_readings_node_time ON readings(node_id, timestamp)")

def insert_reading(data):
    now = datetime.now(timezone.utc).isoformat()
    fields = ["node_id", "timestamp", *COLUMNS.keys()]
    values = [data["node_id"], now, *[data.get(k) for k in COLUMNS]]
    marks = ", ".join("?" for _ in fields)
    with connect() as db:
        db.execute(f"INSERT INTO readings ({', '.join(fields)}) VALUES ({marks})", values)
    return now

def get_latest(node_id=None):
    with connect() as db:
        if node_id:
            row = db.execute("SELECT * FROM readings WHERE node_id=? ORDER BY id DESC LIMIT 1", (node_id,)).fetchone()
        else:
            row = db.execute("SELECT * FROM readings ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row) if row else None

def get_history(node_id, limit=100):
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM readings WHERE node_id=? ORDER BY id DESC LIMIT ?",
            (node_id, min(int(limit), 500))
        ).fetchall()
    return [dict(row) for row in reversed(rows)]
