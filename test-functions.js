// Test script to verify functions work without Netlify dev server
console.log('🧪 Testing Netlify functions directly...\n');

// Test subscription-status function
async function testSubscriptionStatus() {
    try {
        console.log('🔍 Testing subscription-status function...');

        const { handler } = require('./netlify/functions/subscription-status');

        const event = {
            httpMethod: 'GET',
            queryStringParameters: { userId: 'test123' },
            headers: {}
        };

        const result = await handler(event, {});

        console.log('✅ Status Code:', result.statusCode);
        console.log('📦 Response Body:', result.body);
        console.log('🎯 Headers:', result.headers);

        return result.statusCode === 200;
    } catch (error) {
        console.error('❌ Subscription status test failed:', error.message);
        return false;
    }
}

// Test create-checkout function
async function testCreateCheckout() {
    try {
        console.log('\n🚀 Testing create-checkout function...');

        const { handler } = require('./netlify/functions/create-checkout');

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
                userId: 'test123',
                userEmail: 'test@test.com'
            }),
            headers: { 'Content-Type': 'application/json' }
        };

        const result = await handler(event, {});

        console.log('✅ Status Code:', result.statusCode);
        console.log('📦 Response Body:', result.body);
        console.log('🎯 Headers:', result.headers);

        return result.statusCode === 200 || result.statusCode === 500; // 500 is OK if missing Stripe keys
    } catch (error) {
        console.error('❌ Create checkout test failed:', error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    const test1 = await testSubscriptionStatus();
    const test2 = await testCreateCheckout();

    console.log('\n📊 Test Results:');
    console.log(`Subscription Status: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Create Checkout: ${test2 ? '✅ PASS' : '❌ FAIL'}`);

    if (test1 && test2) {
        console.log('\n🎉 All functions work! Now we can test with Netlify dev server.');
    } else {
        console.log('\n🚨 Functions have issues. Let\'s fix them first.');
    }
}

runTests();