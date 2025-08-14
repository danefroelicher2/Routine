import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        console.log('🔍 User ID:', userId);

        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }

        // TODO: Replace with your actual database lookup
        // For now, returning a default response
        // In production, you should:
        // 1. Look up the user in your database (Supabase)
        // 2. Check their Stripe customer ID
        // 3. Query Stripe for active subscriptions

        /*
        Example implementation:
        
        // Get user from Supabase
        const { data: user } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();
            
        if (user?.stripe_customer_id) {
            // Check Stripe for active subscriptions
            const subscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'active'
            });
            
            const isPremium = subscriptions.data.length > 0;
            
            res.status(200).json({
                isPremium,
                subscriptionId: subscriptions.data[0]?.id || null,
                status: isPremium ? 'active' : 'inactive'
            });
        } else {
            res.status(200).json({
                isPremium: false,
                subscriptionId: null,
                status: 'inactive'
            });
        }
        */

        // Temporary response for testing
        res.status(200).json({
            isPremium: false,
            subscriptionId: null,
            status: 'inactive',
            message: 'API working! Ready for Stripe integration.'
        });

    } catch (error) {
        console.error('❌ Function error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}