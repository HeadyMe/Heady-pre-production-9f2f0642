'use strict';

const fs = require('fs');
const path = require('path');
const { validateCatalog } = require('../../registry/template-health');

class HeadySwarmTemplateRegistryService {
  constructor(options = {}) {
    this.root = options.root || path.resolve(__dirname, '..', '..');
    this.catalogPath = options.catalogPath || path.join(this.root, 'registry', 'heady-template-catalog.json');
  }

  catalog() {
    return JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
  }

  list() {
    return this.catalog().swarmTemplates || [];
  }

  get(templateId) {
    return this.list().find(item => item.id === templateId) || null;
  }

  forBeeTemplate(beeTemplateId) {
    return this.list().filter(item => (item.includedBeeTemplates || []).includes(beeTemplateId));
  }

  health() {
    const validation = validateCatalog(this.catalog());
    return {
      service: 'headyswarm-template-registry',
      status: validation.ok ? 'healthy' : 'degraded',
      swarmCount: validation.swarmCount,
      beeCount: validation.beeCount,
      issues: validation.issues
    };
  }
}

module.exports = { HeadySwarmTemplateRegistryService };
