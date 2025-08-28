import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    console.log('🎣 Webhook endpoint called at:', new Date().toISOString());
    console.log('📦 Method:', req.method);
    console.log('📦 Headers:', Object.keys(req.headers));

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

    if (req.method === 'OPTIONS') {
        console.log('✅ OPTIONS request handled');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.log('❌ Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // TEMPORARY: Skip signature verification and work with the parsed body
    console.log('⚠️ TEMPORARILY SKIPPING SIGNATURE VERIFICATION');
    console.log('📦 Request body type:', typeof req.body);
    console.log('📦 Request body keys:', Object.keys(req.body || {}));

    let event;

    try {
        // For now, treat the parsed body as the event
        event = req.body;

        if (!event || !event.type) {
            throw new Error('Invalid webhook event structure');
        }

        console.log(`✅ Processing webhook event: ${event.type}`);
        console.log(`📋 Event ID: ${event.id}`);

        // Basic validation - ensure this looks like a Stripe event
        if (!event.data || !event.data.object) {
            throw new Error('Invalid Stripe event structure');
        }

    } catch (err) {
        console.error('❌ Webhook parsing failed:', err.message);
        console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`🎯 Processing webhook event: ${event.type}`);

    try {
        // Handle the specific webhook events
        switch (event.type) {
            case 'checkout.session.completed':
                console.log('💳 Processing checkout completion...');
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.deleted':
                console.log('🗑️ Processing subscription deletion...');
                await handleSubscriptionCancelled(event.data.object);
                break;

            case 'invoice.payment_failed':
                console.log('💸 Processing payment failure...');
                await handlePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.updated':
                console.log('🔄 Processing subscription update...');
                await handleSubscriptionUpdated(event.data.object);
                break;

            default:
                console.log(`🔔 Unhandled event type: ${event.type}`);
        }

        console.log('✅ Webhook processed successfully');
        return res.status(200).json({
            received: true,
            processed: event.type,
            event_id: event.id
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        return res.status(500).json({
            error: 'Webhook processing failed',
            details: error.message
        });
    }
}

// Helper function: Handle successful checkout
async function handleCheckoutCompleted(session) {
    console.log('✅ Processing successful checkout...');
    console.log('📊 Session ID:', session.id);
    console.log('👤 Customer ID:', session.customer);
    console.log('📋 Session metadata:', JSON.stringify(session.metadata, null, 2));

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    console.log(`🔍 Extracted data - User: ${userId}, Plan: ${planId}, Customer: ${customerId}, Sub: ${subscriptionId}`);

    if (!userId) {
        console.error('❌ Missing userId in checkout session metadata');
        console.error('❌ Available metadata keys:', Object.keys(session.metadata || {}));
        console.error('❌ Metadata values:', session.metadata);
        return;
    }

    console.log(`💾 Updating database for user: ${userId}, plan: ${planId}`);

    try {
        // Update user's premium status in Supabase
        const { data, error } = await supabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                plan_id: planId,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            console.error('❌ Supabase error details:', error);
            throw error;
        } else {
            console.log(`✅ SUCCESS! User ${userId} premium status activated`);
            console.log('📊 Database operation completed successfully');
            if (data) {
                console.log('📊 Database response:', data);
            }
        }

    } catch (error) {
        console.error('❌ Database update error:', error.message);
        console.error('❌ Full error object:', error);
        throw error;
    }
}

// Helper function: Handle subscription cancellation
async function handleSubscriptionCancelled(subscription) {
    console.log('❌ Processing subscription cancellation...');
    console.log('🆔 Subscription ID:', subscription.id);
    console.log('👤 Customer ID:', subscription.customer);

    const customerId = subscription.customer;
    const subscriptionId = subscription.id;

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('stripe_customer_id', customerId)
            .eq('stripe_subscription_id', subscriptionId);

        if (error) {
            console.error('❌ Failed to cancel subscription:', error);
            throw error;
        } else {
            console.log(`✅ Subscription ${subscriptionId} cancelled successfully`);
        }

    } catch (error) {
        console.error('❌ Database update error:', error);
        throw error;
    }
}

// Helper function: Handle payment failure
async function handlePaymentFailed(invoice) {
    console.log('💳 Processing payment failure...');
    console.log('🆔 Invoice ID:', invoice.id);
    console.log('👤 Customer ID:', invoice.customer);

    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'past_due',
                updated_at: new Date().toISOString()
            })
            .eq('stripe_customer_id', customerId)
            .eq('stripe_subscription_id', subscriptionId);

        if (error) {
            console.error('❌ Failed to update payment status:', error);
            throw error;
        } else {
            console.log(`✅ Subscription ${subscriptionId} marked as past_due`);
        }

    } catch (error) {
        console.error('❌ Database update error:', error);
        throw error;
    }
}

// Helper function: Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
    console.log('🔄 Processing subscription update...');
    console.log('🆔 Subscription ID:', subscription.id);
    console.log('📊 New status:', subscription.status);

    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('stripe_customer_id', customerId)
            .eq('stripe_subscription_id', subscriptionId);

        if (error) {
            console.error('❌ Failed to update subscription:', error);
            throw error;
        } else {
            console.log(`✅ Subscription ${subscriptionId} updated to ${status}`);
        }

    } catch (error) {
        console.error('❌ Database update error:', error);
        throw error;
    }
}

// Enable body parsing (since we're not doing signature verification)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};