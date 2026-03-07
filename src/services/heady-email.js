/**
 * Heady Email Service
 * IMAP/SMTP email fetching and sending for HeadyBuddy and other services
 * © 2026 HeadySystems Inc.
 */

'use strict';

const logger = require('../utils/logger');

let nodemailer = null;
let imaps = null;

try { nodemailer = require('nodemailer'); } catch (_e) {}
try { imaps = require('imap-simple'); } catch (_e) {}

// ── Configuration ──────────────────────────────────────────────

function getImapConfig() {
    return {
        imap: {
            user: process.env.EMAIL_USER || process.env.IMAP_USER || '',
            password: process.env.EMAIL_PASSWORD || process.env.IMAP_PASSWORD || '',
            host: process.env.IMAP_HOST || 'imap.gmail.com',
            port: parseInt(process.env.IMAP_PORT || '993', 10),
            tls: true,
            authTimeout: 10000,
        },
    };
}

function getSmtpConfig() {
    return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
            user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
            pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD || '',
        },
    };
}

// ── Fetch Recent Emails ────────────────────────────────────────

/**
 * Fetch recent emails from IMAP inbox.
 * @param {number} limit - Number of emails to fetch (default 10)
 * @param {string} folder - Folder/mailbox name (default 'INBOX')
 * @returns {Promise<{ok: boolean, emails: Array, count: number}>}
 */
async function fetchRecent(limit = 10, folder = 'INBOX') {
    if (!imaps) {
        logger.warn('[heady-email] imap-simple not installed — email fetch unavailable');
        return { ok: false, error: 'imap-simple not installed', emails: [], count: 0 };
    }

    const config = getImapConfig();
    if (!config.imap.user || !config.imap.password) {
        logger.warn('[heady-email] IMAP credentials not configured');
        return { ok: false, error: 'IMAP credentials not configured', emails: [], count: 0 };
    }

    try {
        const connection = await imaps.connect(config);
        await connection.openBox(folder);

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true,
            markSeen: false,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        const emails = messages.slice(0, limit).map((msg) => {
            const header = msg.parts.find((p) => p.which.startsWith('HEADER'));
            const body = msg.parts.find((p) => p.which === 'TEXT');
            return {
                uid: msg.attributes.uid,
                date: msg.attributes.date,
                from: header?.body?.from?.[0] || '',
                to: header?.body?.to?.[0] || '',
                subject: header?.body?.subject?.[0] || '(no subject)',
                snippet: (body?.body || '').substring(0, 200),
                flags: msg.attributes.flags || [],
            };
        });

        connection.end();

        return { ok: true, emails, count: emails.length, folder };
    } catch (err) {
        logger.error('[heady-email] IMAP fetch error', { error: err.message });
        return { ok: false, error: err.message, emails: [], count: 0 };
    }
}

// ── Send Email ─────────────────────────────────────────────────

/**
 * Send an email via SMTP.
 * @param {object} opts - { to, subject, text, html }
 * @returns {Promise<{ok: boolean, messageId?: string}>}
 */
async function sendEmail({ to, subject, text, html }) {
    if (!nodemailer) {
        logger.warn('[heady-email] nodemailer not installed — email send unavailable');
        return { ok: false, error: 'nodemailer not installed' };
    }

    const smtpConfig = getSmtpConfig();
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
        logger.warn('[heady-email] SMTP credentials not configured');
        return { ok: false, error: 'SMTP credentials not configured' };
    }

    try {
        const transporter = nodemailer.createTransporter(smtpConfig);
        const info = await transporter.sendMail({
            from: smtpConfig.auth.user,
            to,
            subject,
            text,
            html,
        });

        logger.info('[heady-email] Email sent', { messageId: info.messageId, to });
        return { ok: true, messageId: info.messageId };
    } catch (err) {
        logger.error('[heady-email] SMTP send error', { error: err.message });
        return { ok: false, error: err.message };
    }
}

// ── Health Check ──────────────────────────────────────────────

function getStatus() {
    return {
        service: 'heady-email',
        imapAvailable: !!imaps,
        smtpAvailable: !!nodemailer,
        configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
    };
}

module.exports = { fetchRecent, sendEmail, getStatus };
