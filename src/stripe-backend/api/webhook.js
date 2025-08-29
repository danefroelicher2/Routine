// api/webhook.js
// COMPLETELY NEW APPROACH FOR VERCEL WEBHOOK HANDLING

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CRITICAL: Export config BEFORE the handler
export const config = {
    api: {
        bodyParser: false, // This is CRITICAL for raw body access
    },
};

// Helper function to get raw body for Vercel
async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
        console.log(`❌ Invalid method: ${req.method}`);
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    console.log('🎣 Webhook endpoint hit!');
    console.log('📦 Headers received:', req.headers);

    const sig = req.headers['stripe-signature'];

    // Check if we have the signature header
    if (!sig) {
        console.log('⚠️ No stripe-signature header found');
        res.status(400).json({ error: 'No stripe-signature header' });
        return;
    }

    let event;
    let rawBody;

    try {
        // Get the raw body for signature verification
        rawBody = await getRawBody(req);
        console.log('📊 Raw body obtained, length:', rawBody.length);

        // Verify webhook signature
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }

        console.log('🔐 Attempting signature verification...');
        event = stripe.webhooks.constructEvent(
            rawBody.toString('utf8'),
            sig,
            webhookSecret
        );

        console.log('✅ Signature verified! Event type:', event.type);

    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        console.error('Debug info:', {
            signatureHeader: sig?.substring(0, 20) + '...',
            bodyLength: rawBody?.length,
            bodyPreview: rawBody?.toString('utf8').substring(0, 100)
        });
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
        return;
    }

    // Handle the event
    console.log(`📨 Processing ${event.type} event...`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('💳 Payment successful!');
                console.log('  User ID:', session.client_reference_id);
                console.log('  Customer:', session.customer);
                console.log('  Subscription:', session.subscription);

                if (session.client_reference_id) {
                    // Update user subscription in database
                    const { data, error } = await supabase
                        .from('user_subscriptions')
                        .upsert({
                            user_id: session.client_reference_id,
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription,
                            plan_id: session.metadata?.plan_id || 'premium',
                            status: 'active',
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'user_id'
                        });

                    if (error) {
                        console.error('❌ Database update failed:', error);
                    } else {
                        console.log('✅ Database updated successfully');
                    }
                }
                break;

            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                console.log('🚫 Subscription cancelled');
                console.log('  Subscription ID:', subscription.id);

                // Update subscription status to cancelled
                const { error: cancelError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: 'cancelled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id);

                if (cancelError) {
                    console.error('❌ Failed to update cancelled status:', cancelError);
                } else {
                    console.log('✅ Subscription marked as cancelled');
                }
                break;

            case 'customer.subscription.updated':
                const updatedSub = event.data.object;
                console.log('🔄 Subscription updated');
                console.log('  Status:', updatedSub.status);

                // Update subscription status
                const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: updatedSub.status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', updatedSub.id);

                if (updateError) {
                    console.error('❌ Failed to update subscription:', updateError);
                } else {
                    console.log('✅ Subscription status updated');
                }
                break;

            case 'invoice.payment_failed':
                const invoice = event.data.object;
                console.log('💔 Payment failed for subscription:', invoice.subscription);

                // Update subscription status to payment_failed
                const { error: failError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: 'payment_failed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', invoice.subscription);

                if (failError) {
                    console.error('❌ Failed to update payment failed status:', failError);
                }
                break;

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }

        // Send success response
        res.status(200).json({
            received: true,
            type: event.type,
            processed: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({
            error: 'Failed to process webhook',
            message: error.message
        });
    }
}