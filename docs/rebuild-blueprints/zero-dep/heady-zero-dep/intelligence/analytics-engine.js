/**
 * @file analytics-engine.js
 * @description In-memory columnar analytics engine (DuckDB replacement).
 *
 * Features:
 * - Columnar data storage (column-oriented for analytical queries)
 * - SQL-like query interface: SELECT, WHERE, GROUP BY, ORDER BY, JOIN
 * - Aggregate functions: SUM, AVG, COUNT, MIN, MAX, MEDIAN, STDDEV
 * - Window functions: ROW_NUMBER, RANK, LAG, LEAD, running totals
 * - In-memory materialized views
 * - Query result caching (LRU)
 * - PHI-based cache sizing
 *
 * Sacred Geometry: PHI ratios for cache sizing and shard counts.
 * Zero external dependencies (events only).
 *
 * @module HeadyIntelligence/AnalyticsEngine
 */

import { EventEmitter } from 'events';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// ─── Column Store ─────────────────────────────────────────────────────────────

/**
 * Columnar table: stores each column as a typed array or regular array.
 * Row access is by index across all column arrays.
 */
class ColumnStore {
  /**
   * @param {string}   name
   * @param {string[]} columns  Column names
   */
  constructor(name, columns) {
    this.name    = name;
    this.columns = columns;
    this._data   = new Map(columns.map(c => [c, []]));
    this._rowCount = 0;
    this._indices  = new Map(); // column → Map<value, Set<rowIdx>>
  }

  /** Number of rows in the table. */
  get rowCount() { return this._rowCount; }

  /**
   * Insert one or more rows.
   * @param {object|object[]} rows
   */
  insert(rows) {
    const arr = Array.isArray(rows) ? rows : [rows];
    for (const row of arr) {
      const idx = this._rowCount++;
      for (const col of this.columns) {
        const val = row[col] ?? null;
        this._data.get(col).push(val);
        // Update secondary index
        const idx_map = this._indices.get(col);
        if (idx_map) {
          if (!idx_map.has(val)) idx_map.set(val, new Set());
          idx_map.get(val).add(idx);
        }
      }
    }
    return this;
  }

  /**
   * Create an index on a column for faster lookups.
   * @param {string} column
   */
  createIndex(column) {
    if (!this.columns.includes(column)) {
      throw new Error(`Column "${column}" not in table "${this.name}"`);
    }
    const idx_map = new Map();
    const colData = this._data.get(column);
    for (let i = 0; i < colData.length; i++) {
      const v = colData[i];
      if (!idx_map.has(v)) idx_map.set(v, new Set());
      idx_map.get(v).add(i);
    }
    this._indices.set(column, idx_map);
    return this;
  }

  /**
   * Get a row by index as an object.
   * @param {number} idx
   * @returns {object}
   */
  getRow(idx) {
    const row = {};
    for (const col of this.columns) {
      row[col] = this._data.get(col)[idx];
    }
    return row;
  }

  /**
   * Get all rows as array of objects.
   */
  getAllRows() {
    return Array.from({ length: this._rowCount }, (_, i) => this.getRow(i));
  }

  /**
   * Get a full column array.
   * @param {string} col
   */
  getColumn(col) {
    return this._data.get(col) ?? [];
  }

  /**
   * Schema info.
   */
  schema() {
    return {
      name:     this.name,
      columns:  this.columns,
      rowCount: this._rowCount,
      indices:  [...this._indices.keys()],
    };
  }

  /**
   * Truncate (clear) the table.
   */
  truncate() {
    for (const col of this.columns) this._data.get(col).length = 0;
    this._rowCount = 0;
    this._indices.clear();
    return this;
  }
}

// ─── Query Engine helpers ─────────────────────────────────────────────────────

/** Parse a simple expression: col, col op value */
function _parseCondition(expr) {
  if (typeof expr === 'function') return expr;

  // Tokenize: "col op value"
  const ops = ['>=', '<=', '!=', '<>', '=', '>', '<', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];
  for (const op of ops) {
    const idx = expr.toUpperCase().indexOf(op === '=' ? ' = ' : ` ${op} `);
    if (idx !== -1) {
      const col = expr.slice(0, idx).trim();
      const raw = expr.slice(idx + op.length + 2).trim();
      const val = _coerceVal(raw);
      switch (op) {
        case '>=': return row => (row[col] ?? null) >= val;
        case '<=': return row => (row[col] ?? null) <= val;
        case '!=':
        case '<>': return row => (row[col] ?? null) !== val;
        case '=':  return row => (row[col] ?? null) === val;
        case '>':  return row => (row[col] ?? null) > val;
        case '<':  return row => (row[col] ?? null) < val;
        case 'LIKE': {
          const pattern = new RegExp('^' + raw.replace(/'/g, '').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
          return row => pattern.test(String(row[col] ?? ''));
        }
        case 'IS NULL':     return row => row[col] == null;
        case 'IS NOT NULL': return row => row[col] != null;
        default:
      }
    }
  }
  throw new Error(`Cannot parse condition: ${expr}`);
}

function _coerceVal(raw) {
  if (raw === 'null' || raw === 'NULL') return null;
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  if ((raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  const n = Number(raw);
  return isNaN(n) ? raw : n;
}

/** Evaluate aggregate functions on an array. */
function _aggregate(fn, values) {
  const nums = values.filter(v => v != null && !isNaN(+v)).map(Number);
  switch (fn.toUpperCase()) {
    case 'COUNT': return values.length;
    case 'COUNT_DISTINCT': return new Set(values).size;
    case 'SUM':   return nums.reduce((s, v) => s + v, 0);
    case 'AVG':   return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
    case 'MIN':   return nums.length ? Math.min(...nums) : null;
    case 'MAX':   return nums.length ? Math.max(...nums) : null;
    case 'MEDIAN': {
      const s = [...nums].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
    }
    case 'STDDEV': {
      if (nums.length < 2) return 0;
      const mu = nums.reduce((s, v) => s + v, 0) / nums.length;
      return Math.sqrt(nums.reduce((s, v) => s + (v - mu) ** 2, 0) / (nums.length - 1));
    }
    default: throw new Error(`Unknown aggregate function: ${fn}`);
  }
}

// ─── LRU Query Cache ──────────────────────────────────────────────────────────

class LRUQueryCache {
  constructor(capacity = Math.round(89 * PHI)) {
    this.capacity = capacity;
    this._map     = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const val = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, val);
    return val;
  }

  set(key, val) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this.capacity) {
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, val);
  }

  clear() { this._map.clear(); }
  get size() { return this._map.size; }
}

// ─── Query Builder ─────────────────────────────────────────────────────────────

/**
 * Fluent query builder.
 */
class QueryBuilder {
  constructor(engine, tableName) {
    this._engine    = engine;
    this._table     = tableName;
    this._select    = null;   // null = *
    this._where     = [];
    this._groupBy   = null;
    this._orderBy   = null;
    this._orderDir  = 'ASC';
    this._limit     = null;
    this._offset    = 0;
    this._join      = [];
    this._aggregate = null;  // { fn, col }
    this._window    = null;
    this._cacheKey  = null;
  }

  select(...cols) { this._select = cols.flat(); return this; }
  where(cond)     { this._where.push(_parseCondition(cond)); return this; }
  groupBy(...cols){ this._groupBy = cols.flat(); return this; }
  orderBy(col, dir = 'ASC') { this._orderBy = col; this._orderDir = dir.toUpperCase(); return this; }
  limit(n)        { this._limit = n; return this; }
  offset(n)       { this._offset = n; return this; }
  cache(key)      { this._cacheKey = key; return this; }

  /**
   * Add an aggregate column: { fn, col, alias }
   * @param {string} fn     SUM|AVG|COUNT|MIN|MAX|MEDIAN|STDDEV
   * @param {string} col    Column name (or '*' for COUNT)
   * @param {string} alias  Output column name
   */
  agg(fn, col, alias) {
    if (!this._aggregate) this._aggregate = [];
    this._aggregate.push({ fn, col, alias: alias ?? `${fn}(${col})` });
    return this;
  }

  /**
   * Inner join with another table.
   * @param {string} table  Table name
   * @param {string} on     "leftCol = rightCol"
   */
  join(table, on) {
    const [left, right] = on.split('=').map(s => s.trim());
    this._join.push({ table, leftCol: left, rightCol: right });
    return this;
  }

  /**
   * Window function: ROW_NUMBER, RANK, LAG, LEAD
   * @param {string} fn       Window function name
   * @param {string} col      Source column
   * @param {string} alias    Output alias
   * @param {object} [opts]   { partitionBy, orderBy, offset (for LAG/LEAD) }
   */
  window(fn, col, alias, opts = {}) {
    if (!this._window) this._window = [];
    this._window.push({ fn, col, alias, opts });
    return this;
  }

  /** Execute the query. */
  async run() {
    return this._engine._execute(this);
  }
}

// ─── Analytics Engine ─────────────────────────────────────────────────────────

export class AnalyticsEngine extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.queryCacheSize]   LRU query cache size
   * @param {boolean} [opts.queryEvents]      Emit query events (default: false)
   */
  constructor(opts = {}) {
    super();
    this._tables     = new Map();
    this._views      = new Map();  // materialized views
    this._cache      = new LRUQueryCache(opts.queryCacheSize ?? Math.round(89 * PHI));
    this._queryLog   = [];
    this._emitEvents = opts.queryEvents ?? false;
    this._queryCount = 0;
  }

  // ── DDL ────────────────────────────────────────────────────────────────────

  /**
   * Create a new table.
   * @param {string}   name
   * @param {string[]} columns
   * @returns {ColumnStore}
   */
  createTable(name, columns) {
    if (this._tables.has(name)) throw new Error(`Table "${name}" already exists`);
    const table = new ColumnStore(name, columns);
    this._tables.set(name, table);
    return table;
  }

  /**
   * Get an existing table.
   * @param {string} name
   * @returns {ColumnStore}
   */
  table(name) {
    const t = this._tables.get(name) ?? this._views.get(name);
    if (!t) throw new Error(`Table/view "${name}" not found`);
    return t;
  }

  /**
   * Drop a table.
   */
  dropTable(name) {
    this._tables.delete(name);
    this._cache.clear(); // invalidate all cached queries
  }

  /**
   * List all table names and schemas.
   */
  listTables() {
    return [...this._tables.entries()].map(([_, t]) => t.schema());
  }

  // ── DML ────────────────────────────────────────────────────────────────────

  /**
   * Insert rows into a table.
   * @param {string}           tableName
   * @param {object|object[]}  rows
   */
  insert(tableName, rows) {
    this.table(tableName).insert(rows);
    this._invalidateViewsFor(tableName);
    return this;
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Start a fluent query on a table.
   * @param {string} tableName
   * @returns {QueryBuilder}
   */
  from(tableName) {
    return new QueryBuilder(this, tableName);
  }

  /**
   * Execute a QueryBuilder plan.
   * @private
   */
  async _execute(qb) {
    const startMs = Date.now();
    this._queryCount++;

    // Cache check
    if (qb._cacheKey) {
      const cached = this._cache.get(qb._cacheKey);
      if (cached !== undefined) return cached;
    }

    // 1. Scan source table (resolve view if needed)
    let rows = this._scan(qb._table);

    // 2. JOINs
    for (const join of qb._join) {
      const right = this._scan(join.table);
      rows = _innerJoin(rows, right, join.leftCol, join.rightCol);
    }

    // 3. WHERE filter
    for (const cond of qb._where) {
      rows = rows.filter(cond);
    }

    // 4. GROUP BY + aggregate
    if (qb._groupBy && qb._aggregate) {
      rows = _groupAggregate(rows, qb._groupBy, qb._aggregate);
    } else if (qb._aggregate && !qb._groupBy) {
      // Single-group aggregate (entire table)
      const result = {};
      for (const { fn, col, alias } of qb._aggregate) {
        result[alias] = _aggregate(fn, rows.map(r => r[col]));
      }
      rows = [result];
    }

    // 5. Window functions
    if (qb._window) {
      rows = _applyWindows(rows, qb._window);
    }

    // 6. SELECT projection
    if (qb._select) {
      rows = rows.map(r => {
        const out = {};
        for (const col of qb._select) out[col] = r[col] ?? null;
        return out;
      });
    }

    // 7. ORDER BY
    if (qb._orderBy) {
      const col = qb._orderBy;
      const dir = qb._orderDir === 'DESC' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        if (a[col] < b[col]) return -dir;
        if (a[col] > b[col]) return dir;
        return 0;
      });
    }

    // 8. OFFSET + LIMIT
    if (qb._offset) rows = rows.slice(qb._offset);
    if (qb._limit !== null) rows = rows.slice(0, qb._limit);

    const elapsedMs = Date.now() - startMs;

    if (this._emitEvents) {
      this.emit('query', { table: qb._table, rows: rows.length, elapsedMs });
    }

    this._queryLog.push({ table: qb._table, rows: rows.length, elapsedMs, at: Date.now() });
    if (this._queryLog.length > 1000) this._queryLog.shift();

    if (qb._cacheKey) this._cache.set(qb._cacheKey, rows);
    return rows;
  }

  /** Scan table into rows array. */
  _scan(name) {
    const t = this._tables.get(name) ?? this._views.get(name);
    if (!t) throw new Error(`Table/view "${name}" not found`);
    if (t instanceof ColumnStore) return t.getAllRows();
    // Materialized view: already row array
    return t.rows ?? [];
  }

  // ── Materialized Views ─────────────────────────────────────────────────────

  /**
   * Create a materialized view by running a query.
   * @param {string}        viewName
   * @param {QueryBuilder}  query
   */
  async createMaterializedView(viewName, query) {
    const rows = await query.run();
    this._views.set(viewName, { rows, refreshedAt: Date.now(), sourceTables: [query._table] });
    return rows;
  }

  /**
   * Refresh a materialized view.
   */
  async refreshView(viewName) {
    const view = this._views.get(viewName);
    if (!view) throw new Error(`View "${viewName}" not found`);
    const rows = await view._qb?.run() ?? [];
    view.rows        = rows;
    view.refreshedAt = Date.now();
    return rows;
  }

  _invalidateViewsFor(tableName) {
    for (const [name, view] of this._views) {
      if (view.sourceTables?.includes(tableName)) {
        this._views.delete(name);
      }
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  /**
   * Engine statistics.
   */
  stats() {
    return {
      tables:      this._tables.size,
      views:       this._views.size,
      queryCount:  this._queryCount,
      cacheSize:   this._cache.size,
      recentQueries: this._queryLog.slice(-10),
    };
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function _innerJoin(left, right, leftCol, rightCol) {
  const rightIndex = new Map();
  for (const row of right) {
    const k = row[rightCol];
    if (!rightIndex.has(k)) rightIndex.set(k, []);
    rightIndex.get(k).push(row);
  }
  const result = [];
  for (const lRow of left) {
    const matches = rightIndex.get(lRow[leftCol]) ?? [];
    for (const rRow of matches) {
      result.push({ ...lRow, ...rRow });
    }
  }
  return result;
}

function _groupAggregate(rows, groupCols, aggSpecs) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupCols.map(c => JSON.stringify(row[c])).join('|');
    if (!groups.has(key)) {
      const groupRow = {};
      for (const c of groupCols) groupRow[c] = row[c];
      groupRow._rows = [];
      groups.set(key, groupRow);
    }
    groups.get(key)._rows.push(row);
  }

  const result = [];
  for (const [, g] of groups) {
    const out = {};
    for (const c of groupCols) out[c] = g[c];
    for (const { fn, col, alias } of aggSpecs) {
      out[alias] = _aggregate(fn, g._rows.map(r => r[col]));
    }
    result.push(out);
  }
  return result;
}

function _applyWindows(rows, windows) {
  for (const { fn, col, alias, opts } of windows) {
    const partBy = opts.partitionBy;
    const ordBy  = opts.orderBy;

    // Group by partition if specified
    const getPartKey = partBy
      ? row => partBy.map(c => row[c]).join('|')
      : () => '__all__';

    const partitions = new Map();
    rows.forEach((row, i) => {
      const key = getPartKey(row);
      if (!partitions.has(key)) partitions.set(key, []);
      partitions.get(key).push({ row, origIdx: i });
    });

    for (const [, part] of partitions) {
      // Sort partition if orderBy specified
      if (ordBy) {
        part.sort((a, b) => {
          if (a.row[ordBy] < b.row[ordBy]) return -1;
          if (a.row[ordBy] > b.row[ordBy]) return 1;
          return 0;
        });
      }

      switch (fn.toUpperCase()) {
        case 'ROW_NUMBER':
          part.forEach(({ row }, i) => { row[alias] = i + 1; });
          break;
        case 'RANK': {
          let rank = 1;
          part.forEach(({ row }, i) => {
            if (i > 0 && part[i].row[ordBy] !== part[i - 1].row[ordBy]) rank = i + 1;
            row[alias] = rank;
          });
          break;
        }
        case 'LAG': {
          const lag = opts.offset ?? 1;
          part.forEach(({ row }, i) => {
            row[alias] = i >= lag ? part[i - lag].row[col] : null;
          });
          break;
        }
        case 'LEAD': {
          const lead = opts.offset ?? 1;
          part.forEach(({ row }, i) => {
            row[alias] = i + lead < part.length ? part[i + lead].row[col] : null;
          });
          break;
        }
        case 'RUNNING_SUM': {
          let running = 0;
          part.forEach(({ row }) => {
            running += Number(row[col] ?? 0);
            row[alias] = running;
          });
          break;
        }
        case 'RUNNING_AVG': {
          let sum = 0, count = 0;
          part.forEach(({ row }) => {
            sum += Number(row[col] ?? 0);
            count++;
            row[alias] = count ? sum / count : null;
          });
          break;
        }
        default:
          throw new Error(`Unknown window function: ${fn}`);
      }
    }
  }
  return rows;
}

export default AnalyticsEngine;
