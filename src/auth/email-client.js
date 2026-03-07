/**
 * @fileoverview HeadySecureEmailClient — Secure email client for {username}@headyme.com
 * accounts on the Heady sovereign AI platform.
 *
 * Features:
 * - IMAP/SMTP client for Heady email accounts
 * - Cloudflare Email Routing integration for receiving
 * - SMTP sending via Mailgun, SES, or self-hosted
 * - Email encryption at rest (AES-256-GCM)
 * - S/MIME certificate provisioning
 * - Webmail API (list, read, send, reply, forward, delete, search)
 * - Push notifications via WebSocket
 * - Spam filtering integration
 * - Attachment handling with virus scanning reference
 *
 * @module auth/email-client
 */

import crypto from 'crypto';
import { createTransport } from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { HeadyError } from './auth-provider.js';

// ─── Email Error ──────────────────────────────────────────────────────────────

export class EmailError extends HeadyError {
  constructor(message, code = 'EMAIL_ERROR', status = 500, meta = {}) {
    super(message, code, status, meta);
    this.name = 'EmailError';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum attachment size in bytes (25 MB) */
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Maximum emails per page for inbox listing */
const INBOX_PAGE_SIZE = 50;

/** Supported SMTP providers */
const SMTP_PROVIDERS = ['mailgun', 'ses', 'smtp', 'mailcow'];

/** Mime types considered "safe" for display without sandbox */
const SAFE_MIME_TYPES = new Set([
  'text/plain', 'text/html', 'image/png', 'image/jpeg',
  'image/gif', 'image/webp', 'application/pdf',
]);

// ─── SecureEmailClient Class ──────────────────────────────────────────────────

/**
 * SecureEmailClient provides a secure, encrypted email system for
 * {username}@headyme.com accounts. Supports both full mailbox (Mailcow)
 * and forwarding (Cloudflare Email Routing) configurations.
 *
 * Usage:
 * ```js
 * const client = new SecureEmailClient({ db, redis, wsServer, config });
 * await client.initialize();
 *
 * // Send an email
 * await client.send({ from: 'user@headyme.com', to: 'friend@example.com', subject: 'Hello', text: 'Hi!' });
 *
 * // Get inbox
 * const inbox = await client.getInbox(userId, { page: 1, folder: 'INBOX' });
 * ```
 */
export class SecureEmailClient {
  /**
   * @param {object}  opts
   * @param {object}  opts.db       - PostgreSQL client (pg.Pool)
   * @param {object}  opts.redis    - Redis client (ioredis)
   * @param {object}  [opts.wsServer] - WebSocket.Server for push notifications
   * @param {object}  opts.config   - Platform configuration
   */
  constructor({ db, redis, wsServer, config }) {
    this.db = db;
    this.redis = redis;
    this.wsServer = wsServer;
    this.config = config;

    /** @type {object} Nodemailer SMTP transport */
    this._transport = null;

    /** @type {Map<string, ImapFlow>} Per-user IMAP connection pool */
    this._imapPool = new Map();

    /** Encryption key (32 bytes) for email at-rest encryption */
    this._encKey = Buffer.from(
      config.email?.encryptionKey || crypto.randomBytes(32).toString('hex'),
      'hex'
    ).slice(0, 32);
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the email client. Creates SMTP transport.
   * Must be called once before use.
   */
  async initialize() {
    await this._createSmtpTransport();
  }

  /** @private */
  async _createSmtpTransport() {
    const provider = this.config.email?.smtpProvider;

    if (provider === 'mailgun') {
      this._transport = createTransport({
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: this.config.email.mailgun.smtp_login,
          pass: this.config.email.mailgun.smtp_password,
        },
      });
    } else if (provider === 'ses') {
      this._transport = createTransport({
        host: `email-smtp.${this.config.email.ses.region || 'us-east-1'}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: this.config.email.ses.accessKeyId,
          pass: this.config.email.ses.secretAccessKey,
        },
      });
    } else if (provider === 'smtp' || provider === 'mailcow') {
      this._transport = createTransport({
        host: this.config.email.smtp?.host || 'mail.headyme.com',
        port: this.config.email.smtp?.port || 587,
        secure: this.config.email.smtp?.secure ?? false,
        auth: {
          user: this.config.email.smtp?.user,
          pass: this.config.email.smtp?.pass,
        },
        tls: { rejectUnauthorized: true },
      });
    } else {
      // Development / test mode — use ethereal
      console.warn('[HeadyEmail] No SMTP provider configured. Using test transport.');
      this._transport = createTransport({ jsonTransport: true });
    }
  }

  // ── Send Email ─────────────────────────────────────────────────────────────

  /**
   * Send an email from a {username}@headyme.com account.
   *
   * @param {object}   opts
   * @param {string}   opts.from         - Sender address (must be @headyme.com)
   * @param {string|string[]} opts.to    - Recipient(s)
   * @param {string}   [opts.cc]         - CC recipients
   * @param {string}   [opts.bcc]        - BCC recipients
   * @param {string}   opts.subject      - Email subject
   * @param {string}   [opts.text]       - Plaintext body
   * @param {string}   [opts.html]       - HTML body
   * @param {object[]} [opts.attachments] - Attachments array
   * @param {string}   [opts.inReplyTo]  - Message-ID being replied to
   * @param {string}   [opts.references] - Reference chain
   * @param {string}   opts.userId       - Sender user UUID (for storage)
   * @returns {Promise<{messageId: string, accepted: string[]}>}
   */
  async send({ from, to, cc, bcc, subject, text, html, attachments = [], inReplyTo, references, userId }) {
    // Validate sender
    if (!from?.endsWith('@headyme.com')) {
      throw new EmailError(
        'Sender must be a @headyme.com address.',
        'EMAIL_INVALID_SENDER',
        400
      );
    }

    // Validate recipients
    const recipients = [
      ...(Array.isArray(to) ? to : [to]),
      ...(cc ? (Array.isArray(cc) ? cc : [cc]) : []),
    ].filter(Boolean);

    if (recipients.length === 0) {
      throw new EmailError('At least one recipient is required.', 'EMAIL_NO_RECIPIENTS', 400);
    }

    for (const addr of recipients) {
      if (!this._isValidEmail(addr)) {
        throw new EmailError(`Invalid recipient address: ${addr}`, 'EMAIL_INVALID_RECIPIENT', 400);
      }
    }

    // Validate and sanitize attachments
    const sanitizedAttachments = await this._processAttachments(attachments);

    // Build message
    const messageId = `<${crypto.randomUUID()}@headyme.com>`;
    const mailOptions = {
      from: `Heady User <${from}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      cc,
      bcc,
      subject,
      text: text || this._htmlToText(html),
      html,
      attachments: sanitizedAttachments,
      messageId,
      ...(inReplyTo && { inReplyTo }),
      ...(references && { references }),
      headers: {
        'X-Heady-Version': '1.0',
        'X-Mailer': 'Heady Secure Email',
      },
    };

    const info = await this._transport.sendMail(mailOptions);

    // Store sent email (encrypted)
    await this._storeSentEmail(userId, {
      messageId,
      from,
      to: Array.isArray(to) ? to : [to],
      cc: cc ? [cc] : [],
      subject,
      text: text || '',
      html: html || '',
      sentAt: new Date().toISOString(),
    });

    // Notify via WebSocket
    this._emitEmailEvent(userId, 'sent', { messageId, subject, to });

    return { messageId, accepted: info.accepted || [to] };
  }

  /**
   * Send a transactional/system email (welcome, verification, etc.).
   * Uses a system SMTP address, not a user address.
   *
   * @param {object}  opts
   * @param {string}  opts.to          - Recipient address
   * @param {string}  opts.subject     - Subject
   * @param {string}  opts.templateId  - Template identifier
   * @param {object}  opts.variables   - Template variables
   * @returns {Promise<object>}
   */
  async sendTransactional({ to, subject, templateId, variables = {} }) {
    const { html, text } = await this._renderTemplate(templateId, variables);

    const mailOptions = {
      from: `Heady <${this.config.email?.fromAddress || 'hello@headyme.com'}>`,
      to,
      subject,
      html,
      text,
      headers: { 'X-Heady-Transactional': templateId },
    };

    return this._transport.sendMail(mailOptions);
  }

  // ── Inbox / IMAP ──────────────────────────────────────────────────────────

  /**
   * List emails in a user's mailbox folder.
   *
   * @param {string}  userId    - User UUID
   * @param {object}  [opts]
   * @param {number}  [opts.page=1]       - Page number (1-based)
   * @param {string}  [opts.folder='INBOX'] - IMAP folder
   * @param {boolean} [opts.unreadOnly=false] - Filter to unread
   * @returns {Promise<{emails: object[], total: number, page: number, hasMore: boolean}>}
   */
  async getInbox(userId, { page = 1, folder = 'INBOX', unreadOnly = false } = {}) {
    const emailAccount = await this._getEmailAccount(userId);

    if (emailAccount.provider === 'cloudflare') {
      // Cloudflare only routes — fetch from PostgreSQL storage
      return this._getStoredEmails(userId, { page, folder, unreadOnly });
    }

    // Full IMAP mailbox (Mailcow)
    const client = await this._getImapClient(userId, emailAccount);
    try {
      await client.mailboxOpen(folder);

      const searchCriteria = unreadOnly ? ['UNSEEN'] : ['ALL'];
      const uids = await client.search(searchCriteria, { uid: true });

      const total = uids.length;
      const start = (page - 1) * INBOX_PAGE_SIZE;
      const pageUids = uids.slice(-start - INBOX_PAGE_SIZE, uids.length - start).reverse();

      const emails = [];
      for await (const message of client.fetch(pageUids.join(','), {
        uid: true,
        flags: true,
        bodyStructure: true,
        envelope: true,
        internalDate: true,
      }, { uid: true })) {
        emails.push(this._formatEnvelope(message));
      }

      return { emails, total, page, hasMore: total > page * INBOX_PAGE_SIZE };
    } finally {
      // Return client to pool (don't destroy)
    }
  }

  /**
   * Read a specific email by its UID.
   *
   * @param {string} userId   - User UUID
   * @param {string} uid      - IMAP UID or database ID
   * @param {string} [folder='INBOX'] - IMAP folder
   * @returns {Promise<object>} Full email with parsed body
   */
  async readEmail(userId, uid, folder = 'INBOX') {
    const emailAccount = await this._getEmailAccount(userId);

    if (emailAccount.provider === 'cloudflare' || emailAccount.provider === 'none') {
      return this._getStoredEmailById(userId, uid);
    }

    const client = await this._getImapClient(userId, emailAccount);
    await client.mailboxOpen(folder);

    const messages = [];
    for await (const message of client.fetch(uid, {
      uid: true,
      flags: true,
      source: true,
    }, { uid: true })) {
      messages.push(message);
    }

    if (messages.length === 0) {
      throw new EmailError('Email not found.', 'EMAIL_NOT_FOUND', 404);
    }

    const parsed = await simpleParser(messages[0].source);

    // Mark as seen
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

    // Decrypt body if stored encrypted
    const emailData = {
      uid,
      messageId: parsed.messageId,
      from: parsed.from?.value?.[0],
      to: parsed.to?.value,
      cc: parsed.cc?.value,
      subject: parsed.subject,
      date: parsed.date,
      text: parsed.text,
      html: parsed.html,
      attachments: (parsed.attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        contentId: a.contentId,
        // Do not return raw content unless explicitly requested (streaming)
      })),
      flags: messages[0].flags,
    };

    return emailData;
  }

  /**
   * Delete (move to Trash or permanently delete) an email.
   * @param {string}  userId   - User UUID
   * @param {string}  uid      - Message UID
   * @param {string}  [folder='INBOX']
   * @param {boolean} [permanent=false] - Permanently delete vs move to Trash
   */
  async deleteEmail(userId, uid, folder = 'INBOX', permanent = false) {
    const emailAccount = await this._getEmailAccount(userId);

    if (emailAccount.provider === 'cloudflare') {
      await this.db.query(
        'UPDATE stored_emails SET deleted = TRUE, deleted_at = NOW() WHERE user_id = $1 AND id = $2',
        [userId, uid]
      );
      return { success: true };
    }

    const client = await this._getImapClient(userId, emailAccount);
    await client.mailboxOpen(folder);

    if (permanent) {
      await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
      await client.mailboxClose(); // EXPUNGE on close
    } else {
      await client.messageMove(uid, 'Trash', { uid: true });
    }

    return { success: true };
  }

  /**
   * Search emails across folders.
   * @param {string}  userId  - User UUID
   * @param {object}  query
   * @param {string}  [query.text]   - Full-text search
   * @param {string}  [query.from]   - Sender filter
   * @param {string}  [query.subject] - Subject filter
   * @param {Date}    [query.since]  - Date range start
   * @param {Date}    [query.before] - Date range end
   * @param {boolean} [query.unread] - Unread only
   * @param {string}  [query.folder='INBOX']
   * @returns {Promise<object[]>}
   */
  async searchEmails(userId, { text, from, subject, since, before, unread, folder = 'INBOX' } = {}) {
    const emailAccount = await this._getEmailAccount(userId);

    if (emailAccount.provider === 'cloudflare') {
      return this._searchStoredEmails(userId, { text, from, subject, since, before, unread });
    }

    const client = await this._getImapClient(userId, emailAccount);
    await client.mailboxOpen(folder);

    const criteria = [];
    if (text) criteria.push({ text });
    if (from) criteria.push({ from });
    if (subject) criteria.push({ subject });
    if (since) criteria.push({ since: new Date(since) });
    if (before) criteria.push({ before: new Date(before) });
    if (unread) criteria.push('UNSEEN');

    if (criteria.length === 0) criteria.push('ALL');

    const uids = await client.search(criteria.length === 1 ? criteria[0] : criteria, { uid: true });

    // Fetch envelopes for search results (limit 100)
    const limited = uids.slice(-100);
    const results = [];

    for await (const message of client.fetch(limited.join(','), {
      uid: true, envelope: true, flags: true, internalDate: true,
    }, { uid: true })) {
      results.push(this._formatEnvelope(message));
    }

    return results;
  }

  /**
   * Forward an email to new recipients.
   * @param {string}   userId       - User UUID
   * @param {string}   uid          - Message UID to forward
   * @param {string[]} to           - New recipients
   * @param {string}   fromAddress  - @headyme.com sender address
   * @param {string}   [comment]    - Optional forwarding comment
   */
  async forwardEmail(userId, uid, to, fromAddress, comment = '') {
    const original = await this.readEmail(userId, uid);

    const subject = original.subject?.startsWith('Fwd: ')
      ? original.subject
      : `Fwd: ${original.subject}`;

    const forwardHeader = [
      '---------- Forwarded message ----------',
      `From: ${original.from?.address}`,
      `Date: ${original.date}`,
      `Subject: ${original.subject}`,
      `To: ${original.to?.map((t) => t.address).join(', ')}`,
      '',
    ].join('\n');

    return this.send({
      userId,
      from: fromAddress,
      to,
      subject,
      text: comment ? `${comment}\n\n${forwardHeader}\n${original.text}` : `${forwardHeader}\n${original.text}`,
      html: original.html,
      references: original.messageId,
    });
  }

  // ── Encryption at Rest ─────────────────────────────────────────────────────

  /**
   * Encrypt email content for database storage using AES-256-GCM.
   * @param {string} content - Plaintext email content
   * @returns {string} Base64-encoded encrypted content (iv:tag:ciphertext)
   */
  encryptEmailContent(content) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this._encKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(content, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  /**
   * Decrypt email content from database storage.
   * @param {string} encryptedBase64 - Base64 encrypted content
   * @returns {string} Plaintext content
   */
  decryptEmailContent(encryptedBase64) {
    const data = Buffer.from(encryptedBase64, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this._encKey, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  // ── S/MIME Certificate Provisioning ───────────────────────────────────────

  /**
   * Provision a self-signed S/MIME certificate for a user's @headyme.com address.
   * In production, integrate with a CA (e.g., Let's Encrypt S/MIME, Actalis).
   *
   * @param {string} userId     - User UUID
   * @param {string} headyEmail - The @headyme.com email address
   * @returns {Promise<{certificate: string, privateKey: string, fingerprint: string}>}
   */
  async provisionSmimeCertificate(userId, headyEmail) {
    // In production: call out to CA API (e.g., Actalis Free S/MIME)
    // Here we generate a self-signed cert for development
    const { privateKey, certificate } = await this._generateSelfSignedSmimeCert(headyEmail);

    const fingerprint = crypto
      .createHash('sha256')
      .update(certificate)
      .digest('hex')
      .match(/.{2}/g)
      .join(':')
      .toUpperCase();

    // Store encrypted private key
    const encryptedKey = this.encryptEmailContent(privateKey);
    await this.db.query(
      `INSERT INTO smime_certificates (user_id, email, certificate, private_key_enc, fingerprint, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '1 year')
       ON CONFLICT (user_id) DO UPDATE
         SET certificate = $3, private_key_enc = $4, fingerprint = $5,
             created_at = NOW(), expires_at = NOW() + INTERVAL '1 year'`,
      [userId, headyEmail, certificate, encryptedKey, fingerprint]
    );

    return { certificate, fingerprint };
    // Note: private key is never returned to the client after initial provisioning
  }

  /** @private */
  async _generateSelfSignedSmimeCert(email) {
    // Placeholder — production should use an actual CA
    // This uses OpenSSL via child_process in real implementation
    return {
      privateKey: '-----BEGIN PRIVATE KEY-----\n[generated]\n-----END PRIVATE KEY-----',
      certificate: '-----BEGIN CERTIFICATE-----\n[generated]\n-----END CERTIFICATE-----',
    };
  }

  // ── WebSocket Push Notifications ──────────────────────────────────────────

  /**
   * Emit a real-time email event to a user's connected WebSocket clients.
   * @param {string}  userId     - User UUID
   * @param {string}  eventType  - 'new_mail' | 'sent' | 'deleted' | 'read'
   * @param {object}  payload    - Event data
   */
  _emitEmailEvent(userId, eventType, payload) {
    if (!this.wsServer) return;

    const message = JSON.stringify({
      type: `email:${eventType}`,
      data: payload,
      timestamp: Date.now(),
    });

    // Broadcast to all WebSocket clients connected for this user
    this.wsServer.clients.forEach((ws) => {
      if (ws.readyState === 1 /* OPEN */ && ws.userId === userId) {
        ws.send(message);
      }
    });
  }

  /**
   * Start IMAP IDLE to push new mail notifications.
   * Called once per active user session.
   *
   * @param {string}  userId - User UUID
   * @param {object}  emailAccount - Email account record
   */
  async startMailPush(userId, emailAccount) {
    if (emailAccount.provider !== 'mailcow' && emailAccount.provider !== 'smtp') {
      return; // Cloudflare routing doesn't support IMAP IDLE
    }

    const client = await this._getImapClient(userId, emailAccount);

    client.on('exists', (data) => {
      if (data.path === 'INBOX') {
        this._emitEmailEvent(userId, 'new_mail', {
          folder: 'INBOX',
          count: data.count,
        });
      }
    });

    await client.idle();
  }

  // ── Spam Filtering ────────────────────────────────────────────────────────

  /**
   * Check an incoming email against spam filters.
   * Integrates with SpamAssassin via API or rspamd.
   *
   * @param {object}  emailData - Parsed email data
   * @returns {Promise<{isSpam: boolean, score: number, reasons: string[]}>}
   */
  async checkSpam(emailData) {
    const spamConfig = this.config.email?.spamFilter;

    if (!spamConfig?.enabled) {
      return { isSpam: false, score: 0, reasons: [] };
    }

    try {
      if (spamConfig.provider === 'rspamd') {
        return await this._checkRspamd(emailData);
      }
    } catch (err) {
      console.error('[HeadyEmail] Spam check failed:', err.message);
    }

    return { isSpam: false, score: 0, reasons: [] };
  }

  /** @private */
  async _checkRspamd(emailData) {
    const resp = await fetch(`${this.config.email.spamFilter.url}/checkv2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'From': emailData.from?.address || '',
        'Subject': emailData.subject || '',
      },
      body: emailData.rawMessage || '',
    });

    if (!resp.ok) return { isSpam: false, score: 0, reasons: [] };

    const result = await resp.json();
    return {
      isSpam: result.action === 'reject' || result.action === 'add header',
      score: result.score || 0,
      reasons: Object.keys(result.symbols || {}),
    };
  }

  // ── Attachment Handling ───────────────────────────────────────────────────

  /**
   * Process and validate email attachments.
   * Checks size limits and references virus scanning service.
   *
   * @param {object[]} attachments - Array of attachment objects
   * @returns {Promise<object[]>} Validated attachments
   */
  async _processAttachments(attachments) {
    if (!attachments?.length) return [];

    const processed = [];

    for (const attachment of attachments) {
      // Size check
      if (attachment.size > MAX_ATTACHMENT_SIZE) {
        throw new EmailError(
          `Attachment "${attachment.filename}" exceeds maximum size of ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB.`,
          'EMAIL_ATTACHMENT_TOO_LARGE',
          400
        );
      }

      // Virus scan reference (production: integrate with ClamAV or VirusTotal)
      if (this.config.email?.virusScan?.enabled) {
        const scanResult = await this._scanAttachmentForViruses(attachment);
        if (scanResult.infected) {
          throw new EmailError(
            `Attachment "${attachment.filename}" failed virus scan.`,
            'EMAIL_ATTACHMENT_INFECTED',
            400,
            { threat: scanResult.threat }
          );
        }
      }

      processed.push({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType || 'application/octet-stream',
        encoding: 'base64',
      });
    }

    return processed;
  }

  /**
   * Reference implementation for virus scanning via ClamAV.
   * @private
   * @param {object} attachment
   * @returns {Promise<{infected: boolean, threat?: string}>}
   */
  async _scanAttachmentForViruses(attachment) {
    // In production: stream to ClamAV daemon (clamd) via TCP
    // or call VirusTotal API for unknown files
    const clamUrl = this.config.email.virusScan.clamAvUrl;
    if (!clamUrl) return { infected: false };

    // Implement ClamAV streaming scan here
    // Example: send to clamd INSTREAM command
    return { infected: false }; // Placeholder
  }

  // ── IMAP Connection Pool ──────────────────────────────────────────────────

  /**
   * Get or create an IMAP connection for a user.
   * @private
   */
  async _getImapClient(userId, emailAccount) {
    if (this._imapPool.has(userId)) {
      const existing = this._imapPool.get(userId);
      if (existing.usable) return existing;
      this._imapPool.delete(userId);
    }

    const password = this._decryptMailboxPassword(emailAccount.mailbox_password_enc);

    const client = new ImapFlow({
      host: this.config.email?.imap?.host || 'mail.headyme.com',
      port: this.config.email?.imap?.port || 993,
      secure: true,
      auth: {
        user: emailAccount.address,
        pass: password,
      },
      logger: false,
      tls: { rejectUnauthorized: true },
    });

    await client.connect();
    this._imapPool.set(userId, client);

    // Clean up on disconnect
    client.on('close', () => this._imapPool.delete(userId));

    return client;
  }

  // ── Storage Helpers (for Cloudflare routing) ──────────────────────────────

  /**
   * Store a received or sent email in PostgreSQL (encrypted).
   * @private
   */
  async _storeSentEmail(userId, emailData) {
    const encryptedContent = this.encryptEmailContent(JSON.stringify({
      text: emailData.text,
      html: emailData.html,
    }));

    await this.db.query(
      `INSERT INTO stored_emails
         (user_id, message_id, folder, from_address, to_addresses,
          cc_addresses, subject, content_enc, sent_at, is_read, deleted)
       VALUES ($1, $2, 'Sent', $3, $4, $5, $6, $7, $8, TRUE, FALSE)`,
      [
        userId,
        emailData.messageId,
        emailData.from,
        JSON.stringify(emailData.to),
        JSON.stringify(emailData.cc),
        emailData.subject,
        encryptedContent,
        emailData.sentAt,
      ]
    );
  }

  /** @private */
  async _getStoredEmails(userId, { page, folder, unreadOnly }) {
    const offset = (page - 1) * INBOX_PAGE_SIZE;
    const conditions = ['user_id = $1', 'folder = $2', 'deleted = FALSE'];
    const params = [userId, folder || 'INBOX'];

    if (unreadOnly) {
      conditions.push('is_read = FALSE');
    }

    const totalResult = await this.db.query(
      `SELECT COUNT(*) FROM stored_emails WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT id, message_id, from_address, to_addresses, subject, sent_at, is_read, folder
       FROM stored_emails
       WHERE ${conditions.join(' AND ')}
       ORDER BY sent_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, INBOX_PAGE_SIZE, offset]
    );

    return { emails: result.rows, total, page, hasMore: total > page * INBOX_PAGE_SIZE };
  }

  /** @private */
  async _getStoredEmailById(userId, id) {
    const result = await this.db.query(
      'SELECT * FROM stored_emails WHERE user_id = $1 AND id = $2 AND deleted = FALSE',
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new EmailError('Email not found.', 'EMAIL_NOT_FOUND', 404);
    }

    const email = result.rows[0];
    const decrypted = JSON.parse(this.decryptEmailContent(email.content_enc));

    // Mark as read
    await this.db.query('UPDATE stored_emails SET is_read = TRUE WHERE id = $1', [email.id]);

    return {
      ...email,
      text: decrypted.text,
      html: decrypted.html,
      content_enc: undefined, // Remove encrypted content from response
    };
  }

  /** @private */
  async _searchStoredEmails(userId, { text, from, subject, since, before, unread }) {
    const conditions = ['user_id = $1', 'deleted = FALSE'];
    const params = [userId];
    let idx = 2;

    if (text) { conditions.push(`subject ILIKE $${idx++}`); params.push(`%${text}%`); }
    if (from) { conditions.push(`from_address ILIKE $${idx++}`); params.push(`%${from}%`); }
    if (subject) { conditions.push(`subject ILIKE $${idx++}`); params.push(`%${subject}%`); }
    if (since) { conditions.push(`sent_at >= $${idx++}`); params.push(since); }
    if (before) { conditions.push(`sent_at <= $${idx++}`); params.push(before); }
    if (unread) { conditions.push('is_read = FALSE'); }

    const result = await this.db.query(
      `SELECT id, message_id, from_address, to_addresses, subject, sent_at, is_read, folder
       FROM stored_emails
       WHERE ${conditions.join(' AND ')}
       ORDER BY sent_at DESC LIMIT 100`,
      params
    );

    return result.rows;
  }

  // ── Template Rendering ────────────────────────────────────────────────────

  /**
   * Render an email template with variables.
   * @private
   */
  async _renderTemplate(templateId, variables) {
    const templates = {
      welcome: (v) => ({
        html: `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Heady ✦</h1>
  </div>
  <p>Hey ${v.displayName},</p>
  <p>Your sovereign AI account is ready. Here's what you have:</p>
  <ul>
    <li>🤖 <strong>HeadyBuddy</strong> — your personal AI companion</li>
    <li>📧 <strong>${v.headyEmail}</strong> — your Heady email address</li>
    <li>🧠 <strong>Vector Memory</strong> — persistent AI memory</li>
  </ul>
  <p>First, verify your email to activate all features:</p>
  <a href="${v.verifyUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 16px 0;">Verify Email Address</a>
  <p style="color: #666; font-size: 12px; margin-top: 32px;">
    This link expires in 24 hours. If you didn't create a Heady account, you can safely ignore this email.
  </p>
  <p style="color: #666; font-size: 12px;">© ${v.year} Heady. headyme.com</p>
</body>
</html>`,
        text: `Welcome to Heady, ${v.displayName}!\n\nVerify your email: ${v.verifyUrl}\n\nYour Heady email: ${v.headyEmail}`,
      }),

      reset_password: (v) => ({
        html: `<p>Reset your Heady password: <a href="${v.resetUrl}">${v.resetUrl}</a><br>Expires in 1 hour.</p>`,
        text: `Reset your password: ${v.resetUrl}\nExpires in 1 hour.`,
      }),
    };

    const renderer = templates[templateId];
    if (!renderer) {
      return {
        html: `<p>Notification from Heady</p>`,
        text: 'Notification from Heady',
      };
    }

    return renderer(variables);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** @private */
  async _getEmailAccount(userId) {
    const result = await this.db.query(
      'SELECT * FROM email_accounts WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      throw new EmailError(
        'No email account found. Please complete account setup.',
        'EMAIL_ACCOUNT_NOT_FOUND',
        404
      );
    }
    return result.rows[0];
  }

  /** @private */
  _decryptMailboxPassword(encryptedBase64) {
    if (!encryptedBase64) return null;
    try {
      return this.decryptEmailContent(encryptedBase64);
    } catch {
      return null;
    }
  }

  /** @private */
  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** @private */
  _htmlToText(html) {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  /** @private */
  _formatEnvelope(message) {
    return {
      uid: message.uid,
      subject: message.envelope?.subject,
      from: message.envelope?.from?.[0],
      to: message.envelope?.to,
      date: message.internalDate,
      flags: [...(message.flags || [])],
      seen: message.flags?.has('\\Seen') ?? false,
      flagged: message.flags?.has('\\Flagged') ?? false,
      hasAttachments: message.bodyStructure?.childNodes?.length > 1,
    };
  }
}

export default SecureEmailClient;
