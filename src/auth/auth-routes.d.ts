/**
 * Create and return the complete auth router.
 *
 * @param {object}  services
 * @param {object}  services.authProvider    - AuthProvider instance
 * @param {object}  services.accountProvisioner - AccountProvisioner instance
 * @param {object}  services.permissionManager  - PermissionManager instance
 * @param {object}  services.emailClient        - SecureEmailClient instance
 * @param {object}  services.config             - Platform config
 * @returns {Router} Express router
 */
export function createAuthRouter({ authProvider, accountProvisioner, permissionManager, emailClient, config, }: {
    authProvider: object;
    accountProvisioner: object;
    permissionManager: object;
    emailClient: object;
    config: object;
}): Router;
/**
 * Create a standalone authentication middleware for use outside auth routes.
 * Verifies Bearer JWT or API key and sets req.user.
 *
 * @param {object} authProvider - AuthProvider instance
 * @param {object} accountProvisioner - AccountProvisioner instance
 * @returns {Function} Express middleware
 */
export function createAuthMiddleware(authProvider: object, accountProvisioner: object): Function;
export default createAuthRouter;
//# sourceMappingURL=auth-routes.d.ts.map