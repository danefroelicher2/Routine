// ============================================
// src/components/PaymentChoiceModal.tsx
// FIXED: Payment Method Selection Modal (No TypeScript Errors)
// ============================================

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../ThemeContext';
import { appleIAPService, APPLE_PRODUCT_IDS } from '../services/appleIAPService';

interface PaymentChoice {
    id: 'apple' | 'stripe';
    title: string;
    subtitle: string;
    icon: string;
    badge?: string;
    price?: string;
    color: string;
    available: boolean;
}

interface PaymentChoiceModalProps {
    visible: boolean;
    onClose: () => void;
    planId: string; // 'monthly', 'yearly', 'monthlyAI', 'yearlyAI'
    planName: string; // 'Premium Monthly', etc.
    onApplePurchase: (productId: string) => Promise<void>;
    onStripePurchase: (planId: string) => Promise<void>;
}

const PaymentChoiceModal: React.FC<PaymentChoiceModalProps> = ({
    visible,
    onClose,
    planId,
    planName,
    onApplePurchase,
    onStripePurchase,
}) => {
    const { colors } = useTheme();
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [applePrice, setApplePrice] = useState<string>('');
    const [isLoading, setIsLoading] = useState<string | null>(null);

    // Map your planId to Apple product IDs
    const getAppleProductId = (planId: string): string => {
        const mapping: Record<string, string> = {
            'monthly': APPLE_PRODUCT_IDS.premium_monthly,
            'yearly': APPLE_PRODUCT_IDS.premium_yearly,
            'monthlyAI': APPLE_PRODUCT_IDS.premiumAI_monthly,
            'yearlyAI': APPLE_PRODUCT_IDS.premiumAI_yearly,
        };
        return mapping[planId] || '';
    };

    // Initialize Apple IAP when modal opens
    useEffect(() => {
        const initializeAppleIAP = async () => {
            if (visible && Platform.OS === 'ios') {
                try {
                    const initialized = await appleIAPService.initialize();
                    setAppleAvailable(initialized);

                    if (initialized) {
                        const products = await appleIAPService.loadProducts();
                        const appleProductId = getAppleProductId(planId);
                        const product = products.find(p => p.productId === appleProductId);

                        if (product) {
                            setApplePrice(product.localizedPrice);
                        }
                    }
                } catch (error) {
                    console.error('Error initializing Apple IAP:', error);
                    setAppleAvailable(false);
                }
            }
        };

        initializeAppleIAP();
    }, [visible, planId]);

    // Map plan prices for Stripe (your current prices)
    const getStripePrice = (planId: string): string => {
        const prices: Record<string, string> = {
            'monthly': '$2.94/month',
            'yearly': '$27.99/year',
            'monthlyAI': '$7.99/month',
            'yearlyAI': '$74.99/year',
        };
        return prices[planId] || '';
    };

    const paymentChoices: PaymentChoice[] = [
        {
            id: 'apple',
            title: 'App Store',
            subtitle: 'Pay with Apple ID • Managed by Apple',
            icon: 'logo-apple',
            badge: applePrice || 'Loading...',
            color: '#007AFF',
            available: appleAvailable && Platform.OS === 'ios',
        },
        {
            id: 'stripe',
            title: 'Credit Card',
            subtitle: 'Secure web payment • Managed directly',
            icon: 'card',
            badge: getStripePrice(planId),
            color: '#6772E5',
            available: true,
        },
    ];

    const handlePaymentChoice = async (choice: PaymentChoice) => {
        if (!choice.available || isLoading) return;

        try {
            setIsLoading(choice.id);

            if (choice.id === 'apple') {
                const appleProductId = getAppleProductId(planId);
                if (!appleProductId) {
                    Alert.alert('Error', 'Apple product not found for this plan');
                    return;
                }
                await onApplePurchase(appleProductId);
            } else {
                await onStripePurchase(planId);
            }

            // Close modal after successful purchase initiation
            onClose();
        } catch (error) {
            console.error('Payment choice error:', error);
            Alert.alert('Error', 'Failed to start payment process');
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Choose Payment Method
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {planName}
                        </Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Payment Options */}
                    <View style={styles.optionsContainer}>
                        {paymentChoices.map((choice) => (
                            <TouchableOpacity
                                key={choice.id}
                                style={[
                                    styles.choiceCard,
                                    {
                                        backgroundColor: colors.background,
                                        borderColor: choice.available ? choice.color : colors.border,
                                        opacity: choice.available ? 1 : 0.6,
                                    }
                                ]}
                                onPress={() => handlePaymentChoice(choice)}
                                disabled={!choice.available || isLoading !== null}
                            >
                                <View style={styles.choiceContent}>
                                    <View style={[
                                        styles.iconContainer,
                                        { backgroundColor: `${choice.color}20` } // Fixed: Use template literal
                                    ]}>
                                        {isLoading === choice.id ? (
                                            <ActivityIndicator color={choice.color} size="small" />
                                        ) : (
                                            <Ionicons
                                                name={choice.icon as any}
                                                size={24}
                                                color={choice.color}
                                            />
                                        )}
                                    </View>

                                    <View style={styles.choiceText}>
                                        <Text style={[styles.choiceTitle, { color: colors.text }]}>
                                            {choice.title}
                                        </Text>
                                        <Text style={[styles.choiceSubtitle, { color: colors.textSecondary }]}>
                                            {choice.subtitle}
                                        </Text>
                                    </View>

                                    <View style={styles.choiceRight}>
                                        {choice.badge && (
                                            <Text style={[
                                                styles.priceBadge,
                                                {
                                                    color: choice.color,
                                                    backgroundColor: `${choice.color}15` // Fixed: Use template literal
                                                }
                                            ]}>
                                                {choice.badge}
                                            </Text>
                                        )}
                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            • Both options provide the same premium features{'\n'}
                            • Subscriptions auto-renew until cancelled{'\n'}
                            • Cancel anytime in your account settings
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        position: 'relative',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsContainer: {
        gap: 12,
        marginBottom: 24,
    },
    choiceCard: {
        borderRadius: 12,
        borderWidth: 2,
        padding: 16,
    },
    choiceContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    choiceText: {
        flex: 1,
    },
    choiceTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    choiceSubtitle: {
        fontSize: 14,
        lineHeight: 18,
    },
    choiceRight: {
        alignItems: 'flex-end',
        gap: 8,
    },
    priceBadge: {
        fontSize: 14,
        fontWeight: '600',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    infoSection: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
    },
    infoText: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
});

export default PaymentChoiceModal;