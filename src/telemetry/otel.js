/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * OpenTelemetry (OTel) Core Instrumentation
 *
 * Provides distributed tracing, metrics, and context propagation
 * across the Heady multi-agent swarm and MCP boundaries.
 */

'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace, context, propagation } = require('@opentelemetry/api');
const { W3CTraceContextPropagator } = require('@opentelemetry/core');

// Configure global propagator
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

class TelemetryEngine {
    constructor(serviceName = 'heady-swarm-orchestrator') {
        this.serviceName = serviceName;
        this.provider = new NodeTracerProvider({
            resource: new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
                [SemanticResourceAttributes.SERVICE_VERSION]: '3.0.0',
            }),
        });

        // Use OTLP Exporter (can wire to Admin Citadel later or external collector)
        this.exporter = new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        });

        this.provider.addSpanProcessor(new SimpleSpanProcessor(this.exporter));
        this.provider.register();

        this.tracer = trace.getTracer(serviceName);
    }

    /**
     * Start an active span and execute a closure.
     */
    async withSpan(name, attributes, fn) {
        return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
            try {
                const result = await fn(span);
                span.setStatus({ code: 1 }); // OK
                return result;
            } catch (error) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message,
                });
                span.recordException(error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Start a detached span (useful when returning it to another controller).
     */
    startSpan(name, attributes = {}) {
        return this.tracer.startSpan(name, { attributes });
    }

    /**
     * Extract trace context from incoming headers (e.g., from an MCP server or frontend).
     */
    extractContext(headers) {
        return propagation.extract(context.active(), headers);
    }

    /**
     * Inject current trace context into outgoing headers.
     */
    injectContext(headers = {}) {
        propagation.inject(context.active(), headers);
        return headers;
    }

    /**
     * Shutdown the provider gracefully.
     */
    async shutdown() {
        return this.provider.shutdown();
    }
}

// Singleton instance
const telemetry = new TelemetryEngine();

module.exports = {
    telemetry,
    TelemetryEngine,
    trace,
    context
};
