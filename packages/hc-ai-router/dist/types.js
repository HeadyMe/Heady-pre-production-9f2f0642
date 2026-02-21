"use strict";
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: types.ts                                    ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceExhaustedError = exports.OrsTooLowError = exports.ProviderUnavailableError = exports.RoutingError = void 0;
// Error types
class RoutingError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'RoutingError';
    }
}
exports.RoutingError = RoutingError;
class ProviderUnavailableError extends RoutingError {
    constructor(providerId, context) {
        super(`Provider ${providerId} is unavailable`, 'PROVIDER_UNAVAILABLE', context);
        this.name = 'ProviderUnavailableError';
    }
}
exports.ProviderUnavailableError = ProviderUnavailableError;
class OrsTooLowError extends RoutingError {
    constructor(ors, context) {
        super(`ORS too low for task: ${ors}`, 'ORS_TOO_LOW', context);
        this.name = 'OrsTooLowError';
    }
}
exports.OrsTooLowError = OrsTooLowError;
class ResourceExhaustedError extends RoutingError {
    constructor(resource, context) {
        super(`Resource exhausted: ${resource}`, 'RESOURCE_EXHAUSTED', context);
        this.name = 'ResourceExhaustedError';
    }
}
exports.ResourceExhaustedError = ResourceExhaustedError;
//# sourceMappingURL=types.js.map