import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Update your create-checkout.js file with these CORS headers:

export default async function handler(req, res) {
    // Enhanced CORS headers for React Native
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, userEmail } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
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

        res.json({
            url: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('❌ Checkout creation error:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            details: error.message
        });
    }
}
