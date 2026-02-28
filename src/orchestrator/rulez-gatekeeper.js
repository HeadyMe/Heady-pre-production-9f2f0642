/**
 * ════════════════════════════════════════════════════════════════════
 * 🛡️ RULEZ YAML DETERMINISTIC GATEKEEPER
 * Hard-gating middleware that validates generative agent outputs 
 * against strictly typed YAML schemas before permitting execution.
 * ════════════════════════════════════════════════════════════════════
 */

const yaml = require('js-yaml');
const fs = require('fs');
const logger = require('../utils/logger');

class RuleZGatekeeper {
    constructor(rulesDir = './configs/rulez/') {
        this.rules = new Map();

        try {
            if (fs.existsSync(rulesDir)) {
                const files = fs.readdirSync(rulesDir);
                files.forEach(file => {
                    if (file.endsWith('.yaml')) {
                        const content = fs.readFileSync(`${rulesDir}${file}`, 'utf8');
                        this.rules.set(file.replace('.yaml', ''), yaml.load(content));
                    }
                });
            }
        } catch (e) {
            logger.logError('HCFP', 'RuleZ Init', e);
        }
    }

    /**
     * Verifies that the proposed agent payload strictly adheres to the 
     * deterministic schema definitions before entering the next pipeline phase.
     */
    validate(domain, payload) {
        const schema = this.rules.get(domain);

        if (!schema) {
            // Fail-closed paradigm: if no rules exist, execution is forbidden.
            logger.logNodeActivity('HCFP', `[RuleZ] Denied (No Schema): ${domain}`);
            return false;
        }

        const isValid = this._checkSchemaMatch(schema, payload);

        if (isValid) {
            logger.logNodeActivity('HCFP', `[RuleZ] Allowed: ${domain}`);
            return true;
        } else {
            logger.logNodeActivity('HCFP', `[RuleZ] Denied (Schema Mismatch): ${domain}`);
            return false;
        }
    }

    _checkSchemaMatch(schema, payload) {
        // Deep schema validation (simplified for blueprint demonstration)
        for (const [key, type] of Object.entries(schema.required || {})) {
            if (payload[key] === undefined || typeof payload[key] !== type) {
                return false;
            }
        }
        return true;
    }
}

module.exports = new RuleZGatekeeper();
