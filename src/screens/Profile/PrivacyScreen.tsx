// PrivacyScreen.tsx - NATIVE VERSION (REPLACE YOUR CURRENT ONE)
// Place this in: src/screens/Profile/PrivacyScreen.tsx

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

export default function PrivacyScreen({ navigation }: any) {
    const { colors } = useTheme();

    const openInBrowser = () => {
        const url = 'https://danefroelicher2.github.io/routine-app-legal/privacy-policy.html';
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open privacy policy in browser');
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
                    Privacy Policy
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
                    <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
                    <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                        Last updated: January 1, 2025
                    </Text>

                    {/* Section 1: Information We Collect */}
                    <Section title="1. Information We Collect">
                        <Paragraph>
                            We are committed to protecting your privacy. This privacy policy explains how we collect, use, and safeguard your information when you use our Routine habit tracking application.
                        </Paragraph>

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>1.1 Information You Provide</Text>
                        <BulletList items={[
                            "Account information (name, email address)",
                            "Profile preferences and settings",
                            "Habit and routine data you create within the app",
                            "Feedback and support communications"
                        ]} />

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>1.2 Automatically Collected Information</Text>
                        <BulletList items={[
                            "Device information (type, operating system, app version)",
                            "App usage analytics and performance data",
                            "Crash reports and diagnostic information",
                            "App interaction patterns (which features you use)"
                        ]} />

                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>1.3 Required Permissions</Text>
                        <BulletList items={[
                            "Notifications: to send you habit reminders and motivational alerts",
                            "App usage tracking: to monitor and analyze your routine patterns for personalized insights"
                        ]} />
                    </Section>

                    {/* Section 2: How We Use Your Information */}
                    <Section title="2. How We Use Your Information">
                        <Paragraph>We use the information we collect to:</Paragraph>
                        <BulletList items={[
                            "Provide and maintain our habit tracking services",
                            "Personalize your experience with AI-powered insights and recommendations",
                            "Analyze usage patterns to provide habit insights and progress tracking",
                            "Send important app updates and habit reminders (with your consent)",
                            "Improve app performance and develop new features",
                            "Ensure the security and integrity of our services",
                            "Respond to your support requests and communications"
                        ]} />
                    </Section>

                    {/* Section 3: Data Storage and Security */}
                    <Section title="3. Data Storage and Security">
                        <Paragraph>Your routine information is:</Paragraph>
                        <BulletList items={[
                            "Stored securely on our servers with industry-standard encryption",
                            "Synchronized across your devices when logged in",
                            "Protected with appropriate technical and organizational security measures",
                            "Regularly monitored for unauthorized access or security breaches"
                        ]} />
                    </Section>

                    {/* Section 4: Data Sharing and Disclosure */}
                    <Section title="4. Data Sharing and Disclosure">
                        <Paragraph>
                            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
                        </Paragraph>
                        <BulletList items={[
                            "With your explicit consent",
                            "With trusted service providers who assist in app operations (under strict confidentiality agreements)",
                            "When required by law or to protect our legal rights",
                            "In connection with a business transfer or acquisition (with prior notice)",
                            "Aggregated, anonymized data for research and improvement purposes"
                        ]} />
                    </Section>

                    {/* Section 5: Data Not Linked to Your Identity */}
                    <Section title="5. Data Not Linked to Your Identity">
                        <Paragraph>The following data may be collected but is not linked to your identity:</Paragraph>
                        <BulletList items={[
                            "Anonymous usage statistics and app performance metrics",
                            "Aggregated habit completion rates and trends",
                            "Crash reports and diagnostic data",
                            "General demographic information for app improvement"
                        ]} />
                    </Section>

                    {/* Section 6: Your Privacy Rights */}
                    <Section title="6. Your Privacy Rights">
                        <Paragraph>You have the right to:</Paragraph>
                        <BulletList items={[
                            "Access and review your personal information",
                            "Update or correct your account information",
                            "Delete your account and associated data",
                            "Export your habit data in a portable format",
                            "Opt out of marketing communications",
                            "Withdraw consent for data processing (where applicable)",
                            "Request information about data sharing practices"
                        ]} />
                    </Section>

                    {/* Section 7: Children's Privacy */}
                    <Section title="7. Children's Privacy">
                        <Paragraph>
                            Our app is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover that we have collected personal information from a child under 13, we will delete such information immediately.
                        </Paragraph>
                    </Section>

                    {/* Section 8: International Data Transfers */}
                    <Section title="8. International Data Transfers">
                        <Paragraph>
                            Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this privacy policy and applicable data protection laws.
                        </Paragraph>
                    </Section>

                    {/* Section 9: Data Retention */}
                    <Section title="9. Data Retention">
                        <Paragraph>
                            We retain your personal information only as long as necessary to provide our services and fulfill the purposes outlined in this policy. When you delete your account, we will delete your personal data within 30 days, except where retention is required by law.
                        </Paragraph>
                    </Section>

                    {/* Section 10: Changes to This Policy */}
                    <Section title="10. Changes to This Policy">
                        <Paragraph>
                            We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "last updated" date. Your continued use of the app after changes become effective constitutes acceptance of the updated policy.
                        </Paragraph>
                    </Section>

                    {/* Section 11: Contact Us */}
                    <Section title="11. Contact Us">
                        <Paragraph>
                            If you have any questions about this privacy policy or our data practices, please contact us at:
                        </Paragraph>
                        <Text style={[styles.contactInfo, { color: colors.text }]}>
                            Email: routineaiapp@gmail.com
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