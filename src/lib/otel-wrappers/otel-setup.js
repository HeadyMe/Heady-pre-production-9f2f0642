/**
 * OTel Bootstrap — OpenTelemetry SDK Setup for Heady Systems
 * Configures tracing, metrics, propagation, and auto-instrumentation.
 * Must be required FIRST before any other module (node -r ./otel-wrappers/otel-setup.js app.js)
 * @module otel-wrappers/otel-setup
 */
'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} = require('@opentelemetry/semantic-conventions');
const {
  W3CTraceContextPropagator,
} = require('@opentelemetry/core');
const { B3Propagator } = require('@opentelemetry/propagator-b3');
const { CompositePropagator, W3CBaggagePropagator } = require('@opentelemetry/core');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
const { propagation, context, trace } = require('@opentelemetry/api');

// ─── Configuration ────────────────────────────────────────────────────────────
const SERVICE_NAME    = process.env.OTEL_SERVICE_NAME    || process.env.HEADY_SERVICE_NAME || 'heady-manager';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '3.1.0';
const DEPLOY_ENV      = process.env.OTEL_DEPLOYMENT_ENV  || process.env.NODE_ENV           || 'development';
const OTLP_ENDPOINT   = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const BATCH_SIZE      = parseInt(process.env.OTEL_BATCH_SIZE || '512', 10);
const BATCH_TIMEOUT   = parseInt(process.env.OTEL_BATCH_TIMEOUT_MS || '5000', 10);
const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9464', 10);
const METRICS_INTERVAL_MS = parseInt(process.env.OTEL_METRICS_INTERVAL_MS || '30000', 10);

// ─── Resource ─────────────────────────────────────────────────────────────────
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]:           SERVICE_NAME,
  [SEMRESATTRS_SERVICE_VERSION]:        SERVICE_VERSION,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: DEPLOY_ENV,
  'heady.platform':                     'heady-latent-os',
  'heady.mono_version':                 '9f2f0642',
});

// ─── OTLP Trace Exporter (gRPC) ───────────────────────────────────────────────
const traceExporter = new OTLPTraceExporter({
  url: OTLP_ENDPOINT,
  timeoutMillis: 10000,
});

// ─── Span Processor ───────────────────────────────────────────────────────────
const batchSpanProcessor = new BatchSpanProcessor(traceExporter, {
  maxExportBatchSize:  BATCH_SIZE,
  scheduledDelayMillis: BATCH_TIMEOUT,
  exportTimeoutMillis: 10000,
  maxQueueSize:        Math.max(BATCH_SIZE * 4, 2048),
});

// ─── Metrics: Prometheus (pull) + OTLP (push) ─────────────────────────────────
const prometheusExporter = new PrometheusExporter(
  { port: PROMETHEUS_PORT, startServer: true },
  () => console.log(`[otel-setup] Prometheus metrics at http://localhost:${PROMETHEUS_PORT}/metrics`)
);

const otlpMetricExporter = new OTLPMetricExporter({ url: OTLP_ENDPOINT });

const metricReader = new PeriodicExportingMetricReader({
  exporter:         otlpMetricExporter,
  exportIntervalMillis: METRICS_INTERVAL_MS,
  exportTimeoutMillis:  8000,
});

// ─── Propagators: W3C TraceContext + Baggage ──────────────────────────────────
const compositePropagator = new CompositePropagator({
  propagators: [
    new W3CTraceContextPropagator(),
    new W3CBaggagePropagator(),
    new B3Propagator(),
  ],
});

// ─── Auto-instrumentation ─────────────────────────────────────────────────────
const instrumentations = [
  new HttpInstrumentation({
    requestHook: (span, req) => {
      span.setAttribute('http.request.body.size', req.headers?.['content-length'] || 0);
    },
    responseHook: (span, res) => {
      span.setAttribute('http.response.body.size', res.headers?.['content-length'] || 0);
    },
    ignoreIncomingRequestHook: (req) => {
      // Skip health-check paths from trace noise
      return /\/(health|readyz|livez|metrics)(\/|$)/.test(req.url || '');
    },
  }),
  new ExpressInstrumentation({
    requestHook: (span, info) => {
      span.setAttribute('express.route', info.route || 'unknown');
    },
  }),
  new PgInstrumentation({ enhancedDatabaseReporting: true }),
  new RedisInstrumentation(),
];

// ─── SDK Init ─────────────────────────────────────────────────────────────────
const sdk = new NodeSDK({
  resource,
  spanProcessor:   batchSpanProcessor,
  metricReader:    prometheusExporter,   // Primary: Prometheus pull
  instrumentations,
  textMapPropagator: compositePropagator,
});

// Register the composite propagator globally so custom wrappers can use it
propagation.setGlobalPropagator ? void 0 : void 0; // SDK handles this

let _started = false;

function start() {
  if (_started) return;
  _started = true;
  try {
    sdk.start();
    console.log(`[otel-setup] SDK started — service="${SERVICE_NAME}" env="${DEPLOY_ENV}" otlp="${OTLP_ENDPOINT}"`);
  } catch (err) {
    console.error('[otel-setup] SDK start failed (telemetry disabled):', err.message);
  }
}

async function shutdown() {
  if (!_started) return;
  try {
    await sdk.shutdown();
    console.log('[otel-setup] SDK shutdown complete');
  } catch (err) {
    console.error('[otel-setup] SDK shutdown error:', err.message);
  }
}

// Auto-start unless OTEL_SDK_DISABLED=true
if (process.env.OTEL_SDK_DISABLED !== 'true') {
  start();
  process.on('SIGTERM', () => shutdown().then(() => process.exit(0)));
  process.on('SIGINT',  () => shutdown().then(() => process.exit(0)));
}

module.exports = { sdk, start, shutdown, resource, compositePropagator };
