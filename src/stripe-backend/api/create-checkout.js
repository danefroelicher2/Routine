import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    console.log('🚀 Create-checkout API called');
    console.log('📦 Method:', req.method);
    console.log('📦 Body:', req.body);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId, userEmail, planId } = req.body;
        console.log(`🚀 Processing checkout for user: ${userId}, email: ${userEmail}, plan: ${planId}`);

        if (!userId || !userEmail || !planId) {
            res.status(400).json({
                error: 'Missing required fields: userId, userEmail, and planId are required'
            });
            return;
        }

        // Define your pricing plans
        const plans = {
            monthly: {
                price: 'price_1RvpxdRrlTgvstUYtzK63A85', // ← Your monthly price ID
                name: 'Monthly Premium'
            },
            yearly: {
                price: 'price_1Rvpy5RrlTgvstUYtZWQF2vf', // ← Your annual price ID
                name: 'Yearly Premium'
            }
        };

        const selectedPlan = plans[planId];
        if (!selectedPlan) {
            res.status(400).json({ error: 'Invalid plan ID' });
            return;
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: selectedPlan.price,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'https://your-app.com'}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://your-app.com'}/premium/cancel`,
            customer_email: userEmail,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                planId: planId
            }
        });

        console.log(`✅ Checkout session created: ${session.id}`);

        res.status(200).json({
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