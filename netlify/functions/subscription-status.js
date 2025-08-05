exports.handler = async (event, context) => {
    console.log('🔍 Subscription status function called');
    console.log('📦 HTTP Method:', event.httpMethod);
    console.log('📦 Query params:', event.queryStringParameters);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const userId = event.queryStringParameters?.userId;
        console.log('🔍 User ID:', userId);

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
                isPremium: false,
                subscriptionId: null,
                status: 'inactive',
                message: 'Function working! Ready for Stripe integration.'
            })
        };

    } catch (error) {
        console.error('❌ Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};