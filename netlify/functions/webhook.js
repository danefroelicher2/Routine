import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🎣 Webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log(`✅ Payment successful for user: ${session.client_reference_id}`);
            break;

        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            console.log(`❌ Subscription cancelled for user: ${subscription.metadata?.userId}`);
            break;

        case 'invoice.payment_failed':
            const invoice = event.data.object;
            console.log(`💳 Payment failed for subscription: ${invoice.subscription}`);
            break;

        default:
            console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
}
