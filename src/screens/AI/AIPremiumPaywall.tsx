// ============================================
// AI Premium Paywall Screen
// src/screens/AI/AIPremiumPaywall.tsx
// ============================================

import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../ThemeContext';
import { supabase } from '../../services/supabase';

const { width, height } = Dimensions.get('window');

interface AIPremiumPaywallProps {
    navigation: any;
}

interface PremiumFeature {
    icon: string;
    title: string;
    description: string;
    color: string;
}

const AIPremiumPaywall: React.FC<AIPremiumPaywallProps> = ({ navigation }) => {
    const { colors } = useTheme();
    const [isProcessing, setIsProcessing] = useState(false);

    // Premium AI features
    const aiFeatures: PremiumFeature[] = [
        {
            icon: "chatbubbles",
            title: "Unlimited AI Chat",
            description: "Get personalized routine suggestions and habit coaching anytime",
            color: "#FF6B6B"
        },
        {
            icon: "calendar",
            title: "Smart Calendar Integration",
            description: "AI analyzes your schedule to suggest optimal routine timing",
            color: "#4ECDC4"
        },
        {
            icon: "analytics",
            title: "AI Insights & Analytics",
            description: "Deep analysis of your habits with personalized improvement tips",
            color: "#45B7D1"
        },
        {
            icon: "bulb",
            title: "Intelligent Recommendations",
            description: "AI learns your patterns and suggests new routines for success",
            color: "#96CEB4"
        },
        {
            icon: "trending-up",
            title: "Progress Predictions",
            description: "See forecasted progress and get motivated by future achievements",
            color: "#FFEAA7"
        },
        {
            icon: "shield-checkmark",
            title: "Priority AI Support",
            description: "Faster responses and advanced AI models for premium users",
            color: "#DDA0DD"
        }
    ];

    const handleUpgrade = async () => {
        try {
            setIsProcessing(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please log in to upgrade to Premium');
                return;
            }

            console.log('🚀 Starting Premium upgrade from AI paywall');

            // Call our payment API
            const response = await fetch('http://localhost:3001/create-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    userEmail: user.email,
                    planId: 'monthly' // Default to monthly for now
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Payment error:', errorText);
                throw new Error('Failed to create payment session');
            }

            const data = await response.json();
            console.log('✅ Payment response:', data);

            if (data.testMode) {
                Alert.alert(
                    '🚀 Upgrade Success!',
                    'Welcome to Premium! You now have unlimited AI access.',
                    [{ text: 'Start Using AI', onPress: () => navigation.navigate('AIChatMain') }]
                );
            } else if (data.url) {
                // Open Stripe checkout
                const { Linking } = require('react-native');
                await Linking.openURL(data.url);
            }

        } catch (error) {
            console.error('❌ Upgrade failed:', error);
            Alert.alert('Upgrade Failed', 'Something went wrong. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderFeature = (feature: PremiumFeature, index: number) => (
        <Animated.View
            key={index}
            style={[
                styles.featureCard,
                { backgroundColor: colors.surface, borderColor: colors.border }
            ]}
        >
            <View style={[styles.featureIcon, { backgroundColor: feature.color + '15' }]}>
                <Ionicons name={feature.icon as any} size={28} color={feature.color} />
            </View>
            <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                    {feature.description}
                </Text>
            </View>
        </Animated.View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    AI Premium
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.heroSection}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.heroIcon}>
                        <Ionicons name="chatbubbles" size={60} color="#FFFFFF" />
                    </View>
                    <Text style={styles.heroTitle}>
                        Unlock AI-Powered{'\n'}Routine Coaching
                    </Text>
                    <Text style={styles.heroSubtitle}>
                        Get personalized habit recommendations, smart scheduling, and insights that adapt to your lifestyle
                    </Text>
                </LinearGradient>

                {/* Pricing */}
                <View style={styles.pricingSection}>
                    <View style={[styles.pricingCard, { backgroundColor: colors.surface, borderColor: '#007AFF' }]}>
                        <View style={styles.pricingBadge}>
                            <Text style={styles.pricingBadgeText}>BEST VALUE</Text>
                        </View>
                        <Text style={[styles.pricingTitle, { color: colors.text }]}>Premium Monthly</Text>
                        <View style={styles.pricingPrice}>
                            <Text style={[styles.price, { color: colors.text }]}>$2.94</Text>
                            <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/month</Text>
                        </View>
                        <Text style={[styles.pricingSubtext, { color: colors.textSecondary }]}>
                            Less than a coffee per month for unlimited AI coaching
                        </Text>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.featuresSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        What You'll Get
                    </Text>
                    {aiFeatures.map((feature, index) => renderFeature(feature, index))}
                </View>

                {/* Social Proof */}
                <View style={[styles.socialProofSection, { backgroundColor: colors.surface }]}>
                    <View style={styles.socialProofHeader}>
                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons key={star} name="star" size={20} color="#FFD700" />
                            ))}
                        </View>
                        <Text style={[styles.socialProofText, { color: colors.text }]}>
                            "The AI coaching completely transformed my daily routine. I'm more productive than ever!"
                        </Text>
                        <Text style={[styles.socialProofAuthor, { color: colors.textSecondary }]}>
                            - Sarah K., Premium User
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom CTA */}
            <View style={[styles.bottomSection, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.upgradeButton, isProcessing && styles.upgradeButtonDisabled]}
                    onPress={handleUpgrade}
                    disabled={isProcessing}
                >
                    <LinearGradient
                        colors={['#007AFF', '#0051D5']}
                        style={styles.upgradeButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {isProcessing ? (
                            <View style={styles.processingContainer}>
                                <Text style={styles.upgradeButtonText}>Processing...</Text>
                            </View>
                        ) : (
                            <>
                                <Ionicons name="rocket" size={24} color="#FFFFFF" />
                                <Text style={styles.upgradeButtonText}>Start My Premium Journey</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                    Cancel anytime • No commitment • Instant access
                </Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    heroSection: {
        padding: 32,
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 20,
    },
    heroIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 34,
    },
    heroSubtitle: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
        opacity: 0.9,
        lineHeight: 24,
    },
    pricingSection: {
        padding: 20,
    },
    pricingCard: {
        padding: 24,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        position: 'relative',
    },
    pricingBadge: {
        position: 'absolute',
        top: -12,
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    pricingBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    pricingTitle: {
        fontSize: 24,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 8,
    },
    pricingPrice: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    price: {
        fontSize: 48,
        fontWeight: '700',
    },
    pricePeriod: {
        fontSize: 18,
        marginLeft: 4,
    },
    pricingSubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
    featuresSection: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    featureCard: {
        flexDirection: 'row',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    featureIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    featureContent: {
        flex: 1,
        justifyContent: 'center',
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    socialProofSection: {
        margin: 20,
        padding: 24,
        borderRadius: 16,
    },
    socialProofHeader: {
        alignItems: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    socialProofText: {
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    socialProofAuthor: {
        fontSize: 14,
        fontWeight: '500',
    },
    bottomSection: {
        padding: 20,
        borderTopWidth: 1,
    },
    upgradeButton: {
        marginBottom: 12,
    },
    upgradeButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 12,
    },
    upgradeButtonDisabled: {
        opacity: 0.7,
    },
    processingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    disclaimer: {
        fontSize: 12,
        textAlign: 'center',
    },
});

export default AIPremiumPaywall;