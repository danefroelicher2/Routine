// ============================================
// FIXED src/contexts/PremiumContext.tsx
// Replace your entire PremiumContext.tsx with this corrected version
// ============================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

    // Usage Tracking - FIXED: Made synchronous
    trackFeatureUsage: (featureId: string) => void;
    getUsageCount: (featureId: string) => number;

    // Free Limits
    freeLimits: FreeLimits;

    // Current Usage
    currentUsage: CurrentUsage;

    // Check if limit reached - FIXED: Using proper type
    isLimitReached: (feature: keyof CurrentUsage) => boolean;
    updateUsage: (feature: keyof CurrentUsage, count: number) => void;
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

    // Usage Tracking
    const [currentUsage, setCurrentUsage] = useState<CurrentUsage>({
        routines: 0,
        notes: 0,
        aiQueries: 0,
    });

    // Usage count cache for synchronous access
    const [usageCountCache, setUsageCountCache] = useState<Record<string, number>>({});

    // Free tier limits - FIXED: Proper typing
    const freeLimits: FreeLimits = {
        maxRoutines: 5,
        maxNotes: 10,
        maxAIQueries: 3, // per day
    };

    // Premium features configuration
    const premiumFeatures: PremiumFeature[] = [
        {
            id: "unlimited_routines",
            name: "Unlimited Routines",
            description: "Create as many routines as you want",
            icon: "infinite",
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
            id: "ai_coaching",
            name: "AI Coaching",
            description: "Unlimited AI-powered recommendations",
            icon: "sparkles",
        },
        {
            id: "custom_themes",
            name: "Custom Themes",
            description: "Personalize your app appearance",
            icon: "color-palette",
        },
        {
            id: "premium_support",
            name: "Premium Support",
            description: "Priority customer support",
            icon: "headset",
        },
    ];

    // Load premium status and usage data on app start
    useEffect(() => {
        loadPremiumData();
    }, []);

    const loadPremiumData = async () => {
        try {
            setIsLoading(true);

            // Load premium status
            const premiumStatus = await AsyncStorage.getItem("@premium_status");
            if (premiumStatus !== null) {
                setIsPremium(JSON.parse(premiumStatus));
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

            console.log("Premium data loaded successfully");
        } catch (error) {
            console.error("Error loading premium data:", error);
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

    // FIXED: Made synchronous and updates cache
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

    // FIXED: Made synchronous using cache
    const getUsageCount = (featureId: string): number => {
        return usageCountCache[featureId] || 0;
    };

    // FIXED: Proper typing for feature parameter
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