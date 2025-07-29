import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
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

            res.json({
                isPremium: true,
                subscriptionId: userSubscription.id,
                status: userSubscription.status,
                currentPeriodEnd: userSubscription.current_period_end,
                cancelAtPeriodEnd: userSubscription.cancel_at_period_end
            });
        } else {
            console.log(`📭 No active subscription found for user: ${userId}`);

            res.json({
                isPremium: false,
                subscriptionId: null,
                status: 'inactive'
            });
        }

    } catch (error) {
        console.error('❌ Subscription status error:', error);
        res.status(500).json({
            error: 'Failed to check subscription status',
            details: error.message
        });
    }
}
