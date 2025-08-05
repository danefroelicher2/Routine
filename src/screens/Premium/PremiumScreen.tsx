// ============================================
// src/screens/Premium/PremiumScreen.tsx
// Main Premium Screen Component
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../ThemeContext";
import { Linking } from 'react-native';
import { supabase } from "../../services/supabase";


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
}

const PremiumScreen: React.FC<PremiumScreenProps> = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [selectedPlan, setSelectedPlan] = useState<string>("monthly");
    const [isProcessing, setIsProcessing] = useState(false);
    const source = route?.params?.source || "unknown";

    // Premium features data
    const premiumFeatures: PremiumFeature[] = [
        {
            icon: "infinite",
            title: "Unlimited Routines",
            description: "Create as many routines as you want",
            color: "#FF6B6B",
        },
        {
            icon: "analytics",
            title: "Advanced Analytics",
            description: "Detailed insights and progress tracking",
            color: "#4ECDC4",
        },
        {
            icon: "cloud",
            title: "Cloud Sync",
            description: "Access your data across all devices",
            color: "#45B7D1",
        },
        {
            icon: "sparkles",
            title: "AI Coaching",
            description: "Personalized AI-powered recommendations",
            color: "#96CEB4",
        },
        {
            icon: "trophy",
            title: "Premium Badges",
            description: "Exclusive achievements and rewards",
            color: "#FFEAA7",
        },
        {
            icon: "color-palette",
            title: "Custom Themes",
            description: "Personalize your app appearance",
            color: "#DDA0DD",
        },
    ];

    // Pricing plans
    const pricingPlans: PricingPlan[] = [
        {
            id: "monthly",
            name: "Monthly",
            price: "$2.94",
            period: "per month",
            features: ["All Premium Features", "Cancel Anytime", "24/7 Support"],
        },
        {
            id: "yearly",
            name: "Yearly",
            price: "$27.99",
            originalPrice: "$34.99",
            period: "per year",
            savings: "Save 20%",
            popular: true,
            features: [
                "All Premium Features",
                "2 Months Free",
                "Priority Support",
                "Early Access to New Features",
            ],
        },

    ];
    const handlePurchase = async (planId: string) => {
        try {
            setIsProcessing(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please log in to upgrade to Premium');
                return;
            }

            console.log(`🚀 Starting Stripe checkout for plan: ${planId}`);
            console.log(`📊 Source: ${source}`);

            // ✅ YOUR ACTUAL VERCEL URL
            // ✅ NEW LOCAL SERVER URL
            const response = await fetch('http://localhost:3001/create-payment', {
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

            // Replace your error handling section with this:

            console.log(`📊 Create-checkout response status: ${response.status}`);
            console.log(`📊 Create-checkout response ok: ${response.ok}`);

            if (!response.ok) {
                // Get the raw response text first
                const errorText = await response.text();
                console.error('❌ Create-checkout error response:', errorText);

                // Try to parse as JSON, but handle if it's HTML
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || 'Failed to create checkout session');
                } catch (parseError) {
                    throw new Error(`API Error: ${response.status} - Server returned HTML instead of JSON`);
                }
            }

            // Get response text first, then parse
            const responseText = await response.text();
            console.log(`📊 Create-checkout raw response:`, responseText);

            try {
                const { url, sessionId } = JSON.parse(responseText);
                console.log(`✅ Checkout URL created: ${url}`);
                console.log(`🎫 Session ID: ${sessionId}`);

                // Open Stripe checkout in browser
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                    await Linking.openURL(url);
                    console.log(`🌐 Opened Stripe checkout in browser`);
                    console.log(`Premium checkout opened from: ${source}`);
                } else {
                    throw new Error('Cannot open checkout URL');
                }
            } catch (parseError) {
                console.error('❌ Create-checkout JSON Parse Error:', parseError);
                console.error('❌ Response was:', responseText);
                throw new Error('Server returned invalid JSON response');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const renderFeature = (feature: PremiumFeature, index: number) => (
        <View key={index} style={[styles.featureItem, { backgroundColor: colors.surface }]}>
            <View style={[styles.featureIcon, { backgroundColor: feature.color + "20" }]}>
                <Ionicons name={feature.icon as any} size={24} color={feature.color} />
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

    const renderPricingPlan = (plan: PricingPlan) => (
        <TouchableOpacity
            key={plan.id}
            style={[
                styles.pricingCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: selectedPlan === plan.id ? "#007AFF" : colors.border,
                },
                plan.popular && styles.popularCard,
            ]}
            onPress={() => setSelectedPlan(plan.id)}
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
        </TouchableOpacity>
    );

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

                {/* Purchase Button */}
                <View style={styles.purchaseSection}>
                    <TouchableOpacity
                        style={[
                            styles.purchaseButton,
                            isProcessing && styles.purchaseButtonDisabled,
                        ]}
                        onPress={() => handlePurchase(selectedPlan)}
                        disabled={isProcessing}
                    >
                        <Text style={styles.purchaseButtonText}>
                            {isProcessing ? "Processing..." : "Start Premium"}
                        </Text>
                    </TouchableOpacity>

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
    pricingCard: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        position: "relative",
    },
    popularCard: {
        borderColor: "#007AFF",
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
    purchaseSection: {
        padding: 20,
        paddingBottom: 40,
    },
    purchaseButton: {
        backgroundColor: "#007AFF",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 12,
    },
    purchaseButtonDisabled: {
        opacity: 0.6,
    },
    purchaseButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    disclaimer: {
        fontSize: 12,
        textAlign: "center",
    },
});

export default PremiumScreen;