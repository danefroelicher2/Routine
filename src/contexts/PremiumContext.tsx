// ============================================
// COMPLETE PremiumContext.tsx - REPLACE YOUR ENTIRE FILE
// ============================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabase";

interface PremiumFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
}

interface FreeLimits {
    maxRoutines: number;
    maxNotes: number;
    maxAIQueries: number;
}

interface CurrentUsage {
    routines: number;
    notes: number;
    aiQueries: number;
}

interface PremiumContextType {
    // Premium Status
    isPremium: boolean;
    isLoading: boolean;

    // Premium Features
    premiumFeatures: PremiumFeature[];

    // Modal State
    showPremiumModal: boolean;
    modalSource: string;

    // Actions
    setPremiumStatus: (status: boolean) => void;
    showPremiumPopup: (source: string) => void;
    hidePremiumPopup: () => void;
    checkPremiumFeature: (featureId: string) => boolean;

    // Usage Tracking
    trackFeatureUsage: (featureId: string) => void;
    getUsageCount: (featureId: string) => number;

    // Free Limits
    freeLimits: FreeLimits;

    // Current Usage
    currentUsage: CurrentUsage;

    // Limit Checking
    isLimitReached: (feature: keyof CurrentUsage) => boolean;
    updateUsage: (feature: keyof CurrentUsage, count: number) => void;

    // ✅ NEW: Stripe Integration
    refreshSubscriptionStatus: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

interface PremiumProviderProps {
    children: ReactNode;
}

export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
    // Premium Status
    const [isPremium, setIsPremium] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Modal State
    const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
    const [modalSource, setModalSource] = useState<string>("");

    // Usage State
    const [usageCountCache, setUsageCountCache] = useState<Record<string, number>>({});
    const [currentUsage, setCurrentUsage] = useState<CurrentUsage>({
        routines: 0,
        notes: 0,
        aiQueries: 0,
    });

    // Premium Features
    const premiumFeatures: PremiumFeature[] = [
        {
            id: "unlimited_routines",
            name: "Unlimited Routines",
            description: "Create as many routines as you want",
            icon: "infinite",
        },
        {
            id: "ai_assistant",
            name: "AI Assistant",
            description: "Get personalized routine suggestions",
            icon: "chatbubbles",
        },
        {
            id: "advanced_analytics",
            name: "Advanced Analytics",
            description: "Detailed insights and progress tracking",
            icon: "analytics",
        },
        {
            id: "cloud_sync",
            name: "Cloud Sync",
            description: "Access your data across all devices",
            icon: "cloud",
        },
        {
            id: "priority_support",
            name: "Priority Support",
            description: "Get help when you need it most",
            icon: "headset",
        },
    ];

    // Free Limits
    const freeLimits: FreeLimits = {
        maxRoutines: 3,
        maxNotes: 10,
        maxAIQueries: 5,
    };

    // ✅ NEW: Check Stripe subscription status
    const checkStripeSubscriptionStatus = async (userId: string): Promise<boolean> => {
        try {
            console.log(`🔍 Checking Stripe subscription for user: ${userId}`);

            // 🔑 REPLACE YOUR_VERCEL_URL with your actual Vercel URL
            const response = await fetch(
                `https://YOUR_VERCEL_URL.vercel.app/api/subscription-status?userId=${userId}`
            );

            if (!response.ok) {
                console.error('❌ Failed to check subscription status');
                return false;
            }

            const data = await response.json();
            console.log(`📊 Subscription status response:`, data);

            return data.isPremium || false;
        } catch (error) {
            console.error('❌ Error checking subscription status:', error);
            return false;
        }
    };

    // Load premium data on app start
    useEffect(() => {
        loadPremiumData();
    }, []);

    const loadPremiumData = async () => {
        try {
            setIsLoading(true);

            // Load cached premium status
            const cachedPremiumStatus = await AsyncStorage.getItem("@premium_status");
            if (cachedPremiumStatus !== null) {
                setIsPremium(JSON.parse(cachedPremiumStatus));
            }

            // ✅ Check with Stripe for real-time status
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const stripeStatus = await checkStripeSubscriptionStatus(user.id);

                // Update if status changed
                if (stripeStatus !== JSON.parse(cachedPremiumStatus || 'false')) {
                    setIsPremium(stripeStatus);
                    await AsyncStorage.setItem("@premium_status", JSON.stringify(stripeStatus));
                    console.log(`✅ Premium status updated from Stripe: ${stripeStatus}`);
                }
            }

            // Load usage data
            const usageData = await AsyncStorage.getItem("@usage_data");
            if (usageData !== null) {
                setCurrentUsage(JSON.parse(usageData));
            }

            // Load usage count cache
            const cacheData = await AsyncStorage.getItem("@usage_count_cache");
            if (cacheData !== null) {
                setUsageCountCache(JSON.parse(cacheData));
            }

            console.log("✅ Premium data loaded successfully");
        } catch (error) {
            console.error("❌ Error loading premium data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const setPremiumStatus = async (status: boolean) => {
        try {
            setIsPremium(status);
            await AsyncStorage.setItem("@premium_status", JSON.stringify(status));
            console.log(`Premium status updated to: ${status}`);
        } catch (error) {
            console.error("Error saving premium status:", error);
        }
    };

    const showPremiumPopup = (source: string) => {
        console.log(`Premium popup triggered from: ${source}`);
        setModalSource(source);
        setShowPremiumModal(true);
    };

    const hidePremiumPopup = () => {
        console.log("Premium popup hidden");
        setShowPremiumModal(false);
        setModalSource("");
    };

    const checkPremiumFeature = (featureId: string): boolean => {
        if (isPremium) return true;

        // Check if feature is available in free tier
        const freeTierFeatures = ["basic_routines", "basic_notes", "basic_stats"];
        return freeTierFeatures.includes(featureId);
    };

    // Track feature usage
    const trackFeatureUsage = (featureId: string) => {
        try {
            const currentCount = usageCountCache[featureId] || 0;
            const newCount = currentCount + 1;

            // Update cache immediately for synchronous access
            const newCache = { ...usageCountCache, [featureId]: newCount };
            setUsageCountCache(newCache);

            // Save to AsyncStorage asynchronously
            AsyncStorage.setItem("@usage_count_cache", JSON.stringify(newCache));
            AsyncStorage.setItem(`@feature_usage_${featureId}`, newCount.toString());

            console.log(`Feature usage tracked: ${featureId} = ${newCount}`);
        } catch (error) {
            console.error("Error tracking feature usage:", error);
        }
    };

    // Get usage count
    const getUsageCount = (featureId: string): number => {
        return usageCountCache[featureId] || 0;
    };

    // Check if limit reached
    const isLimitReached = (feature: keyof CurrentUsage): boolean => {
        if (isPremium) return false;

        const currentCount = currentUsage[feature];
        const limitKey = `max${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof FreeLimits;
        const limit = freeLimits[limitKey];

        return currentCount >= limit;
    };

    const updateUsage = async (feature: keyof CurrentUsage, count: number) => {
        try {
            const newUsage = {
                ...currentUsage,
                [feature]: count,
            };

            setCurrentUsage(newUsage);
            await AsyncStorage.setItem("@usage_data", JSON.stringify(newUsage));

            console.log(`Usage updated for ${feature}: ${count}`);
        } catch (error) {
            console.error("Error updating usage:", error);
        }
    };

    // ✅ NEW: Refresh subscription status from Stripe
    const refreshSubscriptionStatus = async (): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const stripeStatus = await checkStripeSubscriptionStatus(user.id);
            setIsPremium(stripeStatus);
            await AsyncStorage.setItem("@premium_status", JSON.stringify(stripeStatus));

            console.log(`🔄 Subscription status refreshed: ${stripeStatus}`);
            return stripeStatus;
        } catch (error) {
            console.error('❌ Error refreshing subscription status:', error);
            return false;
        }
    };

    const contextValue: PremiumContextType = {
        // Premium Status
        isPremium,
        isLoading,

        // Premium Features
        premiumFeatures,

        // Modal State
        showPremiumModal,
        modalSource,

        // Actions
        setPremiumStatus,
        showPremiumPopup,
        hidePremiumPopup,
        checkPremiumFeature,

        // Usage Tracking
        trackFeatureUsage,
        getUsageCount,

        // Free Limits
        freeLimits,

        // Current Usage
        currentUsage,

        // Limit Checking
        isLimitReached,
        updateUsage,

        // ✅ NEW: Stripe Integration
        refreshSubscriptionStatus,
    };

    return (
        <PremiumContext.Provider value={contextValue}>
            {children}
        </PremiumContext.Provider>
    );
};

// Hook to use Premium Context
export const usePremium = (): PremiumContextType => {
    const context = useContext(PremiumContext);
    if (context === undefined) {
        throw new Error("usePremium must be used within a PremiumProvider");
    }
    return context;
};

// Helper hook for premium feature checking
export const usePremiumFeature = (featureId: string) => {
    const { isPremium, checkPremiumFeature, showPremiumPopup } = usePremium();

    const isAvailable = checkPremiumFeature(featureId);

    const requirePremium = (source: string = "feature_gate") => {
        if (!isAvailable) {
            showPremiumPopup(source);
            return false;
        }
        return true;
    };

    return {
        isAvailable,
        isPremium,
        requirePremium,
    };
};

export default PremiumContext;