import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

    console.log('🔥 FUNCTION DEFINITELY CALLED at:', new Date().toISOString());

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
                price: 'price_1RvpxdRrlTgvstUYtzK63A85', // $2.94 Monthly (NO AI)
                name: 'Monthly Premium'
            },
            yearly: {
                price: 'price_1Rvpy5RrlTgvstUYtZWQF2vf', // $27.99 Yearly (NO AI)
                name: 'Yearly Premium'
            },
            monthlyAI: {
                price: 'price_1S0SLTRrlTgvstUY0hMnFnJM', // $7.99 Monthly (WITH AI)
                name: 'Monthly Premium + AI'
            },
            yearlyAI: {
                price: 'price_1S0SM5RrlTgvstUY2FBY8DCn', // $74.99 Yearly (WITH AI)
                name: 'Yearly Premium + AI'
            }
        };

        const selectedPlan = plans[planId];
        if (!selectedPlan) {
            res.status(400).json({ error: 'Invalid plan ID' });
            return;
        }

        console.log(`Creating customer for user: ${userId}, email: ${userEmail}`);

        // Create customer with metadata first
        const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
                userId: userId,
                planId: planId
            }
        });

        console.log(`Customer created with ID: ${customer.id}, metadata:`, customer.metadata);

        // Then create the checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: selectedPlan.price,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: process.env.NODE_ENV === 'production'
                ? 'routineapp://premium-success'
                : 'exp://192.168.1.6:8081/--/premium-success',
            cancel_url: process.env.NODE_ENV === 'production'
                ? 'routineapp://premium-cancel'
                : 'exp://192.168.1.6:8081/--/premium-cancel',
            customer: customer.id,  // Use the customer ID
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