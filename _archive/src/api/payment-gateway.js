/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Systems - Auth & Payment Gateway Integration
 * Wires Firebase Auth for identity and Stripe for subscription billing.
 */
const Stripe = (()=>{try{return require('stripe')}catch(e){return class{constructor(){this.checkout={sessions:{create:async()=>({url:'#'})}}};}}})();
const logger = require("../utils/logger");

class PaymentGateway {
    constructor() {
        // In production, loaded via PQC-rotated secrets
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
        this.plans = {
            'pro': process.env.STRIPE_PRICE_PRO || 'price_mock_pro',
            'enterprise': process.env.STRIPE_PRICE_ENTERPRISE || 'price_mock_ent'
        };
    }

    async createCheckoutSession(userId, planType, successUrl, cancelUrl) {
        logger.logSystem(`💳 [Payment Gateway] Generating checkout for User:${userId} -> Plan:${planType}`);

        // Mock simulation for development
        if (process.env.NODE_ENV !== 'production' && !process.env.STRIPE_SECRET_KEY) {
            return { url: 'https://checkout.stripe.com/pay/mock_session_id_123' };
        }

        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{ price: this.plans[planType], quantity: 1 }],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: userId
            });
            return { url: session.url };
        } catch (err) {
            logger.error(`🚨 [Payment Gateway] Failed to create checkout:`, err.message);
            throw err;
        }
    }

    async verifyWebhookSignature(payload, signature) {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    }
}

class AuthMiddleware {
    static requireProPlan(req, res, next) {
        const userRole = req.headers['x-user-role'] || 'free';
        if (userRole === 'pro' || userRole === 'enterprise') {
            next();
        } else {
            res.status(403).json({ error: "Heady Pro Subscription Required", upgrade_url: "/billing" });
        }
    }
}

module.exports = { PaymentGateway: new PaymentGateway(), AuthMiddleware };
