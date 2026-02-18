/**
 * 🛡️ HEADY VALIDATOR - PRE-EXECUTION ERROR CHECKING PROTOCOL
 * 
 * Critical node that activates BEFORE ANY execution to prevent false errors
 * Validates all operations before they execute to ensure system builds correctly
 */

const headyFs = require('fs').promises;
const headyPath = require('path');

class HeadyValidator {
  constructor(registry, conductor) {
    this.registry = registry;
    this.conductor = conductor;
    this.validationCache = new Map();
    this.errorPatterns = [];
    this.autoCorrectionEnabled = true;
    this.strictMode = false; // Set to true for production
    
    console.log('[HeadyValidator] Pre-execution validation protocol initialized');
  }

  /**
   * Validate entire execution plan before conductor proceeds
   */
  async validateExecutionPlan(executionPlan) {
    const headyValidationKey = JSON.stringify(executionPlan);
    
    // Check cache first
    if (this.validationCache.has(validationKey)) {
      const headyCached = this.validationCache.get(validationKey);
      console.log('[HeadyValidator] Using cached validation result');
      return cached;
    }

    const headyValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      correctedPlan: JSON.parse(JSON.stringify(executionPlan)),
      validationTimestamp: new Date().toISOString(),
      validatorVersion: '1.0.0'
    };

    console.log('\n[HeadyValidator] ══════════════════════════════════════════════════');
    console.log('[HeadyValidator] PRE-EXECUTION VALIDATION PROTOCOL');
    console.log('[HeadyValidator] ══════════════════════════════════════════════════');

    // 1. Validate nodes exist and are available
    if (executionPlan.nodes_to_invoke) {
      for (const headyNodeInfo of executionPlan.nodes_to_invoke) {
        const headyNodeValidation = await this.validateNode(nodeInfo.name);
        if (!nodeValidation.valid) {
          validationResult.errors.push(...nodeValidation.errors);
          validationResult.valid = false;
        }
      }
    }

    // 2. Validate workflows are executable
    if (executionPlan.workflows_to_execute) {
      for (const headyWorkflowInfo of executionPlan.workflows_to_execute) {
        const headyWorkflowValidation = await this.validateWorkflow(workflowInfo.name);
        if (!workflowValidation.valid) {
          validationResult.errors.push(...workflowValidation.errors);
          validationResult.valid = false;
        }
      }
    }

    // 3. Validate tools are available
    if (executionPlan.tools_to_use) {
      for (const headyToolInfo of executionPlan.tools_to_use) {
        const headyToolValidation = await this.validateTool(toolInfo.name);
        if (!toolValidation.valid) {
          validationResult.errors.push(...toolValidation.errors);
          validationResult.valid = false;
        }
      }
    }

    // 4. Validate service endpoints are reachable
    if (executionPlan.services_required) {
      for (const headyServiceInfo of executionPlan.services_required) {
        const headyServiceValidation = await this.validateService(serviceInfo.name);
        if (!serviceValidation.valid) {
          validationResult.warnings.push(...serviceValidation.warnings);
        }
      }
    }

    // 5. Validate HeadyConductor workflow understanding
    await this.validateConductorWorkflow(executionPlan, validationResult);

    // 6. Validate HeadySoul integration
    await this.validateHeadySoulIntegration(executionPlan, validationResult);

    // Auto-correction if enabled
    if (!validationResult.valid && this.autoCorrectionEnabled) {
      console.log('[HeadyValidator] Attempting auto-correction...');
      validationResult.correctedPlan = await this.autoCorrectPlan(
        executionPlan, 
        validationResult.errors
      );
      
      // Re-validate corrected plan
      if (JSON.stringify(validationResult.correctedPlan) !== JSON.stringify(executionPlan)) {
        console.log('[HeadyValidator] Re-validating corrected plan...');
        const headyRevalidation = await this.validateExecutionPlan(validationResult.correctedPlan);
        validationResult.correctedPlan = revalidation.correctedPlan;
        validationResult.valid = revalidation.valid;
        validationResult.errors = revalidation.errors;
      }
    }

    // Cache result
    this.validationCache.set(validationKey, validationResult);

    // Log results
    this.logValidationResults(validationResult);

    return validationResult;
  }

  /**
   * Validate node exists and dependencies are met
   */
  async validateNode(nodeName) {
    console.log(`[HeadyValidator] Validating node: ${nodeName}`);

    // Check if node exists in registry
    if (!this.registry.nodes || !this.registry.nodes[nodeName]) {
      return {
        valid: false,
        errors: [`Node '${nodeName}' not found in registry`]
      };
    }

    const headyNode = this.registry.nodes[nodeName];

    // Check if node's primary tool is available
    if (node.primary_tool && (!this.registry.tools || !this.registry.tools[node.primary_tool])) {
      return {
        valid: false,
        errors: [`Node '${nodeName}' requires tool '${node.primary_tool}' which is not available`]
      };
    }

    // Check node status
    if (node.status !== 'active') {
      return {
        valid: false,
        errors: [`Node '${nodeName}' is not active (status: ${node.status})`]
      };
    }

    console.log(`[HeadyValidator] ✅ Node '${nodeName}' validated`);
    return { valid: true, errors: [] };
  }

  /**
   * Validate workflow exists and file path is accessible
   */
  async validateWorkflow(workflowName) {
    console.log(`[HeadyValidator] Validating workflow: ${workflowName}`);

    // Check if workflow exists in registry
    if (!this.registry.workflows || !this.registry.workflows[workflowName]) {
      return {
        valid: false,
        errors: [`Workflow '${workflowName}' not found in registry`]
      };
    }

    const headyWorkflow = this.registry.workflows[workflowName];

    // Validate file path exists
    if (workflow.file_path) {
      try {
        await fs.access(workflow.file_path);
      } catch (err) {
        return {
          valid: false,
          errors: [`Workflow file '${workflow.file_path}' does not exist or is not accessible`]
        };
      }
    }

    console.log(`[HeadyValidator] ✅ Workflow '${workflowName}' validated`);
    return { valid: true, errors: [] };
  }

  /**
   * Validate tool exists and is executable
   */
  async validateTool(toolName) {
    console.log(`[HeadyValidator] Validating tool: ${toolName}`);

    // Check if tool exists in registry
    if (!this.registry.tools || !this.registry.tools[toolName]) {
      return {
        valid: false,
        errors: [`Tool '${toolName}' not found in registry`]
      };
    }

    const headyTool = this.registry.tools[toolName];

    // Check tool is executable
    if (tool.executable_path) {
      try {
        await fs.access(tool.executable_path, fs.constants.X_OK);
      } catch (err) {
        return {
          valid: false,
          errors: [`Tool executable '${tool.executable_path}' is not executable`]
        };
      }
    }

    console.log(`[HeadyValidator] ✅ Tool '${toolName}' validated`);
    return { valid: true, errors: [] };
  }

  /**
   * Validate service exists and endpoint is configured
   */
  async validateService(serviceName) {
    console.log(`[HeadyValidator] Validating service: ${serviceName}`);

    const headyValidation = { valid: true, warnings: [] };

    // Check if service exists in registry
    if (!this.registry.services || !this.registry.services[serviceName]) {
      validation.warnings.push(`Service '${serviceName}' not yet registered`);
      return validation;
    }

    const headyService = this.registry.services[serviceName];

    // Check service has endpoint
    if (!service.endpoint && !service.health_check_url) {
      validation.warnings.push(`Service '${serviceName}' has no configured endpoint`);
    }

    // Check service status
    if (service.status === 'unknown' || service.status === 'error') {
      validation.warnings.push(`Service '${serviceName}' status is '${service.status}'`);
    }

    console.log(`[HeadyValidator] ✅ Service '${serviceName}' validated`);
    return validation;
  }

  /**
   * Validate HeadyConductor workflow understanding
   */
  async validateConductorWorkflow(executionPlan, validationResult) {
    console.log('[HeadyValidator] Validating HeadyConductor workflow understanding...');

    // Check if execution plan follows conductor patterns
    if (!executionPlan.execution_strategy) {
      validationResult.warnings.push('No execution strategy specified for conductor');
    }

    // Validate conductor authority chain
    const headyRequiredComponents = ['brain', 'registry', 'lens', 'memory'];
    for (const headyComponent of requiredComponents) {
      if (!this.conductor[component]) {
        validationResult.errors.push(`HeadyConductor missing required component: ${component}`);
        validationResult.valid = false;
      }
    }

    console.log('[HeadyValidator] ✅ HeadyConductor workflow validated');
  }

  /**
   * Validate HeadySoul integration
   */
  async validateHeadySoulIntegration(executionPlan, validationResult) {
    console.log('[HeadyValidator] Validating HeadySoul integration...');

    // Check if HeadySoul is registered as a node
    if (!this.registry.nodes || !this.registry.nodes['HeadySoul']) {
      validationResult.warnings.push('HeadySoul node not registered in conductor');
    }

    // Check if HeadySoul service is available
    if (!this.registry.services || !this.registry.services['HeadySoul']) {
      validationResult.warnings.push('HeadySoul service not registered');
    }

    // Validate ML dependencies for HeadySoul
    const headySoulNode = this.registry.nodes?.['HeadySoul'];
    if (headySoulNode && headySoulNode.dependencies) {
      for (const headyDep of headySoulNode.dependencies) {
        try {
          require.resolve(dep);
        } catch (err) {
          validationResult.errors.push(`HeadySoul dependency '${dep}' not available`);
          validationResult.valid = false;
        }
      }
    }

    console.log('[HeadyValidator] ✅ HeadySoul integration validated');
  }

  /**
   * Attempt to auto-correct execution plan based on errors
   */
  async autoCorrectPlan(executionPlan, errors) {
    const headyCorrected = JSON.parse(JSON.stringify(executionPlan));
    
    console.log('[HeadyValidator] Auto-correction attempts:');

    for (const headyError of errors) {
      if (error.includes('not found in registry')) {
        const headyMissingItem = error.split("'")[1];
        const headySuggestions = await this.findSimilarItems(missingItem);
        
        if (suggestions.length > 0) {
          console.log(`  🔧 Auto-correcting: ${missingItem} → ${suggestions[0]}`);
          corrected = this.replaceInPlan(corrected, missingItem, suggestions[0]);
        }
      }
    }

    return corrected;
  }

  /**
   * Find similar items using fuzzy matching
   */
  async findSimilarItems(itemName) {
    const headyAllItems = [];
    
    if (this.registry.nodes) allItems.push(...Object.keys(this.registry.nodes));
    if (this.registry.workflows) allItems.push(...Object.keys(this.registry.workflows));
    if (this.registry.tools) allItems.push(...Object.keys(this.registry.tools));

    const headySimilarities = [];
    for (const headyAvailable of allItems) {
      const headyRatio = this.similarityRatio(itemName.toLowerCase(), available.toLowerCase());
      if (ratio > 0.7) {
        similarities.push([available, ratio]);
      }
    }

    return similarities
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([item]) => item);
  }

  /**
   * Calculate string similarity ratio
   */
  similarityRatio(a, b) {
    const headyMatches = Array.from(a).filter((char, i) => i < b.length && char === b[i]).length;
    return matches / Math.max(a.length, b.length);
  }

  /**
   * Replace item in execution plan
   */
  replaceInPlan(plan, oldItem, newItem) {
    const headyPlanStr = JSON.stringify(plan);
    const headyCorrectedStr = planStr.replace(new RegExp(`"${oldItem}"`, 'g'), `"${newItem}"`);
    return JSON.parse(correctedStr);
  }

  /**
   * Log validation results
   */
  logValidationResults(validationResult) {
    console.log('\n[HeadyValidator] VALIDATION RESULTS:');
    console.log(`[HeadyValidator] Status: ${validationResult.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`[HeadyValidator] Errors: ${validationResult.errors.length}`);
    console.log(`[HeadyValidator] Warnings: ${validationResult.warnings.length}`);

    if (validationResult.errors.length > 0) {
      console.log('\n[HeadyValidator] ERRORS:');
      validationResult.errors.forEach(error => {
        console.log(`  ❌ ${error}`);
      });
    }

    if (validationResult.warnings.length > 0) {
      console.log('\n[HeadyValidator] WARNINGS:');
      validationResult.warnings.forEach(warning => {
        console.log(`  ⚠️  ${warning}`);
      });
    }

    if (!validationResult.valid && this.autoCorrectionEnabled) {
      console.log('\n[HeadyValidator] AUTO-CORRECTION: Enabled');
    }

    console.log('[HeadyValidator] ══════════════════════════════════════════════════\n');
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      cacheSize: this.validationCache.size,
      autoCorrectionEnabled: this.autoCorrectionEnabled,
      strictMode: this.strictMode,
      validatorVersion: '1.0.0'
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    console.log('[HeadyValidator] Validation cache cleared');
  }
}

module.exports = HeadyValidator;
