// ============================================
// src/services/appleIAPService.ts
// FIXED: Apple In-App Purchase Service (No Type Errors)
// ============================================

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ✅ APPLE IAP PRODUCT IDs - YOU'LL CONFIGURE THESE IN APP STORE CONNECT
export const APPLE_PRODUCT_IDS = {
    premium_monthly: 'com.routine.dailyhabits.premium.monthly',     // $2.94/month
    premium_yearly: 'com.routine.dailyhabits.premium.yearly',       // $27.99/year  
    premiumAI_monthly: 'com.routine.dailyhabits.premiumai.monthly', // $7.99/month
    premiumAI_yearly: 'com.routine.dailyhabits.premiumai.yearly',   // $74.99/year
};

// Map Apple product IDs to your plan types
const PRODUCT_TO_PLAN_MAP = {
    [APPLE_PRODUCT_IDS.premium_monthly]: { planId: 'premium', hasAI: false },
    [APPLE_PRODUCT_IDS.premium_yearly]: { planId: 'premium', hasAI: false },
    [APPLE_PRODUCT_IDS.premiumAI_monthly]: { planId: 'premiumAI', hasAI: true },
    [APPLE_PRODUCT_IDS.premiumAI_yearly]: { planId: 'premiumAI', hasAI: true },
};

interface AppleIAPProduct {
    productId: string;
    price: string;
    localizedPrice: string;
    currencyCode: string;
    title: string;
    description: string;
}

interface PurchaseResult {
    success: boolean;
    productId?: string;
    transactionId?: string;
    planId?: string;
    error?: string;
}

class AppleIAPService {
    private isInitialized = false;
    private products: AppleIAPProduct[] = [];

    /**
     * Initialize Apple IAP connection
     */
    async initialize(): Promise<boolean> {
        try {
            if (Platform.OS !== 'ios') {
                console.log('⚠️ Apple IAP only available on iOS');
                return false;
            }

            // For now, we'll mark as initialized
            // Real StoreKit integration will be added when building for iOS
            console.log('✅ Apple IAP service initialized');
            this.isInitialized = true;

            return true;
        } catch (error) {
            console.error('❌ Apple IAP initialization failed:', error);
            return false;
        }
    }

    /**
     * Load available products from Apple
     */
    async loadProducts(): Promise<AppleIAPProduct[]> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (Platform.OS !== 'ios') {
                console.log('⚠️ Apple products only available on iOS');
                return [];
            }

            // For development, return mock products
            // Real implementation will use expo-store-kit when building for iOS
            const mockProducts: AppleIAPProduct[] = [
                {
                    productId: APPLE_PRODUCT_IDS.premium_monthly,
                    price: '2.94',
                    localizedPrice: '$2.94',
                    currencyCode: 'USD',
                    title: 'Premium Monthly',
                    description: 'Unlimited routines and premium features'
                },
                {
                    productId: APPLE_PRODUCT_IDS.premium_yearly,
                    price: '27.99',
                    localizedPrice: '$27.99',
                    currencyCode: 'USD',
                    title: 'Premium Yearly',
                    description: 'Premium features with annual savings'
                },
                {
                    productId: APPLE_PRODUCT_IDS.premiumAI_monthly,
                    price: '7.99',
                    localizedPrice: '$7.99',
                    currencyCode: 'USD',
                    title: 'Premium + AI Monthly',
                    description: 'Premium features plus AI assistant'
                },
                {
                    productId: APPLE_PRODUCT_IDS.premiumAI_yearly,
                    price: '74.99',
                    localizedPrice: '$74.99',
                    currencyCode: 'USD',
                    title: 'Premium + AI Yearly',
                    description: 'Premium + AI with annual savings'
                }
            ];

            this.products = mockProducts;
            console.log('✅ Apple IAP products loaded (mock data)');
            return this.products;
        } catch (error) {
            console.error('❌ Failed to load Apple IAP products:', error);
            return [];
        }
    }

    /**
     * Get available products
     */
    getProducts(): AppleIAPProduct[] {
        return this.products;
    }

    /**
     * Get product by ID
     */
    getProduct(productId: string): AppleIAPProduct | undefined {
        return this.products.find(p => p.productId === productId);
    }

    /**
     * Purchase a product
     */
    async purchaseProduct(productId: string, userId: string): Promise<PurchaseResult> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (Platform.OS !== 'ios') {
                return {
                    success: false,
                    error: 'Apple IAP only available on iOS'
                };
            }

            console.log(`🛒 Starting Apple IAP purchase: ${productId}`);

            // For development testing, simulate successful purchase
            if (__DEV__) {
                console.log('🧪 Development mode - simulating successful Apple purchase');

                const planInfo = PRODUCT_TO_PLAN_MAP[productId];
                if (!planInfo) {
                    return {
                        success: false,
                        error: 'Unknown product ID'
                    };
                }

                // Update subscription in database
                await this.updateSubscriptionInDatabase(
                    userId,
                    { transactionId: `mock_${Date.now()}`, productId },
                    planInfo
                );

                return {
                    success: true,
                    productId: productId,
                    transactionId: `mock_${Date.now()}`,
                    planId: planInfo.planId
                };
            }

            // Real iOS implementation would use expo-store-kit here
            // This will be implemented when building for actual iOS device
            return {
                success: false,
                error: 'Apple IAP requires physical iOS device'
            };

        } catch (error) {
            console.error('❌ Apple IAP purchase error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Purchase failed'
            };
        }
    }

    /**
     * Restore previous purchases
     */
    async restorePurchases(userId: string): Promise<boolean> {
        try {
            if (Platform.OS !== 'ios') {
                console.log('⚠️ Restore purchases only available on iOS');
                return false;
            }

            console.log('🔄 Restoring Apple IAP purchases...');

            // Development mode simulation
            if (__DEV__) {
                console.log('✅ Restore purchases simulated in development');
                return true;
            }

            // Real implementation would use expo-store-kit
            return false;
        } catch (error) {
            console.error('❌ Restore purchases error:', error);
            return false;
        }
    }

    /**
     * Update subscription in Supabase database
     */
    private async updateSubscriptionInDatabase(
        userId: string,
        purchase: { transactionId: string; productId: string },
        planInfo: { planId: string; hasAI: boolean }
    ): Promise<void> {
        try {
            console.log(`💾 Updating subscription in database: ${planInfo.planId}`);

            const { error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    plan_id: planInfo.planId,
                    status: 'active',
                    apple_transaction_id: purchase.transactionId,
                    apple_product_id: purchase.productId,
                    payment_provider: 'apple',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('❌ Database update failed:', error);
                throw error;
            }

            console.log('✅ Subscription updated in database');
        } catch (error) {
            console.error('❌ Failed to update subscription in database:', error);
            throw error;
        }
    }

    /**
     * Check if Apple IAP is available
     */
    isAvailable(): boolean {
        return false; // Temporarily disable
    }
}

// Export singleton instance
export const appleIAPService = new AppleIAPService();