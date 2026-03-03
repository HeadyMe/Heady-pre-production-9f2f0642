const logger = require('../utils/logger');

function sanitizeText(value) {
    return String(value || '').replace(/[<>]/g, '').trim();
}

function buildUserWorkspaceId({ userId, deviceId, site }) {
    const safeUser = sanitizeText(userId || 'anonymous').slice(0, 64);
    const safeDevice = sanitizeText(deviceId || 'unknown-device').slice(0, 64);
    const safeSite = sanitizeText(site || 'heady').slice(0, 64);
    return `vw:${safeSite}:${safeUser}:${safeDevice}`;
}

function buildChatRequest({
    message,
    userId,
    token,
    deviceId,
    site,
    history = [],
    context = {},
}) {
    const cleanMessage = sanitizeText(message);
    const workspaceId = buildUserWorkspaceId({ userId, deviceId, site });

    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(deviceId ? { 'X-Heady-Device': deviceId } : {}),
            'X-Heady-Workspace': workspaceId,
        },
        body: {
            message: cleanMessage,
            history: history.slice(-8),
            context: {
                ...context,
                site,
                workspaceId,
                userId: userId || 'anonymous',
                channel: 'buddy-chat',
                vector3d: true,
            },
        },
        workspaceId,
    };
}

function parseBuddyResponse(payload) {
    const text = payload?.response || payload?.reply || payload?.message || payload?.text || '';
    const done = Boolean(payload?.confirmed === true
        || payload?.done === true
        || payload?.status === 'done'
        || payload?.status === 'completed'
        || payload?.confirmation?.done === true);

    return {
        text: sanitizeText(text),
        confirmed: done,
        status: payload?.status || (done ? 'completed' : 'in_progress'),
    };
}

function assertConfirmedCompletion(parsed, mode = 'warn') {
    const ok = parsed?.confirmed === true;
    if (!ok) {
        const message = `[BuddyContract] Completion not confirmed (status=${parsed?.status || 'unknown'})`;
        if (mode === 'throw') {
            throw new Error(message);
        }
        logger.logSystem(message);
    }
    return ok;
}

module.exports = {
    sanitizeText,
    buildUserWorkspaceId,
    buildChatRequest,
    parseBuddyResponse,
    assertConfirmedCompletion,
};
