/**
 * Load mTLS configuration from certificate files.
 * @param {Object} opts
 * @param {string} opts.certDir - Directory containing cert files
 * @param {string} opts.certFile - Server certificate file name
 * @param {string} opts.keyFile - Server private key file name
 * @param {string} opts.caFile - Certificate Authority file name
 * @returns {Object|null} TLS options or null if certs not found
 */
export function loadMTLSConfig(opts?: {
    certDir: string;
    certFile: string;
    keyFile: string;
    caFile: string;
}): Object | null;
/**
 * Create an HTTPS server with mTLS enforcement.
 * Falls back to the provided Express app on regular HTTP if no certs.
 */
export function createMTLSServer(app: any, opts?: {}): {
    server: null;
    mtlsEnabled: boolean;
    reason: string;
} | {
    server: https.Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    mtlsEnabled: boolean;
    reason?: undefined;
};
/**
 * Create an HTTPS agent for outbound mTLS requests.
 * Used by agents to communicate with other agents in the mesh.
 */
export function createMTLSAgent(opts?: {}): https.Agent | null;
/**
 * Express middleware to enforce mTLS on specific routes.
 */
export function enforceMTLS(requiredPaths?: any[]): (req: any, res: any, next: any) => any;
/**
 * Register mTLS status routes.
 */
export function registerMTLSRoutes(app: any, tlsConfig: any): void;
import https = require("https");
//# sourceMappingURL=mtls.d.ts.map