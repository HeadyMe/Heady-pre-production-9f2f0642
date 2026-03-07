const HealthAttestor = require('./health-attestor');
const QuarantineManager = require('./quarantine-manager');
const RespawnController = require('./respawn-controller');
const DriftDetector = require('./drift-detector');
const logger = require('../utils/logger').child({ component: 'self-healing-bee' });

class SelfHealingSwarmBee {
    constructor() {
        this.name = 'SelfHealingBee';
        this.domain = 'health-operations-resilience';
        this.attestor = new HealthAttestor('self-healing-bee');
        this.quarantineManager = new QuarantineManager();
        this.respawnController = new RespawnController(this.quarantineManager);
        this.driftDetector = new DriftDetector();
        this.active = false;
    }

    async start() {
        logger.info('Starting self-healing swarm bee');
        this.active = true;
        this.attestor.start();

        // Set up event listeners
        this.attestor.on('attestation', (attestation) => {
            this.quarantineManager.processAttestation(attestation);
        });

        // Check for respawn needs periodically
        setInterval(() => this.checkRespawns(), 10000);
    }

    async stop() {
        this.active = false;
        this.attestor.stop();
        logger.info('Stopped self-healing swarm bee');
    }

    async checkRespawns() {
        const quarantined = this.quarantineManager.getQuarantined();
        for (const entry of quarantined) {
            const result = await this.respawnController.attemptRespawn(entry.serviceId);
            if (!result.success) {
                logger.warn('Respawn failed', { serviceId: entry.serviceId, reason: result.reason });
            }
        }
    }

    getMetadata() {
        return {
            name: this.name,
            domain: this.domain,
            active: this.active,
            quarantinedServices: this.quarantineManager.getQuarantined().length,
            fleetHealth: this.quarantineManager.computeFleetHealth()
        };
    }
}

module.exports = SelfHealingSwarmBee;
