"""
SQLite 缓存层 — 按 video_id 分模块缓存 AI 结果
后期可迁移 Supabase，只需替换此文件实现
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "app.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_db():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS video_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            module TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(video_id, module)
        );

        CREATE TABLE IF NOT EXISTS saved_expressions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phrase TEXT NOT NULL,
            register TEXT,
            level TEXT,
            frequency TEXT,
            translation TEXT,
            alternative TEXT,
            context_sentence TEXT,
            video_id TEXT,
            segment_start REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.close()


# 初始化数据库
_init_db()


def get_cache(video_id: str, module: str) -> dict | list | None:
    """获取缓存的 AI 结果，无缓存返回 None"""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT data FROM video_cache WHERE video_id = ? AND module = ?",
            (video_id, module),
        ).fetchone()
        if row:
            return json.loads(row[0])
        return None
    finally:
        conn.close()


def set_cache(video_id: str, module: str, data) -> None:
    """存储 AI 结果到缓存"""
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO video_cache (video_id, module, data) VALUES (?, ?, ?)",
            (video_id, module, json.dumps(data, ensure_ascii=False)),
        )
        conn.commit()
    finally:
        conn.close()


def clear_cache(video_id: str, module: str = None) -> int:
    """清除缓存，返回删除的行数"""
    conn = _get_conn()
    try:
        if module:
            cursor = conn.execute(
                "DELETE FROM video_cache WHERE video_id = ? AND module = ?",
                (video_id, module),
            )
        else:
            cursor = conn.execute(
                "DELETE FROM video_cache WHERE video_id = ?",
                (video_id,),
            )
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()
