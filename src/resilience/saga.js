'use strict';

/**
 * Saga / Workflow Compensation — Resilience Pattern
 * Manages distributed transactions with rollback capability.
 */

const logger = require('../utils/logger');

class Saga {
    constructor(name) {
        this.name = name;
        this.steps = [];
        this.completedSteps = [];
        this.status = 'pending';
    }

    /**
     * Add a saga step with execute and compensate functions.
     */
    step(name, execute, compensate) {
        this.steps.push({ name, execute, compensate });
        return this;
    }

    /**
     * Execute the saga. If any step fails, compensate all completed steps in reverse.
     */
    async run(context = {}) {
        this.status = 'running';
        this.completedSteps = [];

        for (const step of this.steps) {
            try {
                logger.logSystem(`  → [Saga:${this.name}] Executing: ${step.name}`);
                const result = await step.execute(context);
                context[step.name] = result;
                this.completedSteps.push(step);
            } catch (err) {
                logger.warn(`  ✗ [Saga:${this.name}] Failed at: ${step.name} — ${err.message}`);
                this.status = 'compensating';

                // Compensate in reverse order
                for (let i = this.completedSteps.length - 1; i >= 0; i--) {
                    const comp = this.completedSteps[i];
                    try {
                        logger.logSystem(`  ← [Saga:${this.name}] Compensating: ${comp.name}`);
                        await comp.compensate(context);
                    } catch (compErr) {
                        logger.warn(`  ⚠ [Saga:${this.name}] Compensation failed for ${comp.name}: ${compErr.message}`);
                    }
                }

                this.status = 'failed';
                throw new Error(`Saga [${this.name}] failed at step [${step.name}]: ${err.message}`);
            }
        }

        this.status = 'completed';
        logger.logSystem(`  ✓ [Saga:${this.name}] Completed (${this.completedSteps.length} steps)`);
        return context;
    }

    getStatus() {
        return {
            name: this.name, status: this.status,
            totalSteps: this.steps.length,
            completedSteps: this.completedSteps.map(s => s.name),
        };
    }
}

function createSaga(name) {
    return new Saga(name);
}

module.exports = { Saga, createSaga };
