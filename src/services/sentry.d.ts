/**
 * Capture an exception and send to Sentry.
 */
export function captureException(err: any, extra?: {}): string;
/**
 * Capture a plain message.
 */
export function captureMessage(message: any, level?: string, extra?: {}): string;
/**
 * Express error-handling middleware.
 * Use: app.use(sentry.errorHandler())
 */
export function errorHandler(): (err: any, req: any, res: any, next: any) => void;
/**
 * Express request handler middleware (adds Sentry context to req).
 * Use: app.use(sentry.requestHandler())
 */
export function requestHandler(): (req: any, _res: any, next: any) => void;
export function sentryRoutes(app: any): void;
export function getStats(): {
    queueLength: number;
    sent: number;
    errors: number;
    dropped: number;
    enabled: boolean;
    dsn: string | null;
    org: string;
    project: string;
};
export const isEnabled: boolean;
export const DSN: string;
//# sourceMappingURL=sentry.d.ts.map