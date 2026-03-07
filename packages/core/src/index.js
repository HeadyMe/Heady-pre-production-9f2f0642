"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadyError = exports.HEADY_VERSION = void 0;
exports.validateUserId = validateUserId;
exports.HEADY_VERSION = '3.2.0';
class HeadyError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'HeadyError';
    }
}
exports.HeadyError = HeadyError;
function validateUserId(userId) {
    return userId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(userId);
}
//# sourceMappingURL=index.js.map