// src/types/premium.ts
export type PremiumTier = 'free' | 'premium' | 'premiumAI';

export interface PremiumStatus {
    tier: PremiumTier;
    hasAIAccess: boolean;
    hasPremiumFeatures: boolean;
    expiresAt?: string;
}

export interface PricingPlan {
    id: string;
    name: string;
    price: string;
    originalPrice?: string;
    period: string;
    savings?: string;
    popular?: boolean;
    tier: PremiumTier;
    features: string[];
    hasAI: boolean;
}