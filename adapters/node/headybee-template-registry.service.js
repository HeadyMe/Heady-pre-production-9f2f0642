'use strict';

const fs = require('fs');
const path = require('path');
const { buildSelector } = require('../../registry/template-selector');
const { validateCatalog } = require('../../registry/template-health');

class HeadyBeeTemplateRegistryService {
  constructor(options = {}) {
    this.root = options.root || path.resolve(__dirname, '..', '..');
    this.catalogPath = options.catalogPath || path.join(this.root, 'registry', 'heady-template-catalog.json');
    this.matrixPath = options.matrixPath || path.join(this.root, 'registry', 'scenario-matrix.yaml');
    this.startedAt = null;
  }

  start() {
    this.startedAt = new Date().toISOString();
    return this.health();
  }

  catalog() {
    return JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
  }

  list() {
    return this.catalog().beeTemplates || [];
  }

  get(templateId) {
    return this.list().find(item => item.id === templateId) || null;
  }

  recommend(input) {
    return buildSelector({ catalogPath: this.catalogPath, scenarioMatrixPath: this.matrixPath }).recommend(input);
  }

  health() {
    const catalog = this.catalog();
    const validation = validateCatalog(catalog);
    return {
      service: 'headybee-template-registry',
      startedAt: this.startedAt,
      status: validation.ok ? 'healthy' : 'degraded',
      ...validation
    };
  }
}

module.exports = { HeadyBeeTemplateRegistryService };
