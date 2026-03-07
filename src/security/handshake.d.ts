export let _tokenCache: Map<any, any>;
export let _secret: string;
export let _pqcEnabled: boolean;
/**
 * Generate a signed token for an internal node
 * @param {string} nodeId - e.g. 'HEADY_CLAUDE'
 * @returns {string} - Signed token
 */
export function generateToken(nodeId: string): string;
/**
 * Validate an incoming handshake token
 * @param {string} token - Base64 token
 * @returns {Object} - { valid: boolean, nodeId: string, age: number }
 */
export function validateToken(token: string): Object;
/**
 * Middleware for Express to enforce internal handshake
 */
export function middleware(req: any, res: any, next: any): any;
//# sourceMappingURL=handshake.d.ts.map