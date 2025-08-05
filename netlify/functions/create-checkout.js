exports.handler = async (event, context) => {
    console.log('🚀 Create-checkout function called');
    console.log('📦 HTTP Method:', event.httpMethod);
    console.log('📦 Event body:', event.body);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { userId, userEmail } = body;
        console.log(`🚀 Processing checkout for user: ${userId}, email: ${userEmail}`);

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        // Return test response (no Stripe for now)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                url: 'https://checkout.stripe.com/test-url-placeholder',
                sessionId: 'test-session-id',
                message: 'Function working! Ready for Stripe integration.'
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