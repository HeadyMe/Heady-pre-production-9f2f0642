const CSL = require('../core/semantic-logic');
const logger = require('../utils/logger').child({ component: 'circuit-breaker-orchestrator' });

class CircuitBreakerOrchestrator {
    constructor() {
        this.providerStates = new Map();
        this.failoverPriority = ['openai', 'anthropic', 'google', 'groq', 'local'];
    }

    broadcastProviderFailure(provider) {
        logger.warn('Broadcasting provider failure', { provider });
        this.providerStates.set(provider, { state: 'OPEN', timestamp: Date.now() });
        // Broadcast to all services via Redis/EventBus
    }

    selectBestProvider(requiredCapability) {
        const availableProviders = this.failoverPriority.filter(p => {
            const state = this.providerStates.get(p);
            return !state || state.state === 'CLOSED';
        });

        if (availableProviders.length === 0) {
            return 'local'; // Fallback to local
        }

        // Use CSL multi_resonance to score providers
        return availableProviders[0];
    }

    handleProviderRecovery(provider) {
        logger.info('Provider recovered', { provider });
        this.providerStates.set(provider, { state: 'CLOSED', timestamp: Date.now() });
    }
}

module.exports = CircuitBreakerOrchestrator;
