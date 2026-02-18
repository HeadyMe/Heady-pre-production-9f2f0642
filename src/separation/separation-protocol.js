/**
 * 🔐 Heady Separation Protocol - Ensures Clear Local/Remote Boundaries
 * Foundation for distinct local vs remote environments with clear separation
 */

class HeadySeparationProtocol {
  constructor() {
    this.environment = this.detectEnvironment();
    this.separationRules = this.initializeSeparationRules();
    this.protocolVersion = '1.0.0';
    this.activeMode = this.determineActiveMode();
  }

  /**
   * Detect current environment (local vs remote)
   */
  detectEnvironment() {
    const indicators = {
      hostname: require('os').hostname(),
      isProduction: process.env.NODE_ENV === 'production',
      isDevelopment: process.env.NODE_ENV === 'development',
      isTest: process.env.NODE_ENV === 'test',
      port: process.env.PORT || 3000,
      domain: process.env.DOMAIN || 'localhost'
    };

    // Environment detection logic
    if (indicators.isProduction && !indicators.hostname.includes('local')) {
      return 'REMOTE_PRODUCTION';
    } else if (indicators.isDevelopment || indicators.domain.includes('localhost')) {
      return 'LOCAL_DEVELOPMENT';
    } else if (indicators.isTest) {
      return 'TEST_ENVIRONMENT';
    } else {
      return 'HYBRID_ENVIRONMENT';
    }
  }

  /**
   * Initialize separation rules based on environment
   */
  initializeSeparationRules() {
    const baseRules = {
      domainIsolation: true,
      serviceSeparation: true,
      dataSeparation: true,
      configSeparation: true,
      apiSeparation: true,
      uiSeparation: true
    };

    switch (this.environment) {
      case 'REMOTE_PRODUCTION':
        return {
          ...baseRules,
          allowedDomains: ['headyme.com', 'chat.headyme.com', 'manager.headyme.com'],
          forbiddenDomains: ['localhost', '127.0.0.1', '0.0.0.0'],
          strictMode: true,
          publicAccess: true
        };
      
      case 'LOCAL_DEVELOPMENT':
        return {
          ...baseRules,
          allowedDomains: ['localhost', '127.0.0.1'],
          forbiddenDomains: ['headyme.com', 'chat.headyme.com'],
          strictMode: false,
          publicAccess: false,
          developmentMode: true
        };
      
      default:
        return {
          ...baseRules,
          allowedDomains: ['localhost', 'headyme.com'],
          forbiddenDomains: [],
          strictMode: false,
          publicAccess: false
        };
    }
  }

  /**
   * Determine active operational mode
   */
  determineActiveMode() {
    if (this.environment === 'REMOTE_PRODUCTION') {
      return 'PRODUCTION_MODE';
    } else if (this.environment === 'LOCAL_DEVELOPMENT') {
      return 'DEVELOPMENT_MODE';
    } else {
      return 'HYBRID_MODE';
    }
  }

  /**
   * Validate separation compliance
   */
  validateSeparation(operation, context = {}) {
    const validation = {
      compliant: true,
      violations: [],
      warnings: [],
      recommendations: [],
      environment: this.environment,
      mode: this.activeMode
    };

    // Check domain compliance
    if (operation.url || operation.domain) {
      const domain = operation.url || operation.domain;
      const domainCheck = this.validateDomain(domain);
      if (!domainCheck.compliant) {
        validation.compliant = false;
        validation.violations.push(...domainCheck.violations);
      }
    }

    // Check service separation
    if (operation.service) {
      const serviceCheck = this.validateService(operation.service);
      if (!serviceCheck.compliant) {
        validation.compliant = false;
        validation.violations.push(...serviceCheck.violations);
      }
    }

    // Check data separation
    if (operation.data || operation.database) {
      const dataCheck = this.validateData(operation.data || operation.database);
      if (!dataCheck.compliant) {
        validation.compliant = false;
        validation.violations.push(...dataCheck.violations);
      }
    }

    // Environment-specific checks
    const envCheck = this.validateEnvironmentSpecific(operation);
    if (!envCheck.compliant) {
      validation.compliant = false;
      validation.violations.push(...envCheck.violations);
    }

    return validation;
  }

  /**
   * Validate domain usage
   */
  validateDomain(domain) {
    const validation = { compliant: true, violations: [] };

    // Check forbidden domains
    for (const forbidden of this.separationRules.forbiddenDomains) {
      if (domain.includes(forbidden)) {
        validation.compliant = false;
        validation.violations.push(`Forbidden domain detected: ${forbidden}`);
      }
    }

    // Check allowed domains
    let allowedFound = false;
    for (const allowed of this.separationRules.allowedDomains) {
      if (domain.includes(allowed)) {
        allowedFound = true;
        break;
      }
    }

    if (!allowedFound && this.separationRules.strictMode) {
      validation.compliant = false;
      validation.violations.push(`Domain not in allowed list: ${domain}`);
    }

    return validation;
  }

  /**
   * Validate service separation
   */
  validateService(service) {
    const validation = { compliant: true, violations: [] };

    // Check for cross-environment service calls
    if (this.environment === 'LOCAL_DEVELOPMENT' && service.includes('headyme.com')) {
      validation.compliant = false;
      validation.violations.push('Local environment cannot access production services');
    }

    if (this.environment === 'REMOTE_PRODUCTION' && service.includes('localhost')) {
      validation.compliant = false;
      validation.violations.push('Production environment cannot access localhost services');
    }

    return validation;
  }

  /**
   * Validate data separation
   */
  validateData(data) {
    const validation = { compliant: true, violations: [] };

    // Check for cross-environment data access
    if (this.environment === 'LOCAL_DEVELOPMENT' && data.includes('production')) {
      validation.compliant = false;
      validation.violations.push('Local environment cannot access production data');
    }

    if (this.environment === 'REMOTE_PRODUCTION' && data.includes('local')) {
      validation.compliant = false;
      validation.violations.push('Production environment cannot access local data');
    }

    return validation;
  }

  /**
   * Environment-specific validation
   */
  validateEnvironmentSpecific(operation) {
    const validation = { compliant: true, violations: [] };

    switch (this.environment) {
      case 'REMOTE_PRODUCTION':
        // Production must use production domains
        if (operation.url && !operation.url.includes('headyme.com')) {
          validation.compliant = false;
          validation.violations.push('Production must use headyme.com domains');
        }
        break;

      case 'LOCAL_DEVELOPMENT':
        // Local should not access production APIs
        if (operation.api && operation.api.includes('headyme.com')) {
          validation.compliant = false;
          validation.violations.push('Local development should not access production APIs');
        }
        break;
    }

    return validation;
  }

  /**
   * Get separation protocol status
   */
  getStatus() {
    return {
      protocol: 'HeadySeparationProtocol',
      version: this.protocolVersion,
      environment: this.environment,
      mode: this.activeMode,
      rules: this.separationRules,
      compliance: {
        strictMode: this.separationRules.strictMode,
        domainIsolation: this.separationRules.domainIsolation,
        serviceSeparation: this.separationRules.serviceSeparation
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create separation boundary
   */
  createBoundary(type, config = {}) {
    const boundary = {
      type,
      environment: this.environment,
      config,
      rules: this.separationRules,
      created: new Date().toISOString()
    };

    switch (type) {
      case 'API_BOUNDARY':
        return this.createAPIBoundary(boundary);
      case 'DATA_BOUNDARY':
        return this.createDataBoundary(boundary);
      case 'SERVICE_BOUNDARY':
        return this.createServiceBoundary(boundary);
      case 'UI_BOUNDARY':
        return this.createUIBoundary(boundary);
      default:
        return boundary;
    }
  }

  /**
   * Create API boundary
   */
  createAPIBoundary(boundary) {
    return {
      ...boundary,
      allowedOrigins: this.environment === 'REMOTE_PRODUCTION' 
        ? ['https://headyme.com', 'https://chat.headyme.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      rateLimiting: this.environment === 'REMOTE_PRODUCTION',
      authentication: this.environment === 'REMOTE_PRODUCTION',
      cors: {
        enabled: true,
        strict: this.environment === 'REMOTE_PRODUCTION'
      }
    };
  }

  /**
   * Create data boundary
   */
  createDataBoundary(boundary) {
    return {
      ...boundary,
      databases: this.environment === 'REMOTE_PRODUCTION'
        ? ['production_db.headyme.com']
        : ['localhost:5432'],
      encryption: this.environment === 'REMOTE_PRODUCTION',
      backup: this.environment === 'REMOTE_PRODUCTION',
      isolation: true
    };
  }

  /**
   * Create service boundary
   */
  createServiceBoundary(boundary) {
    return {
      ...boundary,
      services: this.environment === 'REMOTE_PRODUCTION'
        ? ['manager.headyme.com', 'api.headyme.com']
        : ['localhost:3300', 'localhost:3000'],
      loadBalancing: this.environment === 'REMOTE_PRODUCTION',
      monitoring: true,
      healthChecks: true
    };
  }

  /**
   * Create UI boundary
   */
  createUIBoundary(boundary) {
    return {
      ...boundary,
      domains: this.environment === 'REMOTE_PRODUCTION'
        ? ['https://headyme.com', 'https://chat.headyme.com']
        : ['http://localhost:3000'],
      cdn: this.environment === 'REMOTE_PRODUCTION',
      caching: this.environment === 'REMOTE_PRODUCTION',
      securityHeaders: this.environment === 'REMOTE_PRODUCTION'
    };
  }
}

module.exports = { HeadySeparationProtocol };
