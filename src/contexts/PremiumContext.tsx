// src/contexts/PremiumContext.tsx
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
    premiumTier: 'free' | 'premium' | 'premiumAI';
    hasAIAccess: boolean;

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

    // Stripe Integration
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
    const [premiumTier, setPremiumTier] = useState<'free' | 'premium' | 'premiumAI'>('free');
    const [hasAIAccess, setHasAIAccess] = useState(false);

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

    const checkStripeSubscriptionStatus = async (userId: string): Promise<{ isPremium: boolean, tier: 'free' | 'premium' | 'premiumAI', hasAIAccess: boolean }> => {
        try {
            console.log(`🔍 Checking Stripe subscription for user: ${userId}`);

            const url = `https://routine-payments-v4-m0v469p3g-dane-froelichers-projects.vercel.app/api/subscription-status?userId=${userId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log(`📊 Subscription status response status: ${response.status}`);
            console.log(`📊 Subscription status response ok: ${response.ok}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Subscription status error response:', errorText);
                return { isPremium: false, tier: 'free', hasAIAccess: false };
            }

            const responseText = await response.text();
            console.log("📊 Subscription status raw response:", responseText);

            try {
                const data = JSON.parse(responseText);
                console.log("✅ Subscription status data:", data);

                return {
                    isPremium: data.isPremium || false,
                    tier: data.tier || 'free',
                    hasAIAccess: data.hasAIAccess || false
                };
            } catch (parseError) {
                console.error('❌ Subscription status JSON Parse Error:', parseError);
                console.error('❌ Response was:', responseText);
                return { isPremium: false, tier: 'free', hasAIAccess: false };
            }

        } catch (error) {
            console.error('❌ Network Error:', error);
            return { isPremium: false, tier: 'free', hasAIAccess: false };
        }
    };

    // CRITICAL FIX: Non-blocking initialization for iPad compatibility
    useEffect(() => {
        loadPremiumDataNonBlocking();
    }, []);

    const loadPremiumDataNonBlocking = async () => {
        try {
            console.log("🚀 Starting non-blocking premium data load...");

            // STEP 1: Load cached data synchronously (non-blocking)
            const cachedPremiumStatus = await AsyncStorage.getItem("@premium_status");
            const cachedTier = await AsyncStorage.getItem("@premium_tier");
            const cachedAIAccess = await AsyncStorage.getItem("@ai_access");
            const usageData = await AsyncStorage.getItem("@usage_data");
            const cacheData = await AsyncStorage.getItem("@usage_count_cache");

            // Apply cached data immediately
            if (cachedPremiumStatus !== null) {
                setIsPremium(JSON.parse(cachedPremiumStatus));
            }
            if (cachedTier !== null) {
                setPremiumTier(cachedTier as 'free' | 'premium' | 'premiumAI');
            }
            if (cachedAIAccess !== null) {
                setHasAIAccess(JSON.parse(cachedAIAccess));
            }
            if (usageData !== null) {
                setCurrentUsage(JSON.parse(usageData));
            }
            if (cacheData !== null) {
                setUsageCountCache(JSON.parse(cacheData));
            }

            // CRITICAL: Set loading to false immediately - app can now render
            setIsLoading(false);
            console.log("✅ App ready to render with cached premium data");

            // STEP 2: Background subscription check (deferred, non-blocking)
            setTimeout(() => {
                checkSubscriptionInBackground();
            }, 100); // Small delay to ensure UI is mounted first

        } catch (error) {
            console.error("❌ Error loading cached premium data:", error);
            // Even on error, allow app to render
            setIsLoading(false);
        }
    };

    const checkSubscriptionInBackground = async () => {
        try {
            console.log("🔄 Starting background subscription check...");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log("❌ No user found for subscription check");
                return;
            }

            // Add 5-second timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Subscription check timeout')), 5000)
            );

            const subscriptionPromise = checkStripeSubscriptionStatus(user.id);

            let stripeStatus;
            try {
                stripeStatus = await Promise.race([subscriptionPromise, timeoutPromise]);
            } catch (timeoutError) {
                console.warn("⚠️ Subscription check timed out after 5 seconds - using cached data");
                return;
            }

            // Get current cached values for comparison
            const cachedPremiumStatus = await AsyncStorage.getItem("@premium_status");
            const cachedTier = await AsyncStorage.getItem("@premium_tier");
            const cachedAIAccess = await AsyncStorage.getItem("@ai_access");

            const oldStatus = JSON.parse(cachedPremiumStatus || 'false');
            const oldTier = cachedTier || 'free';
            const oldAIAccess = JSON.parse(cachedAIAccess || 'false');

            // Only update if status actually changed
            if (stripeStatus.isPremium !== oldStatus ||
                stripeStatus.tier !== oldTier ||
                stripeStatus.hasAIAccess !== oldAIAccess) {

                console.log("🔄 Premium status changed, updating...");

                setIsPremium(stripeStatus.isPremium);
                setPremiumTier(stripeStatus.tier);
                setHasAIAccess(stripeStatus.hasAIAccess);

                await AsyncStorage.setItem("@premium_status", JSON.stringify(stripeStatus.isPremium));
                await AsyncStorage.setItem("@premium_tier", stripeStatus.tier);
                await AsyncStorage.setItem("@ai_access", JSON.stringify(stripeStatus.hasAIAccess));

                console.log(`✅ Premium status updated from background check:`, stripeStatus);
            } else {
                console.log("✅ Premium status unchanged from background check");
            }

        } catch (error) {
            console.error("❌ Background subscription check failed (gracefully):", error);
            // Graceful failure - app continues with cached data
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
        // AI features require premiumAI tier
        if (featureId === "ai_assistant") {
            return hasAIAccess;
        }

        // All other premium features work with premium or premiumAI
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

    // Refresh subscription status from Stripe
    const refreshSubscriptionStatus = async (): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const stripeStatus = await checkStripeSubscriptionStatus(user.id);

            setIsPremium(stripeStatus.isPremium);
            setPremiumTier(stripeStatus.tier);
            setHasAIAccess(stripeStatus.hasAIAccess);

            await AsyncStorage.setItem("@premium_status", JSON.stringify(stripeStatus.isPremium));
            await AsyncStorage.setItem("@premium_tier", stripeStatus.tier);
            await AsyncStorage.setItem("@ai_access", JSON.stringify(stripeStatus.hasAIAccess));

            console.log(`🔄 Subscription status refreshed:`, stripeStatus);
            return stripeStatus.isPremium;
        } catch (error) {
            console.error('❌ Error refreshing subscription status:', error);
            return false;
        }
    };

    const contextValue: PremiumContextType = {
        // Premium Status
        isPremium,
        isLoading,
        premiumTier,
        hasAIAccess,

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

        // Stripe Integration
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