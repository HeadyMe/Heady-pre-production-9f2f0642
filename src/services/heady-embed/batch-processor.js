'use strict';

/**
 * HeadyEmbed Batch Processor
 *
 * Dynamic batch sizing, priority queue, deduplication, PHI-scaled retry backoff,
 * and concurrency limiting to prevent OOM during high-throughput workloads.
 */

const EventEmitter = require('events');
const config = require('./config');

// ---------------------------------------------------------------------------
// Priority Queue (min-heap by priority, then insertion order)
// ---------------------------------------------------------------------------

class PriorityQueue {
  constructor() {
    this._heap = [];
    this._counter = 0; // tie-break by insertion order
  }

  /**
   * @param {object} item
   * @param {number} priority - Lower number = higher priority (0 = urgent)
   */
  enqueue(item, priority = 5) {
    const node = { item, priority, seq: this._counter++ };
    this._heap.push(node);
    this._bubbleUp(this._heap.length - 1);
  }

  dequeue() {
    if (this._heap.length === 0) return null;
    this._swap(0, this._heap.length - 1);
    const node = this._heap.pop();
    this._siftDown(0);
    return node.item;
  }

  dequeueN(n) {
    const items = [];
    while (items.length < n && this._heap.length > 0) {
      items.push(this.dequeue());
    }
    return items;
  }

  get size() { return this._heap.length; }
  get isEmpty() { return this._heap.length === 0; }

  _compare(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.seq - b.seq;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._compare(this._heap[i], this._heap[parent]) >= 0) break;
      this._swap(i, parent);
      i = parent;
    }
  }

  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this._compare(this._heap[left], this._heap[smallest]) < 0) smallest = left;
      if (right < n && this._compare(this._heap[right], this._heap[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
  }
}

// ---------------------------------------------------------------------------
// BatchRequest helper
// ---------------------------------------------------------------------------

class BatchRequest {
  /**
   * @param {string[]} texts
   * @param {object} options
   * @param {number} options.priority     - 0 (urgent) to 9 (low)
   * @param {Function} options.onProgress - callback(processed, total)
   * @param {string}   options.modelId
   */
  constructor(texts, options = {}) {
    this.id = `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.texts = texts;
    this.modelId = options.modelId || config.model;
    this.priority = typeof options.priority === 'number' ? options.priority : 5;
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    this.createdAt = Date.now();

    // Resolved by BatchProcessor
    let _resolve, _reject;
    this.promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });
    this.resolve = _resolve;
    this.reject = _reject;
  }
}

// ---------------------------------------------------------------------------
// BatchProcessor Class
// ---------------------------------------------------------------------------

class BatchProcessor extends EventEmitter {
  /**
   * @param {object} options
   * @param {Function} options.embedFn          - async (texts, modelId) => Float32Array[]
   * @param {number}   options.batchSize         - Base batch size
   * @param {number}   options.maxConcurrent     - Max simultaneous batches
   * @param {number}   options.maxMemoryMb       - Soft memory cap for dynamic sizing
   * @param {number}   options.retryMaxAttempts  - Max retry attempts
   */
  constructor(options = {}) {
    super();

    if (typeof options.embedFn !== 'function') {
      throw new Error('BatchProcessor requires embedFn option');
    }

    this._embedFn = options.embedFn;
    this._baseBatchSize = options.batchSize || config.batchSize;
    this._maxConcurrent = options.maxConcurrent || config.maxConcurrentBatches;
    this._maxMemoryMb = options.maxMemoryMb || config.maxMemoryMb;
    this._retryMaxAttempts = options.retryMaxAttempts || config.retryMaxAttempts;

    this._queue = new PriorityQueue();
    this._activeBatches = 0;
    this._processing = false;
    this._shuttingDown = false;

    this._stats = {
      totalRequests: 0,
      totalTexts: 0,
      totalBatches: 0,
      dedupSavings: 0,
      retries: 0,
      errors: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Submit texts for embedding.
   * Returns a Promise resolving to Float32Array[] (one per input text).
   *
   * @param {string|string[]} texts
   * @param {object} options
   * @returns {Promise<Float32Array[]>}
   */
  async embed(texts, options = {}) {
    if (this._shuttingDown) {
      throw new Error('BatchProcessor is shutting down');
    }

    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) return [];

    const req = new BatchRequest(arr, options);
    this._queue.enqueue(req, req.priority);
    this._stats.totalRequests++;
    this._stats.totalTexts += arr.length;

    this.emit('queued', { requestId: req.id, count: arr.length, queueSize: this._queue.size });

    // Trigger processing loop
    this._scheduleFlush();

    return req.promise;
  }

  /**
   * Get current processor stats.
   */
  getStats() {
    return {
      ...this._stats,
      queueSize: this._queue.size,
      activeBatches: this._activeBatches,
      currentBatchSize: this._computeBatchSize(),
    };
  }

  /**
   * Graceful shutdown: drain queue then stop.
   */
  async shutdown() {
    this._shuttingDown = true;

    // Drain remaining requests with error
    while (!this._queue.isEmpty) {
      const req = this._queue.dequeue();
      req.reject(new Error('BatchProcessor shutting down'));
    }

    // Wait for active batches to finish
    while (this._activeBatches > 0) {
      await sleep(100);
    }

    this.emit('shutdown');
  }

  // -------------------------------------------------------------------------
  // Internal: scheduling and processing
  // -------------------------------------------------------------------------

  _scheduleFlush() {
    if (this._processing) return;
    // Use setImmediate to allow multiple enqueues to coalesce
    setImmediate(() => this._flush());
  }

  async _flush() {
    if (this._processing) return;
    this._processing = true;

    try {
      while (!this._queue.isEmpty && this._activeBatches < this._maxConcurrent) {
        const batchSize = this._computeBatchSize();
        const requests = this._queue.dequeueN(batchSize);

        if (requests.length === 0) break;

        this._activeBatches++;
        this._stats.totalBatches++;

        // Fire-and-forget; promise tracked internally
        this._processBatch(requests).finally(() => {
          this._activeBatches--;
          this.emit('batchComplete', { activeBatches: this._activeBatches });
          // Continue flushing
          this._scheduleFlush();
        });
      }
    } finally {
      this._processing = false;
    }
  }

  /**
   * Process a batch of BatchRequest objects.
   */
  async _processBatch(requests) {
    // Collect all texts from all requests in this batch
    const allTexts = [];
    const offsets = []; // [startIdx, endIdx] per request

    for (const req of requests) {
      const start = allTexts.length;
      allTexts.push(...req.texts);
      offsets.push([start, allTexts.length]);
    }

    // Deduplication: unique texts + index mapping
    const { uniqueTexts, indexMap } = this._deduplicate(allTexts);
    const savedCount = allTexts.length - uniqueTexts.length;
    this._stats.dedupSavings += savedCount;

    if (savedCount > 0) {
      this.emit('dedup', { original: allTexts.length, unique: uniqueTexts.length, saved: savedCount });
    }

    // Get model ID from first request (all in batch should use same model for efficiency)
    const modelId = requests[0].modelId;

    // Run inference with retry
    let results;
    try {
      results = await this._embedWithRetry(uniqueTexts, modelId, requests);
    } catch (err) {
      this._stats.errors++;
      for (const req of requests) {
        req.reject(err);
      }
      return;
    }

    // Re-expand results to original order (undo dedup)
    const expanded = indexMap.map((i) => results[i]);

    // Distribute results back to each request
    for (let r = 0; r < requests.length; r++) {
      const req = requests[r];
      const [start, end] = offsets[r];
      const reqResults = expanded.slice(start, end);
      req.resolve(reqResults);
    }
  }

  /**
   * Deduplicate texts for a batch, returning unique set and index mapping.
   */
  _deduplicate(texts) {
    const seen = new Map(); // text -> index in uniqueTexts
    const uniqueTexts = [];
    const indexMap = [];    // allTexts index -> uniqueTexts index

    for (const text of texts) {
      if (!seen.has(text)) {
        seen.set(text, uniqueTexts.length);
        uniqueTexts.push(text);
      }
      indexMap.push(seen.get(text));
    }

    return { uniqueTexts, indexMap };
  }

  /**
   * Call embedFn with PHI-scaled retry backoff.
   * Backoff sequence: 1000ms, 1618ms, 2618ms, 4236ms
   */
  async _embedWithRetry(texts, modelId, requestsForProgress) {
    let lastError;

    for (let attempt = 0; attempt < this._retryMaxAttempts; attempt++) {
      try {
        const results = await this._embedFn(texts, modelId, (processed, total) => {
          // Forward progress to all requests in this batch
          for (const req of requestsForProgress) {
            if (req.onProgress) req.onProgress(processed, total);
          }
        });
        return results;
      } catch (err) {
        lastError = err;
        this._stats.retries++;

        if (attempt < this._retryMaxAttempts - 1) {
          const delay = config.getRetryDelay(attempt);
          this.emit('retry', { attempt: attempt + 1, delay, error: err.message });
          await sleep(delay);
        }
      }
    }

    throw new Error(`Embedding failed after ${this._retryMaxAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Compute dynamic batch size based on current memory pressure.
   * Scales down from baseBatchSize when memory is tight.
   */
  _computeBatchSize() {
    try {
      const memUsage = process.memoryUsage();
      const usedMb = memUsage.heapUsed / (1024 * 1024);
      const ratio = usedMb / this._maxMemoryMb;

      if (ratio < 0.5) return this._baseBatchSize;           // Plenty of memory
      if (ratio < 0.7) return Math.ceil(this._baseBatchSize * 0.75);  // Slightly constrained
      if (ratio < 0.85) return Math.ceil(this._baseBatchSize * 0.5);  // Constrained
      return Math.max(1, Math.ceil(this._baseBatchSize * 0.25));      // Very tight
    } catch (_) {
      return this._baseBatchSize;
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { BatchProcessor, PriorityQueue, BatchRequest };
