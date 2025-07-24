import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../ThemeContext';

const { width } = Dimensions.get('window');

interface PremiumModalProps {
    visible: boolean;
    onClose: () => void;
    onSubscribe: () => void;
}

export default function PremiumModal({ visible, onClose, onSubscribe }: PremiumModalProps) {
    const { colors } = useTheme();

    const features = [
        {
            icon: 'calendar',
            title: 'Calendar View',
            description: 'Schedule your entire day with our premium calendar interface',
            color: '#007AFF',
        },
        {
            icon: 'chatbubbles',
            title: 'AI Life Coach',
            description: 'Get personalized schedule optimization and life guidance from your AI companion',
            color: '#5856D6',
        },
        {
            icon: 'trophy',
            title: 'Advanced Stats',
            description: 'Track your best streaks and unlock detailed progress analytics',
            color: '#FFD700',
        },
        {
            icon: 'sparkles',
            title: 'Exclusive Features',
            description: 'Early access to new features and premium-only updates',
            color: '#FF2D55',
        },
    ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Premium Badge */}
                    <View style={styles.premiumBadgeContainer}>
                        <LinearGradient
                            colors={['#FFD700', '#FFA500', '#FF6347']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.premiumBadge}
                        >
                            <Ionicons name="star" size={32} color="white" />
                        </LinearGradient>
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.text }]}>
                        Unlock Premium
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Elevate your routine tracking experience
                    </Text>

                    {/* Pricing */}
                    <View style={[styles.pricingCard, { backgroundColor: colors.surface }]}>
                        <View style={styles.priceContainer}>
                            <Text style={[styles.currency, { color: colors.text }]}>$</Text>
                            <Text style={[styles.price, { color: colors.text }]}>2.94</Text>
                            <Text style={[styles.period, { color: colors.textSecondary }]}>/month</Text>
                        </View>
                        <Text style={[styles.priceDescription, { color: colors.textSecondary }]}>
                            Cancel anytime • No hidden fees
                        </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.featuresContainer}>
                        {features.map((feature, index) => (
                            <View
                                key={index}
                                style={[styles.featureCard, { backgroundColor: colors.surface }]}
                            >
                                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
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
                        ))}
                    </View>

                    {/* Benefits Summary */}
                    <View style={[styles.benefitsCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.benefitsTitle, { color: colors.text }]}>
                            Why Go Premium?
                        </Text>
                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                <Text style={[styles.benefitText, { color: colors.text }]}>
                                    Transform your daily planning with visual scheduling
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                <Text style={[styles.benefitText, { color: colors.text }]}>
                                    Get personalized guidance from your AI companion
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                <Text style={[styles.benefitText, { color: colors.text }]}>
                                    Track progress with advanced analytics
                                </Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                <Text style={[styles.benefitText, { color: colors.text }]}>
                                    Support continued app development
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Subscribe Button */}
                    <TouchableOpacity
                        style={styles.subscribeButton}
                        onPress={onSubscribe}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#007AFF', '#0051D5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.subscribeGradient}
                        >
                            <Text style={styles.subscribeText}>Start Free Trial</Text>
                            <Text style={styles.subscribeSubtext}>Then $2.94/month</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Terms */}
                    <Text style={[styles.terms, { color: colors.textTertiary }]}>
                        By subscribing, you agree to our Terms of Service and Privacy Policy
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: 5,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    premiumBadgeContainer: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    premiumBadge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
    },
    pricingCard: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    currency: {
        fontSize: 24,
        fontWeight: '600',
        marginRight: 2,
    },
    price: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    period: {
        fontSize: 18,
        marginLeft: 4,
    },
    priceDescription: {
        fontSize: 14,
    },
    featuresContainer: {
        marginBottom: 30,
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    benefitsCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
    },
    benefitsTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    benefitsList: {
        gap: 12,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    benefitText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    subscribeButton: {
        marginBottom: 16,
    },
    subscribeGradient: {
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
    },
    subscribeText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 2,
    },
    subscribeSubtext: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
    },
    terms: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
});