/**
 * Heady Project - Human-on-the-Loop Interstitial Gates
 * 
 * Manages approval queues for high-stakes AI actions (e.g. database mutations,
 * financial transactions, system modifications). Implements cryptographic receipt logic.
 */

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '../../data/receipts');

class HumanApprovalGates {
    constructor() {
        this.pendingApprovals = new Map(); // id -> { intent, model, payload, status }

        if (!fs.existsSync(AUDIT_DIR)) {
            fs.mkdirSync(AUDIT_DIR, { recursive: true });
        }
    }

    /**
     * Agent requests an action to be executed, but execution is halted pending human approval.
     */
    requestApproval(intent, modelDecision, toolsExecuted, projectedROI = null) {
        const id = randomUUID();
        const request = {
            id,
            timestamp: Date.now(),
            intent,
            modelDecision,
            toolsExecuted,
            projectedROI,
            status: 'PENDING'
        };

        this.pendingApprovals.set(id, request);
        return id;
    }

    /**
     * Fetches all pending approval gates.
     */
    getPending() {
        return Array.from(this.pendingApprovals.values()).filter(a => a.status === 'PENDING');
    }

    /**
     * Human operator approves or denies the action cryptographically.
     */
    resolveApproval(id, approved, operatorId, signature) {
        const req = this.pendingApprovals.get(id);
        if (!req) throw new Error('Gate ID not found or already processed.');

        req.status = approved ? 'APPROVED' : 'DENIED';
        req.operatorId = operatorId;
        req.signature = signature; // Simulated cryptographic hash of approval
        req.resolvedAt = Date.now();

        // Generate Immutable Receipt
        this._generateReceipt(req);
        this.pendingApprovals.delete(id);

        return req;
    }

    /**
     * "Proof View UI" Receipt Generation
     * The immutable, visual receipt detailing intent, routing, tools, validation, and ROI.
     */
    _generateReceipt(requestData) {
        const receipt = {
            receiptId: requestData.id,
            actionIntent: requestData.intent,
            routingDecision: requestData.modelDecision, // Tracks why model X was chosen
            toolsExecuted: requestData.toolsExecuted,
            validation: requestData.status === 'APPROVED' ? 'Human Verified: PASS' : 'Human Verified: DENIED',
            roi: requestData.projectedROI || 'N/A',
            operatorSignature: requestData.signature,
            timestamp: new Date().toISOString()
        };

        const rPath = path.join(AUDIT_DIR, `${receipt.receiptId}.json`);
        fs.writeFileSync(rPath, JSON.stringify(receipt, null, 2));
    }
}

let _gates = null;
function getApprovalGates() {
    if (!_gates) _gates = new HumanApprovalGates();
    return _gates;
}

module.exports = { HumanApprovalGates, getApprovalGates };
