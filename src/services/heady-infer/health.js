'use strict';

/**
 * HeadyInfer Health — Aggregated health check module.
 *
 * Provides a quick synchronous liveness check and an async readiness check
 * that pings all providers.
 */

const config = require('./config');

/**
 * Lightweight liveness check — no async I/O.
 * Returns immediately with service metadata.
 *
 * @param {HeadyInfer} gateway  HeadyInfer instance
 * @returns {object}
 */
function liveness(gateway) {
  const enabledProviders = Object.keys(gateway?._providers || {});
  return {
    status:  'ok',
    service: config.serviceName,
    version: config.version,
    env:     config.env,
    uptime:  Math.floor(process.uptime()),
    memory:  process.memoryUsage(),
    providers: {
      enabled: enabledProviders,
      count:   enabledProviders.length,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Full readiness check — pings each enabled provider.
 *
 * @param {HeadyInfer} gateway
 * @returns {Promise<HealthReport>}
 */
async function readiness(gateway) {
  if (!gateway) {
    return {
      status: 'unhealthy',
      reason: 'Gateway not initialized',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const report = await gateway.health();
    return {
      ...report,
      service: config.serviceName,
      version: config.version,
    };
  } catch (err) {
    return {
      status:    'unhealthy',
      error:     err.message,
      service:   config.serviceName,
      version:   config.version,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Build a simple HTTP health response object.
 *
 * @param {object}  report     health report object
 * @param {boolean} detailed   include full report or just status/service
 * @returns {{ statusCode: number, body: object }}
 */
function buildHttpResponse(report, detailed = false) {
  const healthy   = report.status === 'healthy' || report.status === 'ok';
  const degraded  = report.status === 'degraded';
  const statusCode = healthy ? 200 : (degraded ? 200 : 503);

  if (!detailed) {
    return {
      statusCode,
      body: {
        status:    report.status,
        service:   report.service || config.serviceName,
        version:   report.version || config.version,
        timestamp: report.timestamp,
      },
    };
  }

  return { statusCode, body: report };
}

module.exports = { liveness, readiness, buildHttpResponse };
