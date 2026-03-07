"""
database.py
===========
Zero-dependency SQLite-backed database — replaces PostgreSQL/Neon.

Features:
    - Connection pooling (thread-safe, bounded pool)
    - Migration system (auto-create tables, versioned schema)
    - JSON column support (transparent serialize/deserialize)
    - Vector storage table (BLOB for float embeddings)
    - Fluent query builder (SELECT / INSERT / UPDATE / DELETE)
    - Context manager transactions
    - WAL mode for concurrent reads
    - Automatic backup (with timestamp)
    - Schema introspection
    - Named placeholders, safe parameterization

Usage:
    from core.database import Database, get_default_db

    db = Database("heady.db")
    db.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)")
    db.execute("INSERT INTO users (name) VALUES (?)", ("Alice",))
    rows = db.fetch_all("SELECT * FROM users")

    # QueryBuilder
    q = db.query("users").where("name = ?", "Alice").limit(10)
    rows = q.fetch_all()

    # Transactions
    with db.transaction():
        db.execute("INSERT INTO users (name) VALUES (?)", ("Bob",))
        db.execute("UPDATE users SET name = ? WHERE id = ?", ("Robert", 1))

    # Migrations
    db.migrate([
        Migration("0001_create_users",
                  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)"),
    ])
"""

from __future__ import annotations

import json
import logging
import os
import queue
import re
import shutil
import sqlite3
import struct
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Iterator, Sequence

__all__ = [
    "Database",
    "QueryBuilder",
    "Migration",
    "get_default_db",
    "transaction",
]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------


@dataclass
class Migration:
    """A named, idempotent schema migration."""

    name: str
    sql: str  # Can contain multiple semicolon-separated statements
    down_sql: str = ""  # Optional rollback SQL


# ---------------------------------------------------------------------------
# Row type
# ---------------------------------------------------------------------------


class Row(dict):
    """
    Dict subclass that allows attribute access.
    row["name"] == row.name
    """

    def __getattr__(self, item: str) -> Any:
        try:
            return self[item]
        except KeyError:
            raise AttributeError(f"Row has no column '{item}'")

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value


# ---------------------------------------------------------------------------
# Connection wrapper
# ---------------------------------------------------------------------------


class _Connection:
    """Thin wrapper around sqlite3.Connection with helper methods."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self.in_transaction = False

    def execute(self, sql: str, params: Sequence | dict = ()) -> sqlite3.Cursor:
        return self._conn.execute(sql, params)

    def executemany(self, sql: str, data: list[Sequence | dict]) -> sqlite3.Cursor:
        return self._conn.executemany(sql, data)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()

    @property
    def raw(self) -> sqlite3.Connection:
        return self._conn


# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------


class _ConnectionPool:
    """
    Bounded pool of SQLite connections.

    SQLite allows multiple readers in WAL mode; one writer at a time.
    """

    def __init__(
        self,
        path: str,
        max_size: int = 10,
        timeout: float = 30.0,
        check_same_thread: bool = False,
    ) -> None:
        self._path = path
        self._max_size = max_size
        self._timeout = timeout
        self._pool: queue.Queue[sqlite3.Connection] = queue.Queue(maxsize=max_size)
        self._created = 0
        self._lock = threading.Lock()
        self._check_same_thread = check_same_thread

    def _make_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(
            self._path,
            check_same_thread=self._check_same_thread,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )
        conn.row_factory = sqlite3.Row
        # WAL mode for concurrent readers
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.execute("PRAGMA cache_size=-64000")  # 64 MB
        return conn

    @contextmanager
    def acquire(self) -> Generator[sqlite3.Connection, None, None]:
        try:
            conn = self._pool.get_nowait()
        except queue.Empty:
            with self._lock:
                if self._created < self._max_size:
                    conn = self._make_connection()
                    self._created += 1
                else:
                    conn = self._pool.get(timeout=self._timeout)
        try:
            yield conn
        finally:
            try:
                self._pool.put_nowait(conn)
            except queue.Full:
                conn.close()
                with self._lock:
                    self._created -= 1

    def close_all(self) -> None:
        while True:
            try:
                conn = self._pool.get_nowait()
                conn.close()
            except queue.Empty:
                break
        self._created = 0


# ---------------------------------------------------------------------------
# Query Builder
# ---------------------------------------------------------------------------


class QueryBuilder:
    """
    Fluent SQL query builder for SELECT / INSERT / UPDATE / DELETE.

    Example:
        rows = (
            db.query("users")
              .select("id", "name", "email")
              .where("active = ?", 1)
              .where("created_at > ?", "2024-01-01")
              .order_by("name ASC")
              .limit(20)
              .offset(40)
              .fetch_all()
        )
    """

    def __init__(self, db: "Database", table: str) -> None:
        self._db = db
        self._table = table
        self._selects: list[str] = []
        self._wheres: list[str] = []
        self._params: list[Any] = []
        self._order: list[str] = []
        self._limit_val: int | None = None
        self._offset_val: int | None = None
        self._joins: list[str] = []

    def select(self, *columns: str) -> "QueryBuilder":
        self._selects.extend(columns)
        return self

    def where(self, clause: str, *params: Any) -> "QueryBuilder":
        self._wheres.append(clause)
        self._params.extend(params)
        return self

    def join(self, clause: str) -> "QueryBuilder":
        self._joins.append(clause)
        return self

    def order_by(self, *clauses: str) -> "QueryBuilder":
        self._order.extend(clauses)
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit_val = n
        return self

    def offset(self, n: int) -> "QueryBuilder":
        self._offset_val = n
        return self

    def _build_select(self) -> tuple[str, list[Any]]:
        cols = ", ".join(self._selects) if self._selects else "*"
        sql = f"SELECT {cols} FROM {self._table}"
        if self._joins:
            sql += " " + " ".join(self._joins)
        if self._wheres:
            sql += " WHERE " + " AND ".join(self._wheres)
        if self._order:
            sql += " ORDER BY " + ", ".join(self._order)
        if self._limit_val is not None:
            sql += f" LIMIT {self._limit_val}"
        if self._offset_val is not None:
            sql += f" OFFSET {self._offset_val}"
        return sql, self._params

    def fetch_all(self) -> list[Row]:
        sql, params = self._build_select()
        return self._db.fetch_all(sql, params)

    def fetch_one(self) -> Row | None:
        self.limit(1)
        sql, params = self._build_select()
        return self._db.fetch_one(sql, params)

    def count(self) -> int:
        sql = f"SELECT COUNT(*) as cnt FROM {self._table}"
        if self._wheres:
            sql += " WHERE " + " AND ".join(self._wheres)
        row = self._db.fetch_one(sql, self._params)
        return row["cnt"] if row else 0

    def update(self, **values: Any) -> int:
        set_clauses = ", ".join(f"{k} = ?" for k in values)
        params = list(values.values()) + self._params
        sql = f"UPDATE {self._table} SET {set_clauses}"
        if self._wheres:
            sql += " WHERE " + " AND ".join(self._wheres)
        return self._db.execute(sql, params).rowcount

    def delete(self) -> int:
        sql = f"DELETE FROM {self._table}"
        if self._wheres:
            sql += " WHERE " + " AND ".join(self._wheres)
        return self._db.execute(sql, self._params).rowcount

    def insert(self, **values: Any) -> int:
        cols = ", ".join(values.keys())
        placeholders = ", ".join("?" for _ in values)
        sql = f"INSERT INTO {self._table} ({cols}) VALUES ({placeholders})"
        cursor = self._db.execute(sql, list(values.values()))
        return cursor.lastrowid or 0

    def upsert(self, conflict_cols: list[str], **values: Any) -> int:
        cols = ", ".join(values.keys())
        placeholders = ", ".join("?" for _ in values)
        update_set = ", ".join(
            f"{k} = excluded.{k}" for k in values if k not in conflict_cols
        )
        conflict = ", ".join(conflict_cols)
        sql = (
            f"INSERT INTO {self._table} ({cols}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict}) DO UPDATE SET {update_set}"
        )
        cursor = self._db.execute(sql, list(values.values()))
        return cursor.lastrowid or 0


# ---------------------------------------------------------------------------
# JSON type adapter
# ---------------------------------------------------------------------------


def _adapt_json(val: Any) -> str:
    return json.dumps(val, ensure_ascii=False, default=str)


def _convert_json(raw: bytes) -> Any:
    return json.loads(raw.decode("utf-8"))


sqlite3.register_adapter(dict, _adapt_json)
sqlite3.register_adapter(list, _adapt_json)
sqlite3.register_converter("JSON", _convert_json)


# ---------------------------------------------------------------------------
# Vector helpers
# ---------------------------------------------------------------------------


def _encode_vector(v: list[float]) -> bytes:
    return struct.pack(f"{len(v)}f", *v)


def _decode_vector(data: bytes) -> list[float]:
    n = len(data) // 4
    return list(struct.unpack(f"{n}f", data))


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


class Database:
    """
    SQLite-backed database with pooling, migrations, and a fluent query builder.

    Args:
        path:     File path for SQLite DB. Use ":memory:" for in-memory.
        pool_size: Max concurrent connections.
    """

    def __init__(
        self,
        path: str | Path = "heady.db",
        pool_size: int = 10,
        timeout: float = 30.0,
    ) -> None:
        self._path = str(path)
        self._pool = _ConnectionPool(self._path, max_size=pool_size, timeout=timeout)
        self._write_lock = threading.Lock()  # Serialize writes for safety
        self._migration_lock = threading.Lock()
        self._local = threading.local()  # For transaction context

        # Bootstrap the migrations table
        self._bootstrap()

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------

    def _bootstrap(self) -> None:
        """Create internal heady_* tables."""
        self.execute("""
            CREATE TABLE IF NOT EXISTS _heady_migrations (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                name    TEXT UNIQUE NOT NULL,
                applied_at TEXT NOT NULL
            )
        """)
        self.execute("""
            CREATE TABLE IF NOT EXISTS _heady_vectors (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                namespace TEXT NOT NULL,
                key       TEXT NOT NULL,
                embedding BLOB NOT NULL,
                metadata  TEXT,
                UNIQUE(namespace, key)
            )
        """)
        self.execute(
            "CREATE INDEX IF NOT EXISTS idx_vectors_ns ON _heady_vectors (namespace)"
        )

    # ------------------------------------------------------------------
    # Core execute
    # ------------------------------------------------------------------

    def execute(
        self,
        sql: str,
        params: Sequence | dict = (),
    ) -> sqlite3.Cursor:
        """Execute a single SQL statement."""
        if hasattr(self._local, "conn") and self._local.conn is not None:
            # Inside an active transaction
            return self._local.conn.execute(sql, params)

        with self._pool.acquire() as conn:
            try:
                cursor = conn.execute(sql, params)
                conn.commit()
                return cursor
            except sqlite3.Error as exc:
                conn.rollback()
                logger.error("SQL error: %s\nSQL: %s\nParams: %s", exc, sql, params)
                raise

    def executemany(self, sql: str, data: list) -> sqlite3.Cursor:
        """Execute a statement with multiple parameter sets."""
        with self._pool.acquire() as conn:
            try:
                cursor = conn.executemany(sql, data)
                conn.commit()
                return cursor
            except sqlite3.Error as exc:
                conn.rollback()
                raise

    def execute_script(self, sql: str) -> None:
        """Execute multiple semicolon-separated statements."""
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            self.execute(stmt)

    # ------------------------------------------------------------------
    # Fetch helpers
    # ------------------------------------------------------------------

    def fetch_all(self, sql: str, params: Sequence | dict = ()) -> list[Row]:
        with self._pool.acquire() as conn:
            cursor = conn.execute(sql, params)
            cols = [d[0] for d in cursor.description or []]
            return [Row(zip(cols, row)) for row in cursor.fetchall()]

    def fetch_one(self, sql: str, params: Sequence | dict = ()) -> Row | None:
        with self._pool.acquire() as conn:
            cursor = conn.execute(sql, params)
            cols = [d[0] for d in cursor.description or []]
            row = cursor.fetchone()
            return Row(zip(cols, row)) if row else None

    def fetch_scalar(self, sql: str, params: Sequence | dict = ()) -> Any:
        row = self.fetch_one(sql, params)
        if row:
            return next(iter(row.values()))
        return None

    # ------------------------------------------------------------------
    # Transactions
    # ------------------------------------------------------------------

    @contextmanager
    def transaction(self) -> Generator[None, None, None]:
        """
        Context manager for explicit transactions.

        with db.transaction():
            db.execute(...)
            db.execute(...)
        """
        with self._pool.acquire() as conn:
            self._local.conn = conn
            conn.execute("BEGIN")
            try:
                yield
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                self._local.conn = None

    # ------------------------------------------------------------------
    # Query builder entry point
    # ------------------------------------------------------------------

    def query(self, table: str) -> QueryBuilder:
        return QueryBuilder(self, table)

    def insert(self, table: str, **values: Any) -> int:
        return self.query(table).insert(**values)

    def update(self, table: str, where: str, where_params: list, **values: Any) -> int:
        return self.query(table).where(where, *where_params).update(**values)

    # ------------------------------------------------------------------
    # Migrations
    # ------------------------------------------------------------------

    def migrate(self, migrations: list[Migration]) -> list[str]:
        """
        Run pending migrations in order.

        Returns:
            List of migration names that were applied.
        """
        applied: list[str] = []
        with self._migration_lock:
            for m in migrations:
                exists = self.fetch_one(
                    "SELECT 1 FROM _heady_migrations WHERE name = ?", (m.name,)
                )
                if exists:
                    continue
                logger.info("Applying migration: %s", m.name)
                try:
                    with self.transaction():
                        self.execute_script(m.sql)
                        self.execute(
                            "INSERT INTO _heady_migrations (name, applied_at) VALUES (?, ?)",
                            (m.name, datetime.now(timezone.utc).isoformat()),
                        )
                    applied.append(m.name)
                    logger.info("Migration applied: %s", m.name)
                except Exception as exc:
                    logger.error("Migration failed [%s]: %s", m.name, exc)
                    raise
        return applied

    def get_applied_migrations(self) -> list[str]:
        rows = self.fetch_all("SELECT name FROM _heady_migrations ORDER BY id")
        return [r["name"] for r in rows]

    # ------------------------------------------------------------------
    # Vector storage
    # ------------------------------------------------------------------

    def store_vector(
        self,
        namespace: str,
        key: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        """Store an embedding vector (BLOB) with optional JSON metadata."""
        blob = _encode_vector(embedding)
        meta_json = json.dumps(metadata) if metadata else None
        self.query("_heady_vectors").upsert(
            ["namespace", "key"],
            namespace=namespace,
            key=key,
            embedding=blob,
            metadata=meta_json,
        )

    def get_vector(
        self, namespace: str, key: str
    ) -> tuple[list[float], dict | None] | None:
        """Retrieve an embedding vector and its metadata."""
        row = self.fetch_one(
            "SELECT embedding, metadata FROM _heady_vectors WHERE namespace = ? AND key = ?",
            (namespace, key),
        )
        if row is None:
            return None
        emb = _decode_vector(row["embedding"])
        meta = json.loads(row["metadata"]) if row["metadata"] else None
        return emb, meta

    def list_vectors(self, namespace: str) -> list[dict]:
        rows = self.fetch_all(
            "SELECT key, metadata FROM _heady_vectors WHERE namespace = ?",
            (namespace,),
        )
        return [{"key": r["key"], "metadata": json.loads(r["metadata"] or "null")} for r in rows]

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b):
            raise ValueError("Vectors must have the same length")
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x ** 2 for x in a) ** 0.5
        norm_b = sum(x ** 2 for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def search_vectors(
        self,
        namespace: str,
        query_vector: list[float],
        top_k: int = 10,
    ) -> list[dict]:
        """
        Brute-force cosine similarity search over stored vectors.

        Returns top_k results sorted by similarity descending.
        """
        rows = self.fetch_all(
            "SELECT key, embedding, metadata FROM _heady_vectors WHERE namespace = ?",
            (namespace,),
        )
        results = []
        for row in rows:
            vec = _decode_vector(row["embedding"])
            sim = self.cosine_similarity(query_vector, vec)
            results.append({
                "key": row["key"],
                "similarity": sim,
                "metadata": json.loads(row["metadata"] or "null"),
            })
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # Schema introspection
    # ------------------------------------------------------------------

    def tables(self) -> list[str]:
        rows = self.fetch_all(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        return [r["name"] for r in rows]

    def columns(self, table: str) -> list[dict]:
        rows = self.fetch_all(f"PRAGMA table_info({table})")
        return [dict(r) for r in rows]

    def table_exists(self, table: str) -> bool:
        return table in self.tables()

    # ------------------------------------------------------------------
    # Backup
    # ------------------------------------------------------------------

    def backup(self, dest: str | Path | None = None) -> Path:
        """
        Create a timestamped backup of the database file.

        Args:
            dest: Directory for the backup. Defaults to same directory as db.

        Returns:
            Path to the backup file.
        """
        if self._path == ":memory:":
            raise ValueError("Cannot backup an in-memory database")
        src = Path(self._path)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_dir = Path(dest) if dest else src.parent
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{src.stem}_{ts}.db"
        # Use SQLite's built-in backup API
        with self._pool.acquire() as conn:
            backup_conn = sqlite3.connect(str(target))
            conn.backup(backup_conn)
            backup_conn.close()
        logger.info("Database backed up to %s", target)
        return target

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._pool.close_all()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def __repr__(self) -> str:
        return f"<Database path={self._path!r}>"


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

_default_db: Database | None = None


def get_default_db(path: str | Path = "heady.db", **kwargs: Any) -> Database:
    """Return (or create) the module-level default Database instance."""
    global _default_db
    if _default_db is None:
        _default_db = Database(path, **kwargs)
    return _default_db


@contextmanager
def transaction(db: Database | None = None) -> Generator[None, None, None]:
    """Convenience: transaction(db) or transaction() for default db."""
    db_ = db or get_default_db()
    with db_.transaction():
        yield
