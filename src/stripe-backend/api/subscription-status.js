// src/stripe-backend/api/subscription-status.js
// FIXED VERSION THAT ACTUALLY CHECKS THE DATABASE + PROPER AI DETECTION

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    console.log('🔍 Subscription status API called');
    console.log('📦 Method:', req.method);
    console.log('📦 Query:', req.query);

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
        console.log('🔍 Checking status for User ID:', userId);

        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }

        // ✅ CHECK THE USER_SUBSCRIPTIONS TABLE
        console.log('📊 Querying user_subscriptions table...');

        const { data: subscription, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ Database error:', error);
            res.status(500).json({
                error: 'Database query failed',
                details: error.message
            });
            return;
        }

        console.log('📊 Database query result:', subscription);

        // ✅ DETERMINE PREMIUM STATUS AND AI ACCESS
        const isPremium = !!subscription; // True if we found an active subscription

        let tier = 'free';
        let hasAIAccess = false;

        if (subscription) {
            console.log('📊 Subscription plan_id:', subscription.plan_id);

            // ✅ IMPROVED AI DETECTION LOGIC
            if (subscription.plan_id === 'premiumAI' ||
                subscription.plan_id?.toLowerCase().includes('ai') ||
                subscription.plan_id?.toLowerCase().includes('monthly_ai') ||
                subscription.plan_id?.toLowerCase().includes('yearly_ai')) {

                tier = 'premiumAI';
                hasAIAccess = true;
                console.log('✅ AI access granted based on plan_id');
            } else {
                tier = 'premium';
                hasAIAccess = false;
                console.log('✅ Standard premium access (no AI)');
            }
        }

        const response = {
            isPremium,
            tier,
            hasAIAccess,
            subscriptionId: subscription?.stripe_subscription_id || null,
            customerId: subscription?.stripe_customer_id || null,
            planId: subscription?.plan_id || null,
            status: subscription?.status || 'inactive',
            updatedAt: subscription?.updated_at || null
        };

        console.log('✅ Returning subscription status:', response);
        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Function error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
            isPremium: false,
            tier: 'free',
            hasAIAccess: false
        });
    }
}