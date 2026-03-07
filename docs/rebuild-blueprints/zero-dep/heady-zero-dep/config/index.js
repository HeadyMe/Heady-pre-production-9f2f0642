/**
 * @file index.js
 * @description Config layer barrel export.
 * @module HeadyConfig
 */

export * from './global.js';
export * from './env-schema.js';

export { default as globalConfig } from './global.js';
export { default as envSchema }    from './env-schema.js';
