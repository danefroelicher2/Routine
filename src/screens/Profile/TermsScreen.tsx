// TermsScreen.tsx - NATIVE VERSION (REPLACE YOUR CURRENT ONE)
// Place this in: src/screens/Profile/TermsScreen.tsx

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Linking,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../ThemeContext';

export default function TermsScreen({ navigation }: any) {
    const { colors } = useTheme();

    const openInBrowser = () => {
        const url = 'https://danefroelicher2.github.io/routine-app-legal/terms-of-service.html';
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open terms of service in browser');
        });
    };

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
            {children}
        </View>
    );

    const Paragraph = ({ children }: { children: React.ReactNode }) => (
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>{children}</Text>
    );

    const BulletList = ({ items }: { items: string[] }) => (
        <View style={styles.bulletList}>
            {items.map((item, index) => (
                <View key={index} style={styles.bulletItem}>
                    <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
                </View>
            ))}
        </View>
    );

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
                    Terms of Service
                </Text>
                <TouchableOpacity
                    onPress={openInBrowser}
                    style={styles.browserButton}
                >
                    <Ionicons name="open-outline" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Header */}
                    <Text style={[styles.title, { color: colors.text }]}>Terms of Service</Text>
                    <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                        Effective date: January 1, 2025
                    </Text>

                    {/* Section 1: Introduction */}
                    <Section title="1. Introduction">
                        <Paragraph>
                            Welcome to Routine ("the app"). By downloading or using the app, you agree to be bound by these terms of service.
                        </Paragraph>
                    </Section>

                    {/* Section 2: App Services */}
                    <Section title="2. App Services">
                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>2.1 Features</Text>
                        <BulletList items={[
                            "Habit tracking and routine management",
                            "Progress analytics and completion statistics",
                            "AI-powered insights and recommendations",
                            "Customizable habit reminders and notifications",
                            "Habit streaks and goal setting"
                        ]} />

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>2.2 Pricing and Payments</Text>
                        <BulletList items={[
                            "The app is available through Stripe payment processing with two subscription options:",
                            "    Monthly subscription",
                            "    Annual subscription",
                            "All prices are shown in your local currency within the app",
                            "Prices may vary by region and are subject to change",
                            "Payment will be charged to your selected payment method at confirmation of purchase",
                            "Subscription automatically renews unless cancelled at least 24-hours before the end of the current period",
                            "Account will be charged for renewal within 24-hours prior to the end of the current period",
                            "You can manage and cancel subscriptions in your account settings within the app",
                            "Refunds are handled according to our refund policy and applicable consumer protection laws"
                        ]} />

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>2.3 Habit Tracking Functionality</Text>
                        <BulletList items={[
                            "The app tracks your habit completion and progress locally on your device",
                            "Habit data and analytics remain accessible according to your preferences",
                            "You can configure different reminder schedules and habit goals within the app",
                            "AI insights are generated based on your personal habit patterns"
                        ]} />
                    </Section>

                    {/* Section 3: User Rights and Obligations */}
                    <Section title="3. User Rights and Obligations">
                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>3.1 Age and Consent</Text>
                        <BulletList items={[
                            "The app is available for users of all ages",
                            "Users under 13 must have parent or guardian consent",
                            "You are responsible for maintaining the confidentiality of your account"
                        ]} />

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>3.2 Acceptable Use</Text>
                        <BulletList items={[
                            "You agree to use the app for legitimate habit tracking and self-improvement purposes",
                            "You agree not to use the app for any unlawful purpose",
                            "You are responsible for all activity that occurs under your account",
                            "You agree not to reverse engineer or attempt to extract the source code",
                            "You agree not to use the app in any way that could damage or overburden our infrastructure"
                        ]} />
                    </Section>

                    {/* Section 4: Changes to Service */}
                    <Section title="4. Changes to Service">
                        <Paragraph>We reserve the right to:</Paragraph>
                        <BulletList items={[
                            "Modify or discontinue any part of the service",
                            "Change subscription prices or availability",
                            "Update these terms with reasonable notice",
                            "Add or remove features to improve user experience"
                        ]} />
                    </Section>

                    {/* Section 5: Limitation of Liability */}
                    <Section title="5. Limitation of Liability">
                        <Paragraph>The app is provided "as is" without warranties. We are not responsible for:</Paragraph>
                        <BulletList items={[
                            "Accuracy of habit tracking or progress analytics",
                            "Any consequences of following AI-generated recommendations",
                            "Interruptions in service availability",
                            "Loss of habit data due to device issues or user error",
                            "Any losses or damages resulting from your use of the app"
                        ]} />
                    </Section>

                    {/* Section 6: Termination */}
                    <Section title="6. Termination">
                        <Paragraph>
                            We reserve the right to terminate or suspend access to the app for violations of these terms or for any other reason at our discretion.
                        </Paragraph>
                    </Section>

                    {/* Section 7: Contact */}
                    <Section title="7. Contact">
                        <Paragraph>
                            If you have any questions about these terms, please contact us at:
                        </Paragraph>
                        <Text style={[styles.contactInfo, { color: colors.text }]}>
                            routineaiapp@gmail.com
                        </Text>
                    </Section>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                            © 2025 Routine. All rights reserved.
                        </Text>
                    </View>
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
    browserButton: {
        padding: 5,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginVertical: 20,
    },
    lastUpdated: {
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 30,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    subsectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 12,
    },
    bulletList: {
        marginVertical: 8,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    bullet: {
        fontSize: 16,
        marginRight: 8,
        marginTop: 2,
    },
    bulletText: {
        fontSize: 16,
        lineHeight: 24,
        flex: 1,
    },
    contactInfo: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    footer: {
        paddingVertical: 30,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        marginTop: 30,
    },
    footerText: {
        fontSize: 12,
        textAlign: 'center',
    },
});