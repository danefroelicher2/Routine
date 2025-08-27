import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client for webhook use
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
    console.log('🎣 Webhook called');

    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    console.log(`🎣 Webhook received: ${event.type}`);

    try {
        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`🔔 Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('❌ Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}

// Handle successful checkout completion
async function handleCheckoutCompleted(session) {
    console.log('✅ Processing checkout completion:', session.id);

    const userId = session.metadata?.userId;
    if (!userId) {
        console.error('❌ No userId in session metadata');
        return;
    }

    // Get customer and subscription details
    const customer = await stripe.customers.retrieve(session.customer);
    console.log(`👤 Customer retrieved: ${customer.id}`);

    // Update user's premium status in database
    await updateUserPremiumStatus(userId, customer.id, session.metadata?.planId);
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
    console.log('🎉 New subscription created:', subscription.id);

    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return;
    }

    await updateSubscriptionStatus(userId, subscription);
}

// Handle subscription updates (plan changes, etc.)
async function handleSubscriptionUpdated(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return;
    }

    await updateSubscriptionStatus(userId, subscription);
}

// Handle subscription cancellation
async function handleSubscriptionDeleted(subscription) {
    console.log('❌ Subscription cancelled:', subscription.id);

    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return;
    }

    // Remove premium access
    await updateUserPremiumStatus(userId, null, null, false);
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
    console.log('💰 Payment succeeded for invoice:', invoice.id);

    if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;

        if (userId) {
            // Ensure user has active premium access
            await updateSubscriptionStatus(userId, subscription);
        }
    }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
    console.log('💳 Payment failed for invoice:', invoice.id);

    if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.userId;

        if (userId) {
            console.log(`⚠️ Payment failed for user: ${userId}`);

            // You might want to:
            // 1. Send email notification
            // 2. Set grace period
            // 3. Update subscription status

            // For now, let's check if subscription is still active
            if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
                console.log(`🚨 Subscription ${subscription.id} needs attention`);
                // Could implement grace period logic here
            }
        }
    }
}

// Helper function to update user premium status
async function updateUserPremiumStatus(userId, customerId = null, planId = null, isPremium = true) {
    try {
        console.log(`📝 Updating premium status for user ${userId}: ${isPremium}`);

        // Determine tier and AI access based on planId
        let tier = 'free';
        let hasAIAccess = false;

        if (isPremium && planId) {
            if (planId === 'monthlyAI' || planId === 'yearlyAI') {
                tier = 'premiumAI';
                hasAIAccess = true;
            } else if (planId === 'monthly' || planId === 'yearly') {
                tier = 'premium';
                hasAIAccess = false;
            }
        }

        // Update user_settings table
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                is_premium: isPremium,
                premium_tier: tier,
                has_ai_access: hasAIAccess,
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            console.error('❌ Database update error:', error);
            throw error;
        }

        console.log(`✅ Premium status updated: ${userId} -> ${tier} (AI: ${hasAIAccess})`);
    } catch (error) {
        console.error('❌ Failed to update user premium status:', error);
        throw error;
    }
}

// Helper function to update subscription status based on Stripe subscription object
async function updateSubscriptionStatus(userId, subscription) {
    const isActive = ['active', 'trialing'].includes(subscription.status);
    const planId = subscription.metadata?.planId;

    console.log(`🔄 Updating subscription status: ${subscription.status} for user ${userId}`);

    await updateUserPremiumStatus(
        userId,
        subscription.customer,
        planId,
        isActive
    );
}

// Important: Disable body parsing for webhooks (raw body needed for signature verification)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
}