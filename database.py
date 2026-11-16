import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent / "sewerwatch.db"

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
                timestamp TEXT NOT NULL,
                water_level_cm REAL,
                pipe_distance_m REAL,
                flow_lps REAL,
                turbidity_raw REAL,
                methane_raw REAL,
                co_raw REAL,
                temperature_c REAL,
                battery_pct REAL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_readings_node_time ON readings(node_id, timestamp)")

def insert_reading(data):
    now = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        db.execute("""
            INSERT INTO readings
            (node_id,timestamp,water_level_cm,pipe_distance_m,flow_lps,turbidity_raw,
             methane_raw,co_raw,temperature_c,battery_pct)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            data["node_id"], now, data.get("water_level_cm"), data.get("pipe_distance_m"),
            data.get("flow_lps"), data.get("turbidity_raw"), data.get("methane_raw"),
            data.get("co_raw"), data.get("temperature_c"), data.get("battery_pct")
        ))
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
