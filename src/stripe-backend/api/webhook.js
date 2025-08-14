import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log(`✅ Payment successful for user: ${session.client_reference_id}`);

            // TODO: Update your database here
            // Example: Mark user as premium in Supabase
            // await updateUserPremiumStatus(session.client_reference_id, true);

            break;

        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            console.log(`❌ Subscription cancelled for user: ${subscription.metadata?.userId}`);

            // TODO: Update your database here
            // Example: Mark user as non-premium in Supabase
            // await updateUserPremiumStatus(subscription.metadata.userId, false);

            break;

        case 'invoice.payment_failed':
            const invoice = event.data.object;
            console.log(`💳 Payment failed for subscription: ${invoice.subscription}`);

            // TODO: Handle failed payment
            // Example: Send email notification, temporary grace period

            break;

        default:
            console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
}

// Important: Disable body parsing for webhooks
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
}