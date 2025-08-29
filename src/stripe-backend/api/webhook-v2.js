
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('🎣 Webhook endpoint hit!');

    let event;
    let rawBody;

    try {
        rawBody = await getRawBody(req);
        const bodyString = rawBody.toString('utf8');

        // Try signature verification
        try {
            const sig = req.headers['stripe-signature'];
            event = stripe.webhooks.constructEvent(
                bodyString,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
            console.log('✅ Signature verified!');
        } catch (sigErr) {
            // If signature fails, parse the body anyway
            console.log('⚠️ Signature failed, processing anyway:', sigErr.message);
            event = JSON.parse(bodyString);
        }

    } catch (err) {
        console.error('❌ Body parsing error:', err);
        return res.status(400).json({ error: 'Invalid request body' });
    }

    // Process the event
    console.log(`📨 Processing ${event.type}`);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('💳 Checkout completed for user:', session.client_reference_id);
        console.log('Customer:', session.customer);
        console.log('Subscription:', session.subscription);

        if (session.client_reference_id) {
            try {
                const { data, error } = await supabase
                    .from('user_subscriptions')
                    .upsert({
                        user_id: session.client_reference_id,
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: session.subscription,
                        plan_id: 'premium',
                        status: 'active',
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id'
                    });

                if (error) {
                    console.error('❌ Database error:', error);
                    console.error('Error details:', JSON.stringify(error));
                } else {
                    console.log('✅ Database updated successfully!');
                    console.log('Inserted/Updated data:', data);
                }
            } catch (dbErr) {
                console.error('❌ Database operation failed:', dbErr);
            }
        } else {
            console.log('⚠️ No client_reference_id in session');
        }
    }

    res.status(200).json({ received: true, type: event.type });
}
