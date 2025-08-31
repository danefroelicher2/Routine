// ============================================
// src/screens/Premium/PremiumScreen.tsx
// Main Premium Screen Component - DIRECT PAYMENT ON CARD CLICK
// ============================================

import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Alert,
    Animated,
    AppState
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../ThemeContext";
import { Linking } from 'react-native';
import { supabase } from "../../services/supabase";
import { usePremium } from "../../contexts/PremiumContext";


const { width } = Dimensions.get("window");

interface PremiumScreenProps {
    navigation: any;
    route?: {
        params?: {
            source?: string; // Track where user came from
        };
    };
}

interface PremiumFeature {
    icon: string;
    title: string;
    description: string;
    color: string;
}

interface PricingPlan {
    id: string;
    name: string;
    price: string;
    originalPrice?: string;
    period: string;
    savings?: string;
    popular?: boolean;
    features: string[];
    tier: 'free' | 'premium' | 'premiumAI';  // ✅ ADD THIS LINE
    hasAI: boolean;                           // ✅ ADD THIS LINE
}

const PremiumScreen: React.FC<PremiumScreenProps> = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { refreshSubscriptionStatus } = usePremium();
    const [isProcessing, setIsProcessing] = useState<string | null>(null); // Track which plan is processing
    const [isRefreshing, setIsRefreshing] = useState(false);
    const source = route?.params?.source || "unknown";

    // Auto-refresh premium status when app becomes active
    React.useEffect(() => {
        const handleAppStateChange = async (nextAppState: string) => {
            if (nextAppState === 'active') {
                console.log('🔄 App became active - checking for premium updates');

                setTimeout(async () => {
                    try {
                        setIsRefreshing(true);
                        await refreshSubscriptionStatus();
                        console.log('✅ Premium status refreshed automatically');
                    } catch (error) {
                        console.error('Error auto-refreshing premium status:', error);
                    } finally {
                        setIsRefreshing(false);
                    }
                }, 2000);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription?.remove();
        };
    }, [refreshSubscriptionStatus]);

    // ✅ UPDATED: Premium features data - NEW ORDER    // ✅ UPDATED: Premium features data - NEW ORDER
    const premiumFeatures: PremiumFeature[] = [
        {
            icon: "sparkles",
            title: "AI Coaching",
            description: "Personalized AI-powered recommendations and smart routine suggestions",
            color: "#FF6B6B",
        },
        {
            icon: "analytics",
            title: "Advanced Analytics",
            description: "Detailed insights, progress tracking, and comprehensive habit analysis",
            color: "#4ECDC4",
        },
        {
            icon: "calendar",
            title: "Smart Schedule Management",
            description: "Custom daily time ranges, flexible scheduling, and calendar integration",
            color: "#45B7D1",
        },
        {
            icon: "trophy",
            title: "Premium Badges",
            description: "Exclusive achievements, special rewards, and milestone celebrations",
            color: "#96CEB4",
        },
        {
            icon: "color-palette",
            title: "Personalization",
            description: "Complete customization of the app",
            color: "#FFEAA7",
        },
    ];

    // ✅ NEW: 4-Tier Pricing Structure
    const pricingPlans: PricingPlan[] = [
        {
            id: "monthly",
            name: "Premium",
            price: "$2.94",
            period: "per month",
            tier: 'premium',
            hasAI: false,
            features: [
                "Daily Calendar",
                "Advanced Analytics",
                "Priority Support",
                "Cancel Anytime"
            ]
        },
        {
            id: "yearly",
            name: "Premium",
            price: "$27.99",
            originalPrice: "$35.28",
            period: "per year",
            savings: "Save 20%",
            tier: 'premium',
            hasAI: false,
            features: [
                "All Premium Features",
                "Priority Support",
                "Early Access to New Features"
            ]
        },
        {
            id: "monthlyAI",
            name: "Premium + AI",
            price: "$7.99",
            period: "per month",
            popular: true,
            tier: 'premiumAI',
            hasAI: true,
            features: [
                "Everything in Premium",
                "🤖 Unlimited AI Assistant",
                "Personalized Recommendations",
                "Smart Scheduling"
            ]
        },
        {
            id: "yearlyAI",
            name: "Premium + AI",
            price: "$74.99",
            originalPrice: "$95.88",
            period: "per year",
            savings: "Save 22%",
            tier: 'premiumAI',
            hasAI: true,
            features: [
                "Everything in Premium",
                "🤖 Unlimited AI Assistant",
                "Priority AI Responses",
                "Advanced AI Coaching"
            ]
        },
    ];
    const handleDirectPurchase = async (planId: string) => {
        setIsProcessing(planId);
        console.log(`🚀 Direct purchase for plan: ${planId} from source: ${source}`);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert("Error", "Please sign in to continue");
                setIsProcessing(null);
                return;
            }

            console.log('🚀 Starting Stripe checkout for plan:', planId);

            // ✅ POST REQUEST TO YOUR LOCAL SERVER

            const response = await fetch('https://routine-payments-v3-qa2nirx2j-dane-froelichers-projects.vercel.app/api/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    userEmail: user.email,
                    planId: planId
                }),
            });

            console.log('📊 Create-payment response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Create-payment error response:', errorText);
                throw new Error('Failed to create checkout session');
            }

            const data = await response.json();
            console.log('✅ Payment response:', data);

            if (data.url) {  // Remove data.success check since your backend doesn't send it
                // Open the REAL Stripe checkout URL
                console.log(`💳 Opening Stripe checkout: ${data.url}`);

                const supported = await Linking.canOpenURL(data.url);
                if (supported) {
                    await Linking.openURL(data.url);
                    console.log("🌐 Opened Stripe checkout in browser");

                    // Show helpful message
                    Alert.alert(
                        "Payment in Progress",
                        "After completing your purchase, return to the app. Your premium status will update automatically!",
                        [{ text: "OK" }]
                    );
                } else {
                    Alert.alert("Error", "Unable to open payment page");
                }
            } else {
                throw new Error('No checkout URL received from server');
            }
        } catch (error) {
            console.error(`❌ Purchase error for ${planId}:`, error);
            Alert.alert("Error", "Failed to start purchase. Please try again.");
        } finally {
            setIsProcessing(null);
        }
    };
    const renderFeature = (feature: PremiumFeature, index: number) => (
        <View key={index} style={[styles.featureItem, { backgroundColor: colors.surface }]}>
            <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                <Ionicons name={feature.icon as any} size={24} color="#FFFFFF" />
            </View>
            <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                    {feature.description}
                </Text>
            </View>
        </View>
    );

    const renderPricingPlan = (plan: PricingPlan) => {
        const isCurrentlyProcessing = isProcessing === plan.id;

        return (
            <TouchableOpacity
                key={plan.id}
                style={[
                    styles.pricingCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: "#007AFF", // ✅ PERMANENT BLUE BORDER
                        borderWidth: 2, // Make sure border is visible
                    },
                    plan.popular && styles.popularCard,
                    isCurrentlyProcessing && styles.processingCard,
                ]}
                onPress={() => handleDirectPurchase(plan.id)}
                disabled={isProcessing !== null} // Disable all cards when any is processing
            >
                {plan.popular && (
                    <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>Most Popular</Text>
                    </View>
                )}

                <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>

                <View style={styles.priceContainer}>
                    <Text style={[styles.price, { color: colors.text }]}>{plan.price}</Text>
                    {plan.originalPrice && (
                        <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                            {plan.originalPrice}
                        </Text>
                    )}
                </View>

                <Text style={[styles.period, { color: colors.textSecondary }]}>{plan.period}</Text>

                {plan.savings && (
                    <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>{plan.savings}</Text>
                    </View>
                )}

                <View style={styles.planFeatures}>
                    {plan.features.map((feature, index) => (
                        <View key={index} style={styles.planFeature}>
                            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                            <Text style={[styles.planFeatureText, { color: colors.textSecondary }]}>
                                {feature}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* ✅ PROCESSING INDICATOR */}
                {isCurrentlyProcessing && (
                    <View style={styles.processingOverlay}>
                        <Text style={styles.processingText}>Opening payment...</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Upgrade to Premium</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <Text style={[styles.heroTitle, { color: colors.text }]}>
                        Unlock Your Full Potential
                    </Text>
                    <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                        Get access to premium features and take your routine building to the next level
                    </Text>
                </View>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Premium Features
                    </Text>
                    {premiumFeatures.map((feature, index) => renderFeature(feature, index))}
                </View>

                {/* Pricing Section */}
                <View style={styles.pricingSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Choose Your Plan
                    </Text>

                    {pricingPlans.map(renderPricingPlan)}
                </View>

                {/* ✅ REMOVED: Purchase Button Section - No longer needed! */}

                {/* Footer */}
                <View style={styles.footerSection}>
                    <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                        Cancel anytime. No commitments.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
    },
    scrollView: {
        flex: 1,
    },
    heroSection: {
        padding: 24,
        alignItems: "center",
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 22,
    },
    featuresSection: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 16,
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 18,
    },
    pricingSection: {
        padding: 20,
    },
    pricingSubtitle: {
        fontSize: 14,
        textAlign: "center",
        marginBottom: 20,
        fontStyle: "italic",
    },
    pricingCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        position: "relative",
        // ✅ Enhanced visual feedback for clickable cards
        shadowColor: "#007AFF",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    popularCard: {
        // Keep the same style, border is already permanent blue
    },
    processingCard: {
        opacity: 0.7,
    },
    popularBadge: {
        position: "absolute",
        top: -10,
        left: 20,
        backgroundColor: "#007AFF",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularBadgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    planName: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
    priceContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        marginBottom: 4,
    },
    price: {
        fontSize: 24,
        fontWeight: "700",
        marginRight: 8,
    },
    originalPrice: {
        fontSize: 16,
        textDecorationLine: "line-through",
    },
    period: {
        fontSize: 14,
        marginBottom: 12,
    },
    savingsBadge: {
        backgroundColor: "#34C759",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: "flex-start",
        marginBottom: 12,
    },
    savingsText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    planFeatures: {
        gap: 8,
    },
    planFeature: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    planFeatureText: {
        fontSize: 14,
        flex: 1,
    },
    processingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 122, 255, 0.1)",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    processingText: {
        color: "#007AFF",
        fontSize: 16,
        fontWeight: "600",
    },
    footerSection: {
        padding: 20,
        paddingBottom: 40,
        alignItems: "center",
    },
    disclaimer: {
        fontSize: 12,
        textAlign: "center",
    },
});

export default PremiumScreen;