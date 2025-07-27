// ============================================
// src/components/PremiumModal.tsx
// Reusable Premium Modal Component
// ============================================

import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../ThemeContext";

const { width, height } = Dimensions.get("window");

interface PremiumModalProps {
    visible: boolean;
    onClose: () => void;
    onUpgrade: () => void;
    title?: string;
    subtitle?: string;
    features?: string[];
    source?: string; // Track where modal was triggered from
}

const PremiumModal: React.FC<PremiumModalProps> = ({
    visible,
    onClose,
    onUpgrade,
    title = "Upgrade to Premium",
    subtitle = "Unlock all features and take your routine building to the next level",
    features = [
        "Unlimited Routines",
        "Advanced Analytics",
        "Cloud Sync",
        "AI Coaching",
        "Custom Themes",
        "Premium Support",
    ],
    source = "unknown",
}) => {
    const { colors } = useTheme();
    const slideAnim = useRef(new Animated.Value(height)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animate modal in
            console.log(`Premium modal opened from: ${source}`);
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Animate modal out
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: height,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleUpgrade = () => {
        console.log(`Premium upgrade triggered from modal (source: ${source})`);
        onUpgrade();
    };

    const handleClose = () => {
        console.log(`Premium modal closed (source: ${source})`);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                {/* Overlay Background */}
                <Animated.View
                    style={[
                        styles.overlayBackground,
                        {
                            opacity: overlayOpacity,
                        },
                    ]}
                />

                {/* Modal Content */}
                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            backgroundColor: colors.background,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* Handle Bar */}
                    <View style={styles.handleBar} />

                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        {/* Premium Icon */}
                        <View style={styles.iconContainer}>
                            <View style={styles.premiumIcon}>
                                <Ionicons name="diamond" size={32} color="#FFD700" />
                            </View>
                        </View>

                        {/* Title and Subtitle */}
                        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {subtitle}
                        </Text>

                        {/* Features List */}
                        <View style={styles.featuresContainer}>
                            {features.map((feature, index) => (
                                <View key={index} style={styles.featureRow}>
                                    <View style={styles.checkIcon}>
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                    </View>
                                    <Text style={[styles.featureText, { color: colors.text }]}>
                                        {feature}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Pricing Preview */}
                        <View style={[styles.pricingPreview, { backgroundColor: colors.surface }]}>
                            <View style={styles.pricingRow}>
                                <Text style={[styles.pricingLabel, { color: colors.textSecondary }]}>
                                    Starting at
                                </Text>
                                <View style={styles.pricingContainer}>
                                    <Text style={[styles.price, { color: colors.text }]}>$9.99</Text>
                                    <Text style={[styles.pricingPeriod, { color: colors.textSecondary }]}>
                                        /month
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.pricingNote, { color: colors.textTertiary }]}>
                                Cancel anytime • 7-day free trial
                            </Text>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.buttonsContainer}>
                            <TouchableOpacity
                                style={styles.upgradeButton}
                                onPress={handleUpgrade}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.laterButton, { backgroundColor: colors.surface }]}
                                onPress={handleClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.laterButtonText, { color: colors.textSecondary }]}>
                                    Maybe Later
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Trust Indicators */}
                        <View style={styles.trustIndicators}>
                            <View style={styles.trustItem}>
                                <Ionicons name="shield-checkmark" size={16} color="#34C759" />
                                <Text style={[styles.trustText, { color: colors.textTertiary }]}>
                                    Secure Payment
                                </Text>
                            </View>
                            <View style={styles.trustItem}>
                                <Ionicons name="refresh" size={16} color="#34C759" />
                                <Text style={[styles.trustText, { color: colors.textTertiary }]}>
                                    Cancel Anytime
                                </Text>
                            </View>
                            <View style={styles.trustItem}>
                                <Ionicons name="people" size={16} color="#34C759" />
                                <Text style={[styles.trustText, { color: colors.textTertiary }]}>
                                    10k+ Users
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
    },
    overlayBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContainer: {
        maxHeight: height * 0.85,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 34, // Account for home indicator on iOS
    },
    handleBar: {
        width: 36,
        height: 4,
        backgroundColor: "#D1D1D6",
        borderRadius: 2,
        alignSelf: "center",
        marginTop: 8,
        marginBottom: 8,
    },
    closeButton: {
        position: "absolute",
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    iconContainer: {
        alignItems: "center",
        marginTop: 20,
        marginBottom: 24,
    },
    premiumIcon: {
        width: 80,
        height: 80,
        backgroundColor: "rgba(255, 215, 0, 0.2)",
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#FFD700",
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    featuresContainer: {
        marginBottom: 24,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    checkIcon: {
        width: 24,
        height: 24,
        backgroundColor: "#34C759",
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    featureText: {
        fontSize: 16,
        flex: 1,
    },
    pricingPreview: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    pricingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 4,
    },
    pricingLabel: {
        fontSize: 14,
    },
    pricingContainer: {
        flexDirection: "row",
        alignItems: "baseline",
    },
    price: {
        fontSize: 20,
        fontWeight: "700",
    },
    pricingPeriod: {
        fontSize: 14,
        marginLeft: 2,
    },
    pricingNote: {
        fontSize: 12,
        textAlign: "center",
    },
    buttonsContainer: {
        gap: 12,
        marginBottom: 24,
    },
    upgradeButton: {
        backgroundColor: "#007AFF",
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    upgradeButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    laterButton: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: "center",
    },
    laterButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    trustIndicators: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 16,
    },
    trustItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    trustText: {
        fontSize: 12,
    },
});

export default PremiumModal;