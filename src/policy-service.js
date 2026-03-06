/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * PolicyService — Centralized provider for Policy and Budget Engines.
 */

const PolicyEngine = require("./policy-engine");
const BudgetService = require("./services/budget-service");

// Initialize singletons
const budgetService = new BudgetService();
const policyEngine = new PolicyEngine({ budgetService });

module.exports = {
    policyEngine,
    budgetService
};
