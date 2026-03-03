/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Systems - Auth & Billing API Routes
 */
const express = require('express');
const { PaymentGateway, AuthMiddleware } = require('../api/payment-gateway');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/checkout', async (req, res) => {
    try {
        const { userId, planType } = req.body;
        const successUrl = 'https://headysystems.com/success';
        const cancelUrl = 'https://headysystems.com/billing';

        const session = await PaymentGateway.createCheckoutSession(userId, planType, successUrl, cancelUrl);
        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: 'Checkout session creation failed' });
    }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    try {
        const event = await PaymentGateway.verifyWebhookSignature(req.body, sig);
        logger.logSystem(`✅ [Stripe] Webhook event received: ${event.type}`);

        // In production, update user record in Firestore here

        res.json({ received: true });
    } catch (err) {
        logger.logError('SYSTEM', 'Stripe webhook signature verification failed', err);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// Example protected route
router.get('/pro-features', AuthMiddleware.requireProPlan, (req, res) => {
    res.json({ message: "Welcome to the Heady Pro tier. Unlimited inference active." });
});

module.exports = router;
