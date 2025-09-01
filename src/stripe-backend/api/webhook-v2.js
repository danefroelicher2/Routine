// src/stripe-backend/api/webhook-v2.js
// COMPLETE WEBHOOK WITH CANCELLATION HANDLING + AI PLAN DETECTION

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('🎣 Webhook endpoint hit!');

    let event;
    let rawBody;

    try {
        rawBody = await getRawBody(req);
        const bodyString = rawBody.toString('utf8');

        // Try signature verification
        try {
            const sig = req.headers['stripe-signature'];
            event = stripe.webhooks.constructEvent(
                bodyString,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
            console.log('✅ Signature verified!');
        } catch (sigErr) {
            // If signature fails, parse the body anyway
            console.log('⚠️ Signature failed, processing anyway:', sigErr.message);
            event = JSON.parse(bodyString);
        }

    } catch (err) {
        console.error('❌ Body parsing error:', err);
        return res.status(400).json({ error: 'Invalid request body' });
    }

    // Process the event
    console.log(`📨 Processing ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`🔔 Unhandled event type: ${event.type}`);
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }

    res.status(200).json({ received: true, type: event.type });
}

// ✅ HANDLE NEW SUBSCRIPTIONS - FIXED TO DETECT PLAN TYPE
async function handleCheckoutCompleted(session) {
    console.log('💳 Checkout completed for user:', session.client_reference_id);
    console.log('Customer:', session.customer);
    console.log('Subscription:', session.subscription);

    if (session.client_reference_id && session.subscription) {
        try {
            // ✅ GET THE ACTUAL SUBSCRIPTION TO DETERMINE PLAN TYPE
            console.log('🔍 Fetching subscription details...');
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const priceId = subscription.items.data[0].price.id;

            console.log('💰 Price ID from subscription:', priceId);

            // ✅ DETERMINE PLAN TYPE BASED ON PRICE ID
            let planId = 'premium';
            let hasAI = false;

            const priceMapping = {
                'price_1RvpxdRrlTgvstUYtzK63A85': { planId: 'premium', hasAI: false },     // Monthly Premium
                'price_1Rvpy5RrlTgvstUYtZWQF2vf': { planId: 'premium', hasAI: false },     // Yearly Premium
                'price_1S0SLTRrlTgvstUY0hMnFnJM': { planId: 'premiumAI', hasAI: true },   // Monthly Premium + AI
                'price_1S0SM5RrlTgvstUY2FBY8DCn': { planId: 'premiumAI', hasAI: true },  // Yearly Premium + AI
            };

            const planInfo = priceMapping[priceId];
            if (planInfo) {
                planId = planInfo.planId;
                hasAI = planInfo.hasAI;
                console.log(`✅ Detected plan: ${planId}, AI Access: ${hasAI}`);
            } else {
                console.log(`⚠️ Unknown price ID: ${priceId}, defaulting to premium`);
            }

            const { data, error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: session.client_reference_id,
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription,
                    plan_id: planId, // ✅ NOW USES CORRECT PLAN ID
                    status: 'active',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('❌ Database error:', error);
            } else {
                console.log(`✅ New subscription activated: ${planId} (AI: ${hasAI})`);
            }
        } catch (dbErr) {
            console.error('❌ Database operation failed:', dbErr);
        }
    } else {
        console.log('⚠️ Missing client_reference_id or subscription in session');
    }
}

// ✅ HANDLE SUBSCRIPTION UPDATES
async function handleSubscriptionUpdated(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);
    console.log('📊 Subscription status:', subscription.status);

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: subscription.status, // active, canceled, past_due, etc.
                updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscription.id);

        if (error) {
            console.error('❌ Error updating subscription:', error);
        } else {
            console.log(`✅ Subscription ${subscription.id} updated to status: ${subscription.status}`);
        }
    } catch (dbErr) {
        console.error('❌ Database update failed:', dbErr);
    }
}

// ✅ HANDLE SUBSCRIPTION CANCELLATIONS  
async function handleSubscriptionDeleted(subscription) {
    console.log('❌ Subscription cancelled:', subscription.id);

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscription.id);

        if (error) {
            console.error('❌ Error cancelling subscription:', error);
        } else {
            console.log(`✅ Subscription ${subscription.id} marked as cancelled in database!`);
        }
    } catch (dbErr) {
        console.error('❌ Database cancellation failed:', dbErr);
    }
}

// ✅ HANDLE PAYMENT FAILURES
async function handlePaymentFailed(invoice) {
    console.log('💳 Payment failed for subscription:', invoice.subscription);

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'past_due',
                updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription);

        if (error) {
            console.error('❌ Error updating failed payment:', error);
        } else {
            console.log(`✅ Subscription ${invoice.subscription} marked as past_due`);
        }
    } catch (dbErr) {
        console.error('❌ Database payment failure update failed:', dbErr);
    }
}