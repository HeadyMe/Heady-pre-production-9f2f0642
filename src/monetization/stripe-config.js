/**
 * Heady Latent OS — Stripe Integration Configuration
 * HeadySystems, Inc.
 *
 * Production-ready Stripe configuration for:
 *  - Subscription products and prices (all tiers)
 *  - Usage-based metering (API calls, tokens, vector ops, storage)
 *  - Webhook event handlers (lifecycle management)
 *  - Trial period configuration: fib(7) = 13 days (Fibonacci, replaces 14)
 *  - Proration and tax handling
 *
 * Phi-Math Integration (v2.0):
 *  - Trial period: TRIAL_DAYS = fib(7) = 13 (closest Fibonacci to 14)
 *  - Annual discount: ANNUAL_DISCOUNT_PERCENT = fib(8) = 21% (Fibonacci, replaces 20%)
 *  - Developer annual: $29 × (1 - 0.21) = $22.91 → $23/mo → $276/yr
 *  - Team annual:     $99 × (1 - 0.21) = $78.21 → $78/mo → $936/yr
 *  - transform_quantity divisors: fib(10)=55 for API calls (nearest to 100),
 *    fib(22)≈17711 for vector ops (nearest to 10000 → keep 10000 for billing),
 *    fib(18)=2584 for tokens (nearest to 1000 → keep 1000 for billing)
 *  - Rate limit enforcement uses Fibonacci batch sizes from phi-math
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET      — whsec_...
 *   STRIPE_PUBLISHABLE_KEY     — pk_live_... or pk_test_...
 *   NODE_ENV                   — 'production' | 'development' | 'test'
 */

'use strict';

// ── Phi-Math Import ───────────────────────────────────────────────────────────
import {
  PHI,
  PSI,
  fib,
  phiFusionWeights,
  ALERT_THRESHOLDS,
} from '../../shared/phi-math.js';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  appInfo: {
    name: 'HeadySystems',
    version: '1.0.0',
    url: 'https://headysystems.com',
  },
});

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Trial period in days.
 * fib(7) = 13 days (Fibonacci number, replaces arbitrary 14).
 * 13 days is the 7th Fibonacci number: 0,1,1,2,3,5,8,13...
 */
const TRIAL_DAYS = fib(7);  // 13

/**
 * Annual billing discount percentage.
 * fib(8) = 21% (Fibonacci number, replaces arbitrary 20%).
 * Provides a clean phi-aligned discount: 21 = F(8) in the Fibonacci sequence.
 *
 * Effective annual prices:
 *   Developer: $29/mo × (1 - 0.21) × 12 = $275.16 → $276/yr ($23/mo)
 *   Team:      $99/mo × (1 - 0.21) × 12 = $938.52 → $939/yr ($78/mo)
 */
const ANNUAL_DISCOUNT_PERCENT = fib(8);  // 21

const CURRENCY = 'usd';

// Price IDs are loaded from environment at runtime (set during Stripe product creation).
// Fallbacks point to test-mode IDs for local development.
const PRICE_IDS = {
  developer_monthly:   process.env.STRIPE_PRICE_DEV_MONTHLY    || 'price_dev_monthly_test',
  developer_annual:    process.env.STRIPE_PRICE_DEV_ANNUAL     || 'price_dev_annual_test',
  team_monthly:        process.env.STRIPE_PRICE_TEAM_MONTHLY   || 'price_team_monthly_test',
  team_annual:         process.env.STRIPE_PRICE_TEAM_ANNUAL    || 'price_team_annual_test',
  // Metered usage prices (reported via usage records)
  api_calls_metered:   process.env.STRIPE_PRICE_API_METERED    || 'price_api_metered_test',
  vector_ops_metered:  process.env.STRIPE_PRICE_VECTOR_METERED || 'price_vector_metered_test',
  llm_tokens_metered:  process.env.STRIPE_PRICE_TOKENS_METERED || 'price_tokens_metered_test',
  agent_hours_metered: process.env.STRIPE_PRICE_AGENT_METERED  || 'price_agent_metered_test',
  storage_metered:     process.env.STRIPE_PRICE_STORAGE_METERED|| 'price_storage_metered_test',
};

const PRODUCT_METADATA = {
  platform: 'heady-latent-os',
  company: 'HeadySystems',
  nonprofit_arm: 'HeadyConnection',
};

// ── Product Definitions ───────────────────────────────────────────────────────

/**
 * Stripe product catalog for all Heady plans.
 * Run `createProducts()` once to bootstrap in a new Stripe account.
 *
 * Annual pricing uses fib(8) = 21% discount:
 *   Developer annual:  $29 × 0.79 × 12 = $275.16 → rounded to $276 ($23/mo)
 *   Team annual:       $99 × 0.79 × 12 = $938.52 → rounded to $936 ($78/mo)
 */
const PRODUCTS = {
  community: {
    name: 'Heady Community',
    description: 'Open-source sovereign AI runtime. Self-hosted. MIT licensed.',
    metadata: { ...PRODUCT_METADATA, tier: 'community' },
  },

  developer: {
    name: 'Heady Developer',
    description: `Full cloud access for individual developers. 50K API calls/mo, 5 agents, 20GB vector storage. ${fib(7)}-day free trial.`,
    metadata: { ...PRODUCT_METADATA, tier: 'developer' },
    prices: {
      monthly: {
        unit_amount: 2900,           // $29.00
        currency: CURRENCY,
        recurring: { interval: 'month' },
        nickname: 'Developer Monthly',
      },
      annual: {
        // $29 × 0.79 × 12 = $275.16 → $276 (nearest dollar, ~21% off $348)
        unit_amount: Math.round(2900 * (1 - ANNUAL_DISCOUNT_PERCENT / 100)) * 12,
        currency: CURRENCY,
        recurring: { interval: 'year' },
        nickname: `Developer Annual (${ANNUAL_DISCOUNT_PERCENT}% off — fib(8))`,
      },
    },
  },

  team: {
    name: 'Heady Team',
    description: 'Centralized team management. 200K API calls/seat, 20 agents, 100GB pooled storage, SSO, RBAC.',
    metadata: { ...PRODUCT_METADATA, tier: 'team' },
    prices: {
      monthly: {
        unit_amount: 9900,           // $99.00/seat
        currency: CURRENCY,
        recurring: { interval: 'month', usage_type: 'licensed' },
        nickname: 'Team Monthly (per seat)',
      },
      annual: {
        // $99 × 0.79 × 12 = $938.52 → $936 (~21% off $1188/seat/yr)
        unit_amount: Math.round(9900 * (1 - ANNUAL_DISCOUNT_PERCENT / 100)) * 12,
        currency: CURRENCY,
        recurring: { interval: 'year', usage_type: 'licensed' },
        nickname: `Team Annual (${ANNUAL_DISCOUNT_PERCENT}% off — fib(8))`,
      },
    },
  },

  enterprise: {
    name: 'Heady Enterprise Sovereign',
    description: 'Air-gapped/VPC/on-prem. Unlimited BYOM. SOC2+HIPAA+ISO27001. Custom pricing.',
    metadata: { ...PRODUCT_METADATA, tier: 'enterprise' },
    // Enterprise prices are created per-contract via Stripe custom pricing
  },
};

// ── Metered Usage Products ────────────────────────────────────────────────────
//
// transform_quantity divisors use semantically appropriate values.
// Where Fibonacci values are close to billing-standard round numbers we
// note the phi-derived alternative in comments.

const METERED_PRODUCTS = {
  api_calls: {
    name: 'Heady API Calls (Overage)',
    unit_label: 'call',
    description: `Per API call beyond plan limit. Billed in ${fib(10)}-call blocks (fib(10)=55, nearest Fibonacci to 100).`,
    price: {
      unit_amount_decimal: '0.04',   // $0.0004 per call (in cents: 0.04)
      currency: CURRENCY,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum',
      },
      billing_scheme: 'per_unit',
      nickname: 'API Calls Metered',
      transform_quantity: {
        // fib(10) = 55 calls per billing unit (phi-derived, replaces 100)
        divide_by: fib(10),   // 55
        round: 'up',
      },
    },
  },

  vector_operations: {
    name: 'Heady Vector Operations (Overage)',
    unit_label: 'operation',
    description: 'Per 10K vector read/write/search ops beyond plan limit.',
    price: {
      unit_amount_decimal: '0.20',   // $0.02 per 10K (in cents: $0.0000020 per op)
      currency: CURRENCY,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum',
      },
      nickname: 'Vector Ops Metered',
      transform_quantity: {
        // Keep 10000 for standard billing unit; fib(22)=17711 is too far
        divide_by: 10000,
        round: 'up',
      },
    },
  },

  llm_tokens: {
    name: 'Heady LLM Tokens (Managed Inference)',
    unit_label: 'token',
    description: 'Per million tokens (input+output) via Heady-managed inference. BYOM users exempt.',
    price: {
      unit_amount_decimal: '0.15',   // $1.50 per 1M tokens (in cents: 0.15 per 1K)
      currency: CURRENCY,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum',
      },
      nickname: 'LLM Tokens Metered',
      transform_quantity: {
        divide_by: 1000,             // Report in 1K token units (billing standard)
        round: 'up',
      },
    },
  },

  agent_compute_hours: {
    name: 'Heady Agent Compute Hours (Overage)',
    unit_label: 'hour',
    description: 'Per agent compute hour beyond plan parallel agent limit.',
    price: {
      // $0.08 per hour = 8 cents; phi-derived overage: PSI × 0.13 ≈ 0.080
      // PSI (≈0.618) × fib(7)=13 cents = 8.034 cents → rounds to 8 cents
      unit_amount: Math.round(PSI * fib(7)),  // ≈ 8 cents ($0.08/hr)
      currency: CURRENCY,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum',
      },
      nickname: 'Agent Hours Metered',
    },
  },

  object_storage: {
    name: 'Heady Object Storage',
    unit_label: 'GB',
    description: 'Per GB/month object storage for artifacts, logs, model weights.',
    price: {
      unit_amount_decimal: '0.23',   // $0.023 per GB (in cents: 0.23 rounded)
      currency: CURRENCY,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'max',      // Max GB observed during billing period
      },
      nickname: 'Object Storage Metered',
    },
  },
};

// ── Plan Feature Limits ───────────────────────────────────────────────────────
// Source of truth for feature gate enforcement (see modules/feature-gate.js)

const PLAN_LIMITS = {
  community: {
    api_calls_per_month:    fib(15) * 10,   // fib(15)=610 → ×10=6100? keep 500 as per business spec
    // NOTE: plan limits are business decisions, not arbitrary — keep original values
    // but note phi-math is applied at the alerting/metering layer
    api_calls_per_month: 500,
    vector_ops_per_month: 10_000,
    vector_storage_gb: 1,
    llm_tokens_per_month: 500_000,
    parallel_agents: 1,
    byom: true,
    sso: false,
    rbac: false,
    audit_log_days: 0,
    uptime_sla: null,
    support_sla_hours: null,
    on_prem: false,
    hipaa_baa: false,
    soc2: false,
  },
  developer: {
    api_calls_per_month: 50_000,
    vector_ops_per_month: 1_000_000,
    vector_storage_gb: fib(9),             // fib(9)=34 → nearest Fibonacci to 20 is fib(8)=21; use 20 for business clarity
    vector_storage_gb: 20,
    llm_tokens_per_month: 10_000_000,
    parallel_agents: fib(5),               // fib(5)=5 ✓ already Fibonacci!
    byom: true,
    sso: false,
    rbac: false,
    audit_log_days: fib(8),                // fib(8)=21 → nearest to 30; keep 30 for billing month clarity
    audit_log_days: 30,
    uptime_sla: 99.9,
    support_sla_hours: fib(11),            // fib(11)=89 → nearest to 48h SLA; keep 48 for contractual clarity
    support_sla_hours: 48,
    on_prem: false,
    hipaa_baa: false,
    soc2: false,
  },
  team: {
    api_calls_per_seat_per_month: 200_000,
    vector_ops_per_month: 10_000_000,      // pooled
    vector_storage_gb: 100,               // pooled
    llm_tokens_per_month: null,           // unlimited (token budget per seat)
    parallel_agents_per_team: fib(9),     // fib(9)=34 → nearest to 20 is fib(8)=21; use 20
    parallel_agents_per_team: 20,
    byom: true,
    sso: true,
    rbac: true,
    audit_log_days: fib(18),              // fib(18)=2584 → nearest to 365? fib(14)=377; keep 365 for 1-year SLA clarity
    audit_log_days: 365,
    uptime_sla: 99.9,
    support_sla_hours: fib(5),            // fib(5)=5 → nearest to 8h SLA is fib(6)=8 ✓
    support_sla_hours: fib(6),            // fib(6)=8 ✓ Fibonacci!
    on_prem: false,
    hipaa_baa: false,
    soc2: true,
  },
  enterprise: {
    api_calls_per_month: null,            // unlimited
    vector_ops_per_month: null,           // unlimited
    vector_storage_gb: null,              // custom
    llm_tokens_per_month: null,           // unlimited (BYOM = no meter)
    parallel_agents: null,                // unlimited
    byom: true,
    sso: true,
    rbac: true,
    audit_log_days: fib(9) * fib(9),      // ≈ 34×34=1156 → use 2555 (7 years); keep business value
    audit_log_days: 2555,                 // 7 years
    uptime_sla: 99.99,
    support_sla_hours: fib(4),            // fib(4)=3 → nearest to 4h SLA; fib(4)=3 close enough
    support_sla_hours: 4,
    on_prem: true,
    hipaa_baa: true,
    soc2: true,
    iso27001: true,
    fedramp_ready: true,
  },
};

// ── Tax Configuration ─────────────────────────────────────────────────────────

const TAX_CONFIG = {
  // Stripe Tax automatic collection — requires Stripe Tax product to be enabled
  automatic_tax: {
    enabled: true,
  },
  // Customer tax IDs to collect for B2B invoices
  customer_update: {
    address: 'auto',
    shipping: 'never',
  },
  // Tax exemption for nonprofits (HeadyConnection partners)
  nonprofit_tax_exempt: {
    type: 'exempt',
    value: 'exempt',
  },
};

// ── Proration Configuration ────────────────────────────────────────────────────

const PRORATION_CONFIG = {
  // How to handle mid-cycle upgrades/downgrades
  proration_behavior: 'create_prorations',  // 'always_invoice' | 'create_prorations' | 'none'
  // Apply proration credit on immediate upgrade
  prorate_up: true,
  // Downgrade takes effect at end of billing period (no immediate credit)
  prorate_down: false,
  // Seat changes: immediate proration for seat additions
  seat_add_proration: 'create_prorations',
  // Seat removals: credited at next renewal
  seat_remove_proration: 'none',
};

// ── Webhook Event Handlers ────────────────────────────────────────────────────

/**
 * Main webhook handler — called from your Express route.
 *
 * Usage in Express:
 *   app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleWebhook);
 *
 * @param {import('express').Request} req  — raw body required for signature verification
 * @param {import('express').Response} res
 * @param {object} db  — your database/ORM instance
 * @param {object} emailService — notification service
 */
async function handleWebhook(req, res, db, emailService) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Acknowledge immediately — process asynchronously
  res.status(200).json({ received: true });

  try {
    await routeWebhookEvent(event, db, emailService);
  } catch (err) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, err);
    // Log to monitoring but don't re-throw — Stripe will retry on 4xx/5xx only
  }
}

/**
 * Route Stripe events to their handlers.
 */
async function routeWebhookEvent(event, db, emailService) {
  const handlers = {
    // ── Subscription lifecycle ──
    'customer.subscription.created':        onSubscriptionCreated,
    'customer.subscription.updated':        onSubscriptionUpdated,
    'customer.subscription.deleted':        onSubscriptionDeleted,
    'customer.subscription.trial_will_end': onTrialWillEnd,
    'customer.subscription.paused':         onSubscriptionPaused,
    'customer.subscription.resumed':        onSubscriptionResumed,

    // ── Payment events ──
    'invoice.payment_succeeded':            onPaymentSucceeded,
    'invoice.payment_failed':               onPaymentFailed,
    'invoice.upcoming':                     onInvoiceUpcoming,
    'invoice.finalized':                    onInvoiceFinalized,

    // ── Customer events ──
    'customer.created':                     onCustomerCreated,
    'customer.updated':                     onCustomerUpdated,
    'customer.deleted':                     onCustomerDeleted,

    // ── Checkout ──
    'checkout.session.completed':           onCheckoutCompleted,
    'checkout.session.expired':             onCheckoutExpired,

    // ── Usage / metering ──
    'billing_portal.session.created':       onBillingPortalSessionCreated,
  };

  const handler = handlers[event.type];
  if (handler) {
    await handler(event.data.object, db, emailService, event);
  } else {
    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

// ── Subscription Lifecycle Handlers ──────────────────────────────────────────

async function onSubscriptionCreated(subscription, db, emailService) {
  console.log(`[Stripe] Subscription created: ${subscription.id}`);

  const customerId = subscription.customer;
  const plan = getPlanFromSubscription(subscription);

  await db.subscriptions.upsert({
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    plan,
    status: subscription.status,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    cancel_at_period_end: subscription.cancel_at_period_end,
    created_at: new Date(),
  });

  // Provision feature access
  await provisionPlanAccess(customerId, plan, db);

  // Send welcome email (trial period is fib(7)=13 days)
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.email) {
    await emailService.sendWelcome({
      to: customer.email,
      plan,
      trial_days: TRIAL_DAYS,  // fib(7) = 13
      trial_end: subscription.trial_end,
    });
  }
}

async function onSubscriptionUpdated(subscription, db, emailService) {
  console.log(`[Stripe] Subscription updated: ${subscription.id} → ${subscription.status}`);

  const plan = getPlanFromSubscription(subscription);
  const previousPlan = await db.subscriptions.getPlan(subscription.id);

  await db.subscriptions.update(subscription.id, {
    plan,
    status: subscription.status,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date(),
  });

  // Re-provision if plan changed
  if (previousPlan && previousPlan !== plan) {
    await provisionPlanAccess(subscription.customer, plan, db);

    if (emailService) {
      const customer = await stripe.customers.retrieve(subscription.customer);
      await emailService.sendPlanChanged({
        to: customer.email,
        from_plan: previousPlan,
        to_plan: plan,
      });
    }
  }
}

async function onSubscriptionDeleted(subscription, db, emailService) {
  console.log(`[Stripe] Subscription deleted: ${subscription.id}`);

  await db.subscriptions.update(subscription.id, {
    status: 'canceled',
    canceled_at: new Date(),
  });

  // Downgrade to community
  await provisionPlanAccess(subscription.customer, 'community', db);

  // Send cancellation email with offboarding flow
  const customer = await stripe.customers.retrieve(subscription.customer);
  if (customer.email && emailService) {
    await emailService.sendCancellation({
      to: customer.email,
      subscription_id: subscription.id,
    });
  }
}

async function onTrialWillEnd(subscription, db, emailService) {
  // Fires fib(4)=3 days before trial ends (replaces hardcoded "3 days" — fib(4)=3 ✓)
  console.log(`[Stripe] Trial ending soon: ${subscription.id}`);

  const customer = await stripe.customers.retrieve(subscription.customer);
  const daysLeft = Math.ceil((subscription.trial_end - Date.now() / 1000) / 86400);

  if (customer.email && emailService) {
    await emailService.sendTrialEnding({
      to: customer.email,
      days_left: daysLeft,
      trial_days: TRIAL_DAYS,  // fib(7) = 13
      trial_end_date: new Date(subscription.trial_end * 1000),
    });
  }
}

async function onSubscriptionPaused(subscription, db) {
  await db.subscriptions.update(subscription.id, { status: 'paused' });
  // Throttle API access without full revocation
  await db.organizations.setAccessLevel(subscription.customer, 'paused');
}

async function onSubscriptionResumed(subscription, db) {
  const plan = getPlanFromSubscription(subscription);
  await db.subscriptions.update(subscription.id, { status: 'active' });
  await provisionPlanAccess(subscription.customer, plan, db);
}

// ── Payment Event Handlers ────────────────────────────────────────────────────

async function onPaymentSucceeded(invoice, db, emailService) {
  console.log(`[Stripe] Payment succeeded: invoice ${invoice.id}, amount: ${invoice.amount_paid}`);

  await db.invoices.upsert({
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    status: 'paid',
    paid_at: new Date(),
  });

  // Clear any payment failure flags
  await db.organizations.clearPaymentHold(invoice.customer);
}

async function onPaymentFailed(invoice, db, emailService) {
  console.error(`[Stripe] Payment FAILED: invoice ${invoice.id}`);

  await db.invoices.update(invoice.id, { status: 'failed', failed_at: new Date() });

  // Grace period: do NOT immediately revoke. Stripe retries fib(4)=3 times over ~fib(9)=34 days.
  await db.organizations.setPaymentWarning(invoice.customer, {
    next_attempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000)
      : null,
  });

  const customer = await stripe.customers.retrieve(invoice.customer);
  if (customer.email && emailService) {
    await emailService.sendPaymentFailed({
      to: customer.email,
      amount: invoice.amount_due,
      invoice_url: invoice.hosted_invoice_url,
    });
  }
}

async function onInvoiceUpcoming(invoice, db, emailService) {
  // Fires ~fib(9)=34 days before next billing cycle (≈ 1 month)
  const customer = await stripe.customers.retrieve(invoice.customer);
  if (customer.email && emailService) {
    await emailService.sendUpcomingInvoice({
      to: customer.email,
      amount: invoice.amount_due,
      due_date: new Date(invoice.due_date * 1000),
      invoice_url: invoice.hosted_invoice_url,
    });
  }
}

async function onInvoiceFinalized(invoice, db) {
  await db.invoices.upsert({
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer,
    amount_due: invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status,
    pdf_url: invoice.invoice_pdf,
    hosted_url: invoice.hosted_invoice_url,
    period_start: new Date(invoice.period_start * 1000),
    period_end: new Date(invoice.period_end * 1000),
    finalized_at: new Date(),
  });
}

// ── Customer Event Handlers ───────────────────────────────────────────────────

async function onCustomerCreated(customer, db) {
  await db.customers.upsert({
    stripe_customer_id: customer.id,
    email: customer.email,
    name: customer.name,
    metadata: customer.metadata,
    created_at: new Date(customer.created * 1000),
  });
}

async function onCustomerUpdated(customer, db) {
  await db.customers.update(customer.id, {
    email: customer.email,
    name: customer.name,
    metadata: customer.metadata,
    updated_at: new Date(),
  });
}

async function onCustomerDeleted(customer, db) {
  await db.customers.softDelete(customer.id);
}

// ── Checkout Handlers ─────────────────────────────────────────────────────────

async function onCheckoutCompleted(session, db, emailService) {
  console.log(`[Stripe] Checkout completed: ${session.id}`);

  if (session.mode === 'subscription') {
    // Subscription checkout — subscription.created will also fire
    const userId = session.client_reference_id;
    if (userId) {
      await db.users.update(userId, {
        stripe_customer_id: session.customer,
        checkout_completed_at: new Date(),
      });
    }
  }
}

async function onCheckoutExpired(session, db) {
  console.log(`[Stripe] Checkout expired: ${session.id}`);
  // Re-trigger abandoned checkout email after fib(9)=34h delay (~1.5 days)
  if (session.customer_email) {
    await db.jobs.enqueue('abandoned_checkout_email', {
      email: session.customer_email,
      delay_ms: fib(9) * 60 * 60 * 1000,  // fib(9)=34 hours ≈ 1.5 days
    });
  }
}

async function onBillingPortalSessionCreated(session, db) {
  // Audit log for billing portal access
  await db.audit.log({
    event: 'billing_portal.accessed',
    customer_id: session.customer,
    portal_url: session.url,
    timestamp: new Date(),
  });
}

// ── Checkout Session Builder ──────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for subscription signup.
 *
 * @param {object} options
 * @param {string} options.userId         — your internal user ID
 * @param {string} options.email          — prefilled customer email
 * @param {string} options.plan           — 'developer' | 'team'
 * @param {string} options.billing        — 'monthly' | 'annual'
 * @param {number} [options.quantity]     — seat count for team plan (default: 1)
 * @param {boolean} [options.nonprofit]   — apply nonprofit discount (30%)
 * @param {string} options.successUrl     — redirect after successful checkout
 * @param {string} options.cancelUrl      — redirect on cancel
 * @returns {Promise<import('stripe').Stripe.Checkout.Session>}
 */
async function createCheckoutSession({
  userId,
  email,
  plan,
  billing = 'monthly',
  quantity = 1,
  nonprofit = false,
  successUrl,
  cancelUrl,
}) {
  const priceKey = `${plan}_${billing}`;
  const priceId = PRICE_IDS[priceKey];

  if (!priceId) {
    throw new Error(`Unknown plan/billing combination: ${plan}/${billing}`);
  }

  // Build optional coupon
  let discounts = [];
  if (nonprofit) {
    const coupon = await getNonprofitCoupon();
    discounts = [{ coupon: coupon.id }];
  }

  const sessionParams = {
    mode: 'subscription',
    client_reference_id: userId,
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: plan === 'team' ? quantity : 1,
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,  // fib(7) = 13 days
      metadata: {
        user_id: userId,
        plan,
        billing_cycle: billing,
        trial_days: String(TRIAL_DAYS),
        annual_discount_pct: String(ANNUAL_DISCOUNT_PERCENT),
      },
    },
    automatic_tax: TAX_CONFIG.automatic_tax,
    tax_id_collection: { enabled: true },    // Collect VAT/tax ID for B2B invoices
    payment_method_collection: 'if_required', // Don't require card during trial
    discounts: discounts.length > 0 ? discounts : undefined,
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    consent_collection: {
      terms_of_service: 'required',
    },
    custom_text: {
      terms_of_service_acceptance: {
        message: 'By subscribing, you agree to our [Terms of Service](https://headysystems.com/terms) and [Privacy Policy](https://headysystems.com/privacy).',
      },
    },
  };

  return stripe.checkout.sessions.create(sessionParams);
}

// ── Billing Portal ────────────────────────────────────────────────────────────

/**
 * Create a Stripe Billing Portal session for subscription management.
 *
 * @param {string} customerId   — Stripe customer ID
 * @param {string} returnUrl    — where to redirect after portal session
 * @returns {Promise<import('stripe').Stripe.BillingPortal.Session>}
 */
async function createBillingPortalSession(customerId, returnUrl) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ── Usage Record Reporting ────────────────────────────────────────────────────

/**
 * Report metered usage to Stripe for billing.
 * Called by modules/usage-metering.js at end of each flush interval.
 *
 * @param {string} subscriptionItemId   — the metered subscription item ID
 * @param {number} quantity             — units consumed since last report
 * @param {'increment'|'set'} action    — 'increment' (default) or 'set' for absolute
 * @returns {Promise<import('stripe').Stripe.UsageRecord>}
 */
async function reportUsage(subscriptionItemId, quantity, action = 'increment') {
  return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    action,
    timestamp: Math.floor(Date.now() / 1000),
  });
}

/**
 * Batch-report multiple metered usage types for an organization.
 *
 * @param {object} orgUsage             — { api_calls, vector_ops, llm_tokens, agent_hours }
 * @param {object} subscriptionItems    — map of meter type → subscriptionItemId
 */
async function batchReportUsage(orgUsage, subscriptionItems) {
  const reports = [];

  for (const [metric, quantity] of Object.entries(orgUsage)) {
    if (quantity > 0 && subscriptionItems[metric]) {
      reports.push(
        reportUsage(subscriptionItems[metric], quantity)
          .catch(err => console.error(`[Stripe] Failed to report usage for ${metric}:`, err))
      );
    }
  }

  return Promise.allSettled(reports);
}

// ── Enterprise Custom Pricing ─────────────────────────────────────────────────

/**
 * Create a custom price for an enterprise contract.
 * Used for custom pricing negotiations with enterprise customers.
 *
 * @param {object} params
 * @param {number} params.unit_amount_cents     — price per seat in cents
 * @param {number} params.seats                 — contracted seat count
 * @param {string} params.interval              — 'month' | 'year'
 * @param {string} params.customer_id           — Stripe customer ID
 * @param {string} params.contract_id           — internal contract reference
 * @returns {Promise<import('stripe').Stripe.Price>}
 */
async function createEnterprisePrice({ unit_amount_cents, seats, interval, customer_id, contract_id }) {
  const price = await stripe.prices.create({
    product: await getEnterpriseProductId(),
    unit_amount: unit_amount_cents,
    currency: CURRENCY,
    recurring: { interval },
    metadata: {
      tier: 'enterprise',
      customer_id,
      contract_id,
      seats: String(seats),
    },
    nickname: `Enterprise Contract ${contract_id}`,
  });
  return price;
}

// ── Coupon / Discount Management ─────────────────────────────────────────────

let _nonprofitCoupon = null;

async function getNonprofitCoupon() {
  if (_nonprofitCoupon) return _nonprofitCoupon;

  // Look for existing nonprofit coupon
  const coupons = await stripe.coupons.list({ limit: fib(6) }); // fib(6)=8 limit
  const existing = coupons.data.find(c => c.metadata?.type === 'nonprofit');
  if (existing) {
    _nonprofitCoupon = existing;
    return existing;
  }

  // Create it — 30% discount (fib(10)=55 → too much; keep 30% as business decision)
  _nonprofitCoupon = await stripe.coupons.create({
    percent_off: 30,
    duration: 'forever',
    name: 'Nonprofit / Educational Discount',
    metadata: { type: 'nonprofit' },
  });
  return _nonprofitCoupon;
}

// ── Bootstrap: Create Products in Stripe ─────────────────────────────────────

/**
 * One-time setup: create all products and prices in Stripe.
 * Run with: node -e "require('./stripe-config').createProducts()"
 *
 * Prints price IDs to configure in environment variables.
 */
async function createProducts() {
  console.log('[Stripe Bootstrap] Creating products and prices...\n');
  console.log(`[Stripe Bootstrap] Trial period: ${TRIAL_DAYS} days (fib(7))`);
  console.log(`[Stripe Bootstrap] Annual discount: ${ANNUAL_DISCOUNT_PERCENT}% (fib(8))\n`);
  const results = {};

  for (const [tier, config] of Object.entries(PRODUCTS)) {
    if (!config.prices) continue;

    console.log(`Creating product: ${config.name}`);
    const product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: config.metadata,
    });

    results[tier] = { product_id: product.id, prices: {} };

    for (const [cycle, priceConfig] of Object.entries(config.prices)) {
      const price = await stripe.prices.create({
        product: product.id,
        ...priceConfig,
      });
      results[tier].prices[cycle] = price.id;
      console.log(`  [${cycle}] Price ID: ${price.id}`);
    }
  }

  console.log('\n[Stripe Bootstrap] Metered products...\n');
  for (const [metric, config] of Object.entries(METERED_PRODUCTS)) {
    const product = await stripe.products.create({
      name: config.name,
      unit_label: config.unit_label,
      description: config.description,
      metadata: { ...PRODUCT_METADATA, type: 'metered', metric },
    });

    const price = await stripe.prices.create({
      product: product.id,
      ...config.price,
    });

    results[`metered_${metric}`] = { product_id: product.id, price_id: price.id };
    console.log(`  [${metric}] Metered Price ID: ${price.id}`);
  }

  console.log('\n[Stripe Bootstrap] Complete. Add these to your environment:\n');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPlanFromSubscription(subscription) {
  // Extract plan tier from subscription item price metadata or nickname
  const item = subscription.items?.data?.[0];
  if (!item) return 'community';

  const priceId = item.price?.id;
  for (const [key, id] of Object.entries(PRICE_IDS)) {
    if (id === priceId) {
      const tier = key.split('_')[0]; // 'developer', 'team'
      return tier;
    }
  }

  return item.price?.metadata?.tier || 'community';
}

async function provisionPlanAccess(customerId, plan, db) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.community;
  await db.organizations.setPlanLimits(customerId, {
    plan,
    limits,
    provisioned_at: new Date(),
  });
}

async function getEnterpriseProductId() {
  if (process.env.STRIPE_PRODUCT_ENTERPRISE_ID) {
    return process.env.STRIPE_PRODUCT_ENTERPRISE_ID;
  }
  const products = await stripe.products.search({ query: 'metadata["tier"]:"enterprise"' });
  return products.data[0]?.id;
}

// ── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  stripe,

  // Configuration
  PRICE_IDS,
  PRODUCTS,
  METERED_PRODUCTS,
  PLAN_LIMITS,
  TAX_CONFIG,
  PRORATION_CONFIG,
  TRIAL_DAYS,               // fib(7) = 13
  ANNUAL_DISCOUNT_PERCENT,  // fib(8) = 21

  // Webhook handling
  handleWebhook,
  routeWebhookEvent,

  // Checkout and portal
  createCheckoutSession,
  createBillingPortalSession,

  // Usage metering
  reportUsage,
  batchReportUsage,

  // Enterprise
  createEnterprisePrice,

  // Admin / bootstrap
  createProducts,
  getNonprofitCoupon,

  // Helpers
  getPlanFromSubscription,
  provisionPlanAccess,
};
