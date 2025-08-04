// netlify/functions/subscription-status.js
const Stripe = require('stripe');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'false',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const { userId } = event.queryStringParameters || {};

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        console.log(`🔍 Checking subscription status for user: ${userId}`);

        // Search for subscriptions by metadata
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
            expand: ['data.customer']
        });

        // Find subscription for this user
        const userSubscription = subscriptions.data.find(sub =>
            sub.metadata?.userId === userId &&
            (sub.status === 'active' || sub.status === 'trialing')
        );

        if (userSubscription) {
            console.log(`✅ Active subscription found for user: ${userId}`);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isPremium: true,
                    subscriptionId: userSubscription.id,
                    status: userSubscription.status,
                    currentPeriodEnd: userSubscription.current_period_end,
                    cancelAtPeriodEnd: userSubscription.cancel_at_period_end
                })
            };
        } else {
            console.log(`📭 No active subscription found for user: ${userId}`);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isPremium: false,
                    subscriptionId: null,
                    status: 'inactive'
                })
            };
        }

    } catch (error) {
        console.error('❌ Subscription status error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to check subscription status',
                details: error.message
            })
        };
    }
};

// netlify/functions/create-checkout.js
const Stripe = require('stripe');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'false',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const { userId, userEmail } = JSON.parse(event.body || '{}');

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        console.log(`🚀 Creating checkout session for user: ${userId}`);

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: process.env.STRIPE_PRICE_ID,
                quantity: 1,
            }],
            mode: 'subscription',
            customer_email: userEmail,
            success_url: `routineapp://premium-success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}`,
            cancel_url: `routineapp://premium-cancel?user_id=${userId}`,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                source: 'routine_app'
            },
            subscription_data: {
                metadata: {
                    userId: userId
                }
            },
            allow_promotion_codes: true,
        });

        console.log(`✅ Checkout session created: ${session.id}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                url: session.url,
                sessionId: session.id
            })
        };

    } catch (error) {
        console.error('❌ Checkout creation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to create checkout session',
                details: error.message
            })
        };
    }
};

// netlify/functions/webhook.js
const Stripe = require('stripe');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = event.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`
        };
    }

    console.log(`🎣 Webhook received: ${stripeEvent.type}`);

    // Handle the event
    switch (stripeEvent.type) {
        case 'checkout.session.completed':
            const session = stripeEvent.data.object;
            console.log(`✅ Payment successful for user: ${session.client_reference_id}`);
            break;

        case 'customer.subscription.deleted':
            const subscription = stripeEvent.data.object;
            console.log(`❌ Subscription cancelled for user: ${subscription.metadata?.userId}`);
            break;

        case 'invoice.payment_failed':
            const invoice = stripeEvent.data.object;
            console.log(`💳 Payment failed for subscription: ${invoice.subscription}`);
            break;

        default:
            console.log(`🔔 Unhandled event type: ${stripeEvent.type}`);
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ received: true })
    };
};