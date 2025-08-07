// File: src/components/subscription/MonthlyCancellationFlow.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../../ThemeContext';

interface RetentionEligibility {
    eligible: boolean;
    currentPlan: string;
    reason: string;
}

interface MonthlyCancellationFlowProps {
    onClose: () => void;
}

const MonthlyCancellationFlow: React.FC<MonthlyCancellationFlowProps> = ({ onClose }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [eligibility, setEligibility] = useState<RetentionEligibility | null>(null);
    const [processingOffer, setProcessingOffer] = useState(false);

    useEffect(() => {
        checkRetentionEligibility();
    }, []);

    const checkRetentionEligibility = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            console.log('🔍 Checking retention eligibility for user:', user.id);
            const response = await fetch(`http://localhost:3001/check-retention-eligibility?userId=${user.id}`);
            const data = await response.json();

            console.log('📋 Retention eligibility result:', data);
            setEligibility(data);
        } catch (error) {
            console.error('Error checking retention eligibility:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptRetentionOffer = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setProcessingOffer(true);
            console.log('💰 Creating retention offer for user:', user.id);

            const response = await fetch('http://localhost:3001/create-monthly-retention-offer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    userEmail: user.email
                }),
            });

            const data = await response.json();
            console.log('🎯 Retention offer response:', data);

            if (data.success && data.url) {
                console.log('🎯 Opening 3-month retention offer:', data.url);
                await Linking.openURL(data.url);
                onClose(); // Close the modal
            } else {
                throw new Error(data.error || 'Failed to create retention offer');
            }

        } catch (error) {
            console.error('❌ Retention offer error:', error);
            Alert.alert('Error', 'Unable to create special offer. Please try again.');
        } finally {
            setProcessingOffer(false);
        }
    };

    const handleProceedWithCancellation = () => {
        Alert.alert(
            'Proceed with Cancellation',
            'You will be redirected to manage your subscription and complete the cancellation.',
            [
                { text: 'Go Back', style: 'cancel' },
                {
                    text: 'Continue to Cancel',
                    style: 'destructive',
                    onPress: () => {
                        // Here you would open Stripe customer portal or your cancellation method
                        console.log('🚫 Proceeding with regular cancellation');
                        Alert.alert('Cancellation', 'This would redirect to Stripe customer portal for cancellation.');
                        onClose();
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                    Checking your subscription...
                </Text>
            </View>
        );
    }

    if (!eligibility?.eligible) {
        // Not eligible for retention offer, proceed with regular cancellation
        return (
            <View style={styles.container}>
                <Text style={[styles.title, { color: colors.text }]}>
                    Cancel Subscription
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {eligibility?.reason || 'Proceeding with cancellation'}
                </Text>

                <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleProceedWithCancellation}
                >
                    <Text style={styles.cancelButtonText}>
                        Continue with Cancellation
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.keepButton]}
                    onPress={onClose}
                >
                    <Text style={[styles.keepButtonText, { color: colors.text }]}>
                        Keep My Subscription
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Show retention offer for eligible monthly subscribers
    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.text }]}>
                Wait! Special Offer 🎉
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Before you cancel, how about this exclusive deal?
            </Text>

            <View style={[styles.offerBox, { backgroundColor: colors.surface }]}>
                <Text style={styles.offerTitle}>
                    67% OFF for 3 Months!
                </Text>
                <Text style={styles.offerPrice}>
                    $0.97/month
                </Text>
                <Text style={[styles.offerDetails, { color: colors.textSecondary }]}>
                    Instead of $2.94/month
                </Text>
                <Text style={[styles.offerSubtext, { color: colors.textSecondary }]}>
                    After 3 months, returns to regular $2.94/month
                </Text>
                <Text style={styles.savings}>
                    Save $5.91 over the next 3 months!
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={handleAcceptRetentionOffer}
                disabled={processingOffer}
            >
                {processingOffer ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text style={styles.acceptButtonText}>
                        Yes! Give me this deal
                    </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={handleProceedWithCancellation}
            >
                <Text style={[styles.declineButtonText, { color: colors.textSecondary }]}>
                    No thanks, cancel anyway
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 24,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        marginTop: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    offerBox: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    offerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 8,
    },
    offerPrice: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 4,
    },
    offerDetails: {
        fontSize: 16,
        textDecorationLine: 'line-through',
        marginBottom: 8,
    },
    offerSubtext: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 12,
    },
    savings: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF6B6B',
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    acceptButton: {
        backgroundColor: '#007AFF',
    },
    acceptButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    declineButton: {
        backgroundColor: 'transparent',
    },
    declineButtonText: {
        fontSize: 14,
    },
    cancelButton: {
        backgroundColor: '#FF6B6B',
    },
    cancelButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    keepButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    keepButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MonthlyCancellationFlow;