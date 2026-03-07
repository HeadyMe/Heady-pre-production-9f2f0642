/**
 * Creates and returns the onboarding Express Router.
 *
 * @param {object} deps
 * @param {import('./onboarding-controller.js').OnboardingController} deps.controller
 * @param {UIProjectionEngine} deps.projectionEngine
 * @param {object} [deps.logger] - Pino / console compatible logger
 * @returns {import('express').Router}
 */
export function createOnboardingRouter({ controller, projectionEngine, logger }: {
    controller: import("./onboarding-controller.js").OnboardingController;
    projectionEngine: UIProjectionEngine;
    logger?: object | undefined;
}): any;
import { UIProjectionEngine } from './ui-projection-engine.js';
//# sourceMappingURL=onboarding-routes.d.ts.map