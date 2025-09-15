// ============================================
// Test Apple IAP Integration
// Create this as src/utils/testAppleIAP.ts
// ============================================

import { Platform, Alert } from 'react-native';
import { appleIAPService } from '../services/appleIAPService';
import { supabase } from '../services/supabase';

export class AppleIAPTester {

    /**
     * Test Apple IAP initialization
     */
    static async testInitialization(): Promise<boolean> {
        try {
            console.log('🧪 Testing Apple IAP initialization...');

            if (Platform.OS !== 'ios') {
                console.log('⚠️ Apple IAP tests only work on iOS');
                return false;
            }

            const initialized = await appleIAPService.initialize();

            if (initialized) {
                console.log('✅ Apple IAP initialized successfully');
                return true;
            } else {
                console.log('❌ Apple IAP initialization failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Apple IAP test error:', error);
            return false;
        }
    }

    /**
     * Test loading products from Apple
     */
    static async testProductLoading(): Promise<boolean> {
        try {
            console.log('🧪 Testing Apple IAP product loading...');

            const products = await appleIAPService.loadProducts();

            if (products.length > 0) {
                console.log(`✅ Loaded ${products.length} products:`);
                products.forEach(product => {
                    console.log(`  - ${product.title}: ${product.localizedPrice}`);
                });
                return true;
            } else {
                console.log('⚠️ No products loaded - check App Store Connect configuration');
                return false;
            }
        } catch (error) {
            console.error('❌ Product loading test error:', error);
            return false;
        }
    }

    /**
     * Test premium status check with both payment methods
     */
    static async testPremiumStatusCheck(): Promise<void> {
        try {
            console.log('🧪 Testing premium status check...');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('❌ No user logged in for testing');
                return;
            }

            // Check current subscription status
            const { data: subscription, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Database query error:', error);
                return;
            }

            if (subscription) {
                console.log('✅ Current subscription found:');
                console.log(`  - Plan: ${subscription.plan_id}`);
                console.log(`  - Status: ${subscription.status}`);
                console.log(`  - Provider: ${subscription.payment_provider || 'stripe'}`);
                console.log(`  - Apple Product: ${subscription.apple_product_id || 'N/A'}`);
                console.log(`  - Stripe Sub: ${subscription.stripe_subscription_id || 'N/A'}`);
            } else {
                console.log('ℹ️ No active subscription found');
            }
        } catch (error) {
            console.error('❌ Premium status test error:', error);
        }
    }

    /**
     * Test restore purchases functionality
     */
    static async testRestorePurchases(): Promise<boolean> {
        try {
            console.log('🧪 Testing Apple IAP restore purchases...');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('❌ No user logged in for testing');
                return false;
            }

            const restored = await appleIAPService.restorePurchases(user.id);

            if (restored) {
                console.log('✅ Restore purchases completed successfully');
                return true;
            } else {
                console.log('⚠️ No purchases to restore or restore failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Restore purchases test error:', error);
            return false;
        }
    }

    /**
     * Run all tests
     */
    static async runAllTests(): Promise<void> {
        console.log('🧪 Starting Apple IAP Integration Tests...');
        console.log('='.repeat(50));

        const results = {
            initialization: await this.testInitialization(),
            productLoading: await this.testProductLoading(),
        };

        console.log('='.repeat(50));
        console.log('🧪 Test Results:');
        console.log(`  - Initialization: ${results.initialization ? '✅' : '❌'}`);
        console.log(`  - Product Loading: ${results.productLoading ? '✅' : '❌'}`);

        // Additional tests that don't affect the main flow
        await this.testPremiumStatusCheck();

        if (Platform.OS === 'ios') {
            console.log('\n📱 To complete testing:');
            console.log('1. Try purchasing a subscription through the app');
            console.log('2. Verify the subscription appears in your database');
            console.log('3. Test cancellation through device settings');
            console.log('4. Test restore purchases functionality');
        }
    }

    /**
     * Quick development test - call this from your app
     */
    static async quickTest(): Promise<void> {
        if (__DEV__) {
            try {
                await this.runAllTests();
            } catch (error) {
                console.error('❌ Quick test failed:', error);
            }
        }
    }
}

// Export for easy use in development
export const testAppleIAP = AppleIAPTester.quickTest;