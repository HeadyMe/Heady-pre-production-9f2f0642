export class EmailError extends HeadyError {
    constructor(message: any, code?: string, status?: number, meta?: {});
}
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
    constructor({ db, redis, wsServer, config }: {
        db: object;
        redis: object;
        wsServer?: object | undefined;
        config: object;
    });
    db: object;
    redis: object;
    wsServer: object | undefined;
    config: object;
    /** @type {object} Nodemailer SMTP transport */
    _transport: object;
    /** @type {Map<string, ImapFlow>} Per-user IMAP connection pool */
    _imapPool: Map<string, ImapFlow>;
    /** Encryption key (32 bytes) for email at-rest encryption */
    _encKey: Buffer<ArrayBuffer>;
    /**
     * Initialize the email client. Creates SMTP transport.
     * Must be called once before use.
     */
    initialize(): Promise<void>;
    /** @private */
    private _createSmtpTransport;
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
    send({ from, to, cc, bcc, subject, text, html, attachments, inReplyTo, references, userId }: {
        from: string;
    }): Promise<{
        messageId: string;
        accepted: string[];
    }>;
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
    sendTransactional({ to, subject, templateId, variables }: {
        to: string;
        subject: string;
        templateId: string;
        variables: object;
    }): Promise<object>;
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
    getInbox(userId: string, { page, folder, unreadOnly }?: {
        page?: number | undefined;
        folder?: string | undefined;
        unreadOnly?: boolean | undefined;
    }): Promise<{
        emails: object[];
        total: number;
        page: number;
        hasMore: boolean;
    }>;
    /**
     * Read a specific email by its UID.
     *
     * @param {string} userId   - User UUID
     * @param {string} uid      - IMAP UID or database ID
     * @param {string} [folder='INBOX'] - IMAP folder
     * @returns {Promise<object>} Full email with parsed body
     */
    readEmail(userId: string, uid: string, folder?: string): Promise<object>;
    /**
     * Delete (move to Trash or permanently delete) an email.
     * @param {string}  userId   - User UUID
     * @param {string}  uid      - Message UID
     * @param {string}  [folder='INBOX']
     * @param {boolean} [permanent=false] - Permanently delete vs move to Trash
     */
    deleteEmail(userId: string, uid: string, folder?: string, permanent?: boolean): Promise<{
        success: boolean;
    }>;
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
    searchEmails(userId: string, { text, from, subject, since, before, unread, folder }?: {
        text?: string | undefined;
        from?: string | undefined;
        subject?: string | undefined;
        since?: Date | undefined;
        before?: Date | undefined;
        unread?: boolean | undefined;
        folder?: string | undefined;
    }): Promise<object[]>;
    /**
     * Forward an email to new recipients.
     * @param {string}   userId       - User UUID
     * @param {string}   uid          - Message UID to forward
     * @param {string[]} to           - New recipients
     * @param {string}   fromAddress  - @headyme.com sender address
     * @param {string}   [comment]    - Optional forwarding comment
     */
    forwardEmail(userId: string, uid: string, to: string[], fromAddress: string, comment?: string): Promise<{
        messageId: string;
        accepted: string[];
    }>;
    /**
     * Encrypt email content for database storage using AES-256-GCM.
     * @param {string} content - Plaintext email content
     * @returns {string} Base64-encoded encrypted content (iv:tag:ciphertext)
     */
    encryptEmailContent(content: string): string;
    /**
     * Decrypt email content from database storage.
     * @param {string} encryptedBase64 - Base64 encrypted content
     * @returns {string} Plaintext content
     */
    decryptEmailContent(encryptedBase64: string): string;
    /**
     * Provision a self-signed S/MIME certificate for a user's @headyme.com address.
     * In production, integrate with a CA (e.g., Let's Encrypt S/MIME, Actalis).
     *
     * @param {string} userId     - User UUID
     * @param {string} headyEmail - The @headyme.com email address
     * @returns {Promise<{certificate: string, privateKey: string, fingerprint: string}>}
     */
    provisionSmimeCertificate(userId: string, headyEmail: string): Promise<{
        certificate: string;
        privateKey: string;
        fingerprint: string;
    }>;
    /** @private */
    private _generateSelfSignedSmimeCert;
    /**
     * Emit a real-time email event to a user's connected WebSocket clients.
     * @param {string}  userId     - User UUID
     * @param {string}  eventType  - 'new_mail' | 'sent' | 'deleted' | 'read'
     * @param {object}  payload    - Event data
     */
    _emitEmailEvent(userId: string, eventType: string, payload: object): void;
    /**
     * Start IMAP IDLE to push new mail notifications.
     * Called once per active user session.
     *
     * @param {string}  userId - User UUID
     * @param {object}  emailAccount - Email account record
     */
    startMailPush(userId: string, emailAccount: object): Promise<void>;
    /**
     * Check an incoming email against spam filters.
     * Integrates with SpamAssassin via API or rspamd.
     *
     * @param {object}  emailData - Parsed email data
     * @returns {Promise<{isSpam: boolean, score: number, reasons: string[]}>}
     */
    checkSpam(emailData: object): Promise<{
        isSpam: boolean;
        score: number;
        reasons: string[];
    }>;
    /** @private */
    private _checkRspamd;
    /**
     * Process and validate email attachments.
     * Checks size limits and references virus scanning service.
     *
     * @param {object[]} attachments - Array of attachment objects
     * @returns {Promise<object[]>} Validated attachments
     */
    _processAttachments(attachments: object[]): Promise<object[]>;
    /**
     * Reference implementation for virus scanning via ClamAV.
     * @private
     * @param {object} attachment
     * @returns {Promise<{infected: boolean, threat?: string}>}
     */
    private _scanAttachmentForViruses;
    /**
     * Get or create an IMAP connection for a user.
     * @private
     */
    private _getImapClient;
    /**
     * Store a received or sent email in PostgreSQL (encrypted).
     * @private
     */
    private _storeSentEmail;
    /** @private */
    private _getStoredEmails;
    /** @private */
    private _getStoredEmailById;
    /** @private */
    private _searchStoredEmails;
    /**
     * Render an email template with variables.
     * @private
     */
    private _renderTemplate;
    /** @private */
    private _getEmailAccount;
    /** @private */
    private _decryptMailboxPassword;
    /** @private */
    private _isValidEmail;
    /** @private */
    private _htmlToText;
    /** @private */
    private _formatEnvelope;
}
export default SecureEmailClient;
import { HeadyError } from './auth-provider.js';
//# sourceMappingURL=email-client.d.ts.map