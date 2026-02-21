
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadyValidator.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * 🛡️ HEADY VALIDATOR - PRE-EXECUTION ERROR CHECKING PROTOCOL
 * 
 * Critical node that activates BEFORE ANY execution to prevent false errors
 * Validates all operations before they execute to ensure system builds correctly
 */

const headyFs = require('fs').promises;
const headyPath = require('path');

class HeadyValidator {
  constructor(registry, promoter) {
    this.registry = registry;
    this.promoter = promoter;
    this.validationCache = new Map();
    this.errorPatterns = [];
    this.autoCorrectionEnabled = true;
    this.strictMode = false; // Set to true for production
    
    console.log('[HeadyValidator] Pre-execution validation protocol initialized');
  }

  /**
   * Validate entire execution plan before promoter proceeds
   */
  async validateExecutionPlan(executionPlan) {
    const headyValidationKey = JSON.stringify(executionPlan);
    
    // Check cache first
    if (this.validationCache.has(headyValidationKey)) {
      const headyCached = this.validationCache.get(headyValidationKey);
      console.log('[HeadyValidator] Using cached validation result');
      return headyCached;
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
        const headyNodeValidation = await this.validateNode(headyNodeInfo.name);
        if (!headyNodeValidation.valid) {
          headyValidationResult.errors.push(...headyNodeValidation.errors);
          headyValidationResult.valid = false;
        }
      }
    }

    // 2. Validate workflows are executable
    if (executionPlan.workflows_to_execute) {
      for (const headyWorkflowInfo of executionPlan.workflows_to_execute) {
        const headyWorkflowValidation = await this.validateWorkflow(headyWorkflowInfo.name);
        if (!headyWorkflowValidation.valid) {
          headyValidationResult.errors.push(...headyWorkflowValidation.errors);
          headyValidationResult.valid = false;
        }
      }
    }

    // 3. Validate tools are available
    if (executionPlan.tools_to_use) {
      for (const headyToolInfo of executionPlan.tools_to_use) {
        const headyToolValidation = await this.validateTool(headyToolInfo.name);
        if (!headyToolValidation.valid) {
          headyValidationResult.errors.push(...headyToolValidation.errors);
          headyValidationResult.valid = false;
        }
      }
    }

    // 4. Validate service endpoints are reachable
    if (executionPlan.services_required) {
      for (const headyServiceInfo of executionPlan.services_required) {
        const headyServiceValidation = await this.validateService(headyServiceInfo.name);
        if (!headyServiceValidation.valid) {
          headyValidationResult.warnings.push(...headyServiceValidation.warnings);
        }
      }
    }

    // 5. Validate Headypromoter workflow understanding
    await this.validatepromoterWorkflow(executionPlan, headyValidationResult);

    // 6. Validate HeadySoul integration
    await this.validateHeadySoulIntegration(executionPlan, headyValidationResult);

    // Auto-correction if enabled
    if (!headyValidationResult.valid && this.autoCorrectionEnabled) {
      console.log('[HeadyValidator] Attempting auto-correction...');
      headyValidationResult.correctedPlan = await this.autoCorrectPlan(
        executionPlan, 
        headyValidationResult.errors
      );
      
      // Re-validate corrected plan
      if (JSON.stringify(headyValidationResult.correctedPlan) !== JSON.stringify(executionPlan)) {
        console.log('[HeadyValidator] Re-validating corrected plan...');
        const headyRevalidation = await this.validateExecutionPlan(headyValidationResult.correctedPlan);
        headyValidationResult.correctedPlan = headyRevalidation.correctedPlan;
        headyValidationResult.valid = headyRevalidation.valid;
        headyValidationResult.errors = headyRevalidation.errors;
      }
    }

    // Cache result
    this.validationCache.set(headyValidationKey, headyValidationResult);

    // Log results
    this.logValidationResults(headyValidationResult);

    return headyValidationResult;
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
    if (headyNode.primary_tool && (!this.registry.tools || !this.registry.tools[headyNode.primary_tool])) {
      return {
        valid: false,
        errors: [`Node '${nodeName}' requires tool '${headyNode.primary_tool}' which is not available`]
      };
    }

    // Check node status
    if (headyNode.status !== 'active') {
      return {
        valid: false,
        errors: [`Node '${nodeName}' is not active (status: ${headyNode.status})`]
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
    if (headyWorkflow.file_path) {
      try {
        const headyFs = require('fs').promises;
        await headyFs.access(headyWorkflow.file_path);
      } catch (err) {
        return {
          valid: false,
          errors: [`Workflow file '${headyWorkflow.file_path}' does not exist or is not accessible`]
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
    if (headyTool.executable_path) {
      try {
        const headyFs = require('fs');
        await headyFs.promises.access(headyTool.executable_path, headyFs.constants.X_OK);
      } catch (err) {
        return {
          valid: false,
          errors: [`Tool executable '${headyTool.executable_path}' is not executable`]
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
      headyValidation.warnings.push(`Service '${serviceName}' not yet registered`);
      return headyValidation;
    }

    const headyService = this.registry.services[serviceName];

    // Check service has endpoint
    if (!headyService.endpoint && !headyService.health_check_url) {
      headyValidation.warnings.push(`Service '${serviceName}' has no configured endpoint`);
    }

    // Check service status
    if (headyService.status === 'unknown' || headyService.status === 'error') {
      headyValidation.warnings.push(`Service '${serviceName}' status is '${headyService.status}'`);
    }

    console.log(`[HeadyValidator] ✅ Service '${serviceName}' validated`);
    return headyValidation;
  }

  /**
   * Validate Headypromoter workflow understanding
   */
  async validatepromoterWorkflow(executionPlan, validationResult) {
    console.log('[HeadyValidator] Validating Headypromoter workflow understanding...');

    // Check if execution plan follows promoter patterns
    if (!executionPlan.execution_strategy) {
      validationResult.warnings.push('No execution strategy specified for promoter');
    }

    // Validate promoter authority chain
    const headyRequiredComponents = ['brain', 'registry', 'lens', 'memory'];
    for (const headyComponent of headyRequiredComponents) {
      if (!this.promoter[headyComponent]) {
        validationResult.errors.push(`Headypromoter missing required component: ${headyComponent}`);
        validationResult.valid = false;
      }
    }

    console.log('[HeadyValidator] ✅ Headypromoter workflow validated');
  }

  /**
   * Validate HeadySoul integration
   */
  async validateHeadySoulIntegration(executionPlan, validationResult) {
    console.log('[HeadyValidator] Validating HeadySoul integration...');

    // Check if HeadySoul is registered as a node
    if (!this.registry.nodes || !this.registry.nodes['HeadySoul']) {
      validationResult.warnings.push('HeadySoul node not registered in promoter');
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
          require.resolve(headyDep);
        } catch (err) {
          validationResult.errors.push(`HeadySoul dependency '${headyDep}' not available`);
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
    let headyCorrected = JSON.parse(JSON.stringify(executionPlan));
    
    console.log('[HeadyValidator] Auto-correction attempts:');

    for (const headyError of errors) {
      if (headyError.includes('not found in registry')) {
        const headyMissingItem = headyError.split("'")[1];
        const headySuggestions = await this.findSimilarItems(headyMissingItem);
        
        if (headySuggestions.length > 0) {
          console.log(`  🔧 Auto-correcting: ${headyMissingItem} → ${headySuggestions[0]}`);
          headyCorrected = this.replaceInPlan(headyCorrected, headyMissingItem, headySuggestions[0]);
        }
      }
    }

    return headyCorrected;
  }

  /**
   * Find similar items using fuzzy matching
   */
  async findSimilarItems(itemName) {
    const headyAllItems = [];
    
    if (this.registry.nodes) headyAllItems.push(...Object.keys(this.registry.nodes));
    if (this.registry.workflows) headyAllItems.push(...Object.keys(this.registry.workflows));
    if (this.registry.tools) headyAllItems.push(...Object.keys(this.registry.tools));

    const headySimilarities = [];
    for (const headyAvailable of headyAllItems) {
      const headyRatio = this.similarityRatio(itemName.toLowerCase(), headyAvailable.toLowerCase());
      if (headyRatio > 0.7) {
        headySimilarities.push([headyAvailable, headyRatio]);
      }
    }

    return headySimilarities
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([item]) => item);
  }

  /**
   * Calculate string similarity ratio
   */
  similarityRatio(a, b) {
    const headyMatches = Array.from(a).filter((char, i) => i < b.length && char === b[i]).length;
    return headyMatches / Math.max(a.length, b.length);
  }

  /**
   * Replace item in execution plan
   */
  replaceInPlan(plan, oldItem, newItem) {
    const headyPlanStr = JSON.stringify(plan);
    const headyCorrectedStr = headyPlanStr.replace(new RegExp(`"${oldItem}"`, 'g'), `"${newItem}"`);
    return JSON.parse(headyCorrectedStr);
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
