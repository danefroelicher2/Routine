// src/stripe-backend/api/premium-status.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    console.log('🔍 Premium status check called');

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId } = req.query;
        console.log(`🔍 Checking subscription for user: ${userId}`);

        if (!userId) {
            res.status(400).json({ error: 'User ID is required' });
            return;
        }

        // Search for customer by user ID (stored in metadata)
        const customers = await stripe.customers.list({
            limit: 1,
            metadata: { userId: userId }
        });

        if (customers.data.length === 0) {
            console.log(`❌ No customer found for user: ${userId}`);
            res.status(200).json({
                isPremium: false,
                tier: 'free',
                hasAIAccess: false,
                hasPremiumFeatures: false
            });
            return;
        }

        const customer = customers.data[0];
        console.log(`✅ Customer found: ${customer.id}`);

        // Get active subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1
        });

        if (subscriptions.data.length === 0) {
            console.log(`❌ No active subscriptions for customer: ${customer.id}`);
            res.status(200).json({
                isPremium: false,
                tier: 'free',
                hasAIAccess: false,
                hasPremiumFeatures: false
            });
            return;
        }

        const subscription = subscriptions.data[0];
        console.log(`✅ Active subscription found: ${subscription.id}`);

        // Get the price ID from the subscription
        const priceId = subscription.items.data[0].price.id;
        console.log(`💰 Price ID: ${priceId}`);

        // ✅ NEW: Determine tier based on price ID
        const tierMapping = {
            'price_1RvpxdRrlTgvstUYtzK63A85': { tier: 'premium', hasAI: false },     // $2.94 Monthly
            'price_1Rvpy5RrlTgvstUYtZWQF2vf': { tier: 'premium', hasAI: false },     // $27.99 Yearly
            // ✅ ADD YOUR NEW PRICE IDs HERE:
            'price_1S0SLTRrlTgvstUY0hMnFnJM': { tier: 'premiumAI', hasAI: true },    // $7.99 Monthly + AI
            'price_1S0SM5RrlTgvstUY2FBY8DCn': { tier: 'premiumAI', hasAI: true },   // $74.99 Yearly + AI
        };

        const tierInfo = tierMapping[priceId] || { tier: 'free', hasAI: false };

        const response = {
            isPremium: true,
            tier: tierInfo.tier,
            hasAIAccess: tierInfo.hasAI,
            hasPremiumFeatures: true,
            customerId: customer.id,
            subscriptionId: subscription.id,
            priceId: priceId,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
        };

        console.log('✅ Premium status response:', response);
        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error checking premium status:', error);
        res.status(500).json({
            error: 'Failed to check premium status',
            details: error.message,
            isPremium: false,
            tier: 'free',
            hasAIAccess: false,
            hasPremiumFeatures: false
        });
    }
}