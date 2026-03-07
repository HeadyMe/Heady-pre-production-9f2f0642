const CSL = require('../core/semantic-logic');
const logger = require('../utils/logger').child({ component: 'quarantine-manager' });

class QuarantineManager {
    constructor() {
        this.quarantined = new Map();
        this.attestationHistory = new Map();
        this.phiEquilibrium = 0.618;
        this.consecutiveThreshold = 3;
    }

    processAttestation(attestation) {
        const { serviceId, cslScore, ternaryState } = attestation;

        // Store attestation
        if (!this.attestationHistory.has(serviceId)) {
            this.attestationHistory.set(serviceId, []);
        }
        const history = this.attestationHistory.get(serviceId);
        history.push(attestation);
        if (history.length > 10) history.shift();

        // Check for quarantine condition
        if (cslScore < this.phiEquilibrium) {
            const recentBad = history.slice(-this.consecutiveThreshold)
                .filter(a => a.cslScore < this.phiEquilibrium).length;

            if (recentBad >= this.consecutiveThreshold && !this.quarantined.has(serviceId)) {
                this.quarantine(serviceId, 'CSL score below phi-equilibrium', cslScore);
            }
        } else if (this.quarantined.has(serviceId) && ternaryState === 1) {
            // Service recovered
            this.release(serviceId);
        }
    }

    quarantine(serviceId, reason, score) {
        logger.warn('Quarantining service', { serviceId, reason, score });

        this.quarantined.set(serviceId, {
            serviceId,
            reason,
            score,
            entryTime: Date.now(),
            respawnAttempts: 0
        });

        // TODO: Remove from MCP router, load balancer, etc.
    }

    release(serviceId) {
        if (this.quarantined.has(serviceId)) {
            const entry = this.quarantined.get(serviceId);
            const duration = Date.now() - entry.entryTime;

            logger.info('Releasing service from quarantine', { 
                serviceId, 
                duration: Math.round(duration / 1000) + 's' 
            });

            this.quarantined.delete(serviceId);
        }
    }

    isQuarantined(serviceId) {
        return this.quarantined.has(serviceId);
    }

    getQuarantined() {
        return Array.from(this.quarantined.values());
    }

    computeFleetHealth() {
        const allAttestations = [];
        for (const history of this.attestationHistory.values()) {
            if (history.length > 0) {
                allAttestations.push(history[history.length - 1]);
            }
        }

        if (allAttestations.length === 0) return 0;

        // Use CSL consensus_superposition for aggregate health
        const avgScore = allAttestations.reduce((sum, a) => sum + a.cslScore, 0) / allAttestations.length;
        return avgScore;
    }
}

module.exports = QuarantineManager;
