// ============================================
// FIXED src/components/PremiumButton.tsx
// Replace your entire PremiumButton.tsx with this corrected version
// ============================================

import React from "react";
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    View,
    ViewStyle,
    TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../ThemeContext";
import { usePremium } from "../contexts/PremiumContext";

interface PremiumButtonProps {
    // Button variants
    variant?: "primary" | "secondary" | "minimal" | "badge";

    // Size options
    size?: "small" | "medium" | "large";

    // Custom text
    text?: string;

    // Source tracking
    source: string;

    // Style overrides
    style?: ViewStyle;
    textStyle?: TextStyle;

    // Icon options
    showIcon?: boolean;
    iconName?: string;

    // Behavior
    onPress?: () => void; // Optional custom onPress
}

const PremiumButton: React.FC<PremiumButtonProps> = ({
    variant = "primary",
    size = "medium",
    text,
    source,
    style,
    textStyle,
    showIcon = true,
    iconName = "diamond",
    onPress,
}) => {
    const { colors } = useTheme();
    const { isPremium, showPremiumPopup } = usePremium();

    // Don't show button if user is already premium (unless custom onPress provided)
    if (isPremium && !onPress) {
        return null;
    }

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            showPremiumPopup(source);
        }
    };

    // Get default text based on variant
    const getDefaultText = () => {
        switch (variant) {
            case "badge":
                return "PRO";
            case "minimal":
                return "Upgrade";
            default:
                return "Go Premium";
        }
    };

    const buttonText = text || getDefaultText();

    // Style configurations based on variant and size
    const getButtonStyles = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
        };

        // Size configurations
        const sizeConfig = {
            small: {
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
            },
            medium: {
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
            },
            large: {
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 10,
            },
        };

        // Variant configurations
        const variantConfig = {
            primary: {
                backgroundColor: "#007AFF",
                borderWidth: 0,
            },
            secondary: {
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: "#007AFF",
            },
            minimal: {
                backgroundColor: "transparent",
                borderWidth: 0,
            },
            badge: {
                backgroundColor: "#FFD700",
                borderWidth: 1,
                borderColor: "#FFA500",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 12,
            },
        };

        return {
            ...baseStyle,
            ...sizeConfig[size],
            ...variantConfig[variant],
        };
    };

    const getTextStyles = (): TextStyle => {
        const baseStyle: TextStyle = {
            fontWeight: "600",
        };

        // Size configurations
        const sizeConfig = {
            small: {
                fontSize: 12,
            },
            medium: {
                fontSize: 14,
            },
            large: {
                fontSize: 16,
            },
        };

        // Variant configurations
        const variantConfig = {
            primary: {
                color: "#fff",
            },
            secondary: {
                color: "#007AFF",
            },
            minimal: {
                color: "#007AFF",
            },
            badge: {
                color: "#000",
                fontSize: 10,
                fontWeight: "700" as TextStyle["fontWeight"],
            },
        };

        return {
            ...baseStyle,
            ...sizeConfig[size],
            ...variantConfig[variant],
        };
    };

    const getIconSize = () => {
        const sizeMap = {
            small: 12,
            medium: 16,
            large: 20,
        };
        return variant === "badge" ? 8 : sizeMap[size];
    };

    const getIconColor = () => {
        switch (variant) {
            case "primary":
                return "#fff";
            case "badge":
                return "#000";
            default:
                return "#007AFF";
        }
    };

    const buttonStyles = getButtonStyles();
    const textStyles = getTextStyles();

    return (
        <TouchableOpacity
            style={[buttonStyles, style]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            {showIcon && (
                <View style={{ marginRight: variant === "badge" ? 2 : 4 }}>
                    <Ionicons
                        name={iconName as any}
                        size={getIconSize()}
                        color={getIconColor()}
                    />
                </View>
            )}
            <Text style={[textStyles, textStyle]}>{buttonText}</Text>
        </TouchableOpacity>
    );
};

// Specific button variants for common use cases
export const PremiumBadge: React.FC<{
    source: string;
    style?: ViewStyle;
}> = ({ source, style }) => (
    <PremiumButton
        variant="badge"
        size="small"
        source={source}
        style={style}
    />
);

export const PremiumUpgradeButton: React.FC<{
    source: string;
    text?: string;
    style?: ViewStyle;
}> = ({ source, text, style }) => (
    <PremiumButton
        variant="primary"
        size="large"
        text={text || "Upgrade to Premium"}
        source={source}
        style={style}
    />
);

export const PremiumMinimalButton: React.FC<{
    source: string;
    text?: string;
    style?: ViewStyle;
}> = ({ source, text, style }) => (
    <PremiumButton
        variant="minimal"
        size="medium"
        text={text || "Upgrade"}
        source={source}
        style={style}
    />
);

// Feature gate component - shows premium button when feature is locked
export const PremiumFeatureGate: React.FC<{
    featureId: string;
    source: string;
    children: React.ReactNode;
    fallbackText?: string;
}> = ({ featureId, source, children, fallbackText }) => {
    const { checkPremiumFeature } = usePremium();
    const { colors } = useTheme();

    const isAvailable = checkPremiumFeature(featureId);

    if (isAvailable) {
        return <>{children}</>;
    }

    return (
        <View style={[styles.featureGate, { backgroundColor: colors.surface }]}>
            <View style={styles.featureGateContent}>
                <Ionicons name="lock-closed" size={24} color={colors.textSecondary} />
                <Text style={[styles.featureGateText, { color: colors.textSecondary }]}>
                    {fallbackText || "This feature requires Premium"}
                </Text>
                <PremiumButton
                    variant="secondary"
                    size="small"
                    text="Unlock"
                    source={source}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    featureGate: {
        padding: 20,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(0, 122, 255, 0.2)",
        borderStyle: "dashed",
    },
    featureGateContent: {
        alignItems: "center",
        gap: 8,
    },
    featureGateText: {
        fontSize: 14,
        textAlign: "center",
    },
});

export default PremiumButton;