// AboutScreen.tsx - NEW FILE
// Place this in: src/screens/Profile/AboutScreen.tsx

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../ThemeContext';

export default function AboutScreen({ navigation }: any) {
    const { colors } = useTheme();

    const handleOptionPress = (option: 'Privacy' | 'Terms') => {
        navigation.navigate(option);
    };

    const renderOption = (
        title: string,
        description: string,
        onPress: () => void,
        iconName: string
    ) => {
        return (
            <TouchableOpacity
                style={[styles.optionItem, {
                    backgroundColor: colors.surface,
                    borderBottomColor: colors.separator
                }]}
                onPress={onPress}
            >
                <View style={styles.optionIcon}>
                    <Ionicons
                        name={iconName as any}
                        size={20}
                        color="#007AFF"
                    />
                </View>
                <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                        {title}
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                        {description}
                    </Text>
                </View>
                <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textTertiary}
                />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    About
                </Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* App Info Section */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <View style={styles.appInfo}>
                        <View style={styles.appIconContainer}>
                            <Ionicons name="calendar" size={32} color="#007AFF" />
                        </View>
                        <Text style={[styles.appName, { color: colors.text }]}>
                            Routine
                        </Text>
                        <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
                            Version 1.0.0
                        </Text>
                        <Text style={[styles.appDescription, { color: colors.textSecondary }]}>
                            Build better habits with AI-powered insights and smart routine tracking.
                        </Text>
                    </View>
                </View>

                {/* Legal Section */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderBottomColor: colors.border
                    }]}>
                        Legal & Privacy
                    </Text>

                    {renderOption(
                        'Privacy Policy',
                        'Learn how we protect and handle your data',
                        () => handleOptionPress('Privacy'),
                        'shield-checkmark-outline'
                    )}

                    {renderOption(
                        'Terms of Service',
                        'Review our terms and conditions',
                        () => handleOptionPress('Terms'),
                        'document-text-outline'
                    )}
                </View>

                {/* Contact Section */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderBottomColor: colors.border
                    }]}>
                        Support
                    </Text>

                    <View style={[styles.contactInfo, { borderBottomColor: colors.separator }]}>
                        <View style={styles.contactItem}>
                            <Ionicons name="mail-outline" size={18} color="#007AFF" />
                            <Text style={[styles.contactText, { color: colors.text }]}>
                                routineaiapp@gmail.com
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Copyright */}
                <View style={styles.copyright}>
                    <Text style={[styles.copyrightText, { color: colors.textTertiary }]}>
                        © 2025 Routine. All rights reserved.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    placeholder: {
        width: 34,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    appInfo: {
        padding: 30,
        alignItems: 'center',
    },
    appIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    appName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    appVersion: {
        fontSize: 14,
        marginBottom: 12,
    },
    appDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 280,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    optionIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    contactInfo: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contactText: {
        fontSize: 16,
        marginLeft: 12,
    },
    copyright: {
        paddingHorizontal: 20,
        paddingVertical: 30,
        alignItems: 'center',
    },
    copyrightText: {
        fontSize: 12,
        textAlign: 'center',
    },
});