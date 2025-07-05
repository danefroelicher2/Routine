import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Switch,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { UserSettings } from '../../types/database';
import { useTheme } from '../../../ThemeContext';

interface SettingsScreenProps {
    navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string>('');
    
    // NEW: Use theme context
    const { isDarkMode, colors, setDarkMode } = useTheme();

    useEffect(() => {
        loadSettings();
        loadUserEmail();
    }, []);

    const loadUserEmail = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
            }
        } catch (error) {
            console.error('Error loading user email:', error);
        }
    };

    const loadSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setSettings(data);
            } else {
                // Create default settings if none exist
                const defaultSettings = {
                    user_id: user.id,
                    dark_mode: false,
                    notifications_enabled: true,
                    weekly_reset_day: 1, // Monday
                };

                const { data: newSettings, error: insertError } = await supabase
                    .from('user_settings')
                    .insert(defaultSettings)
                    .select()
                    .single();

                if (insertError) throw insertError;
                setSettings(newSettings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            Alert.alert('Error', 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key: keyof UserSettings, value: any) => {
        if (!settings) return;

        try {
            const { error } = await supabase
                .from('user_settings')
                .update({ [key]: value })
                .eq('id', settings.id);

            if (error) throw error;

            setSettings({ ...settings, [key]: value });
            
            // NEW: Update theme context when dark mode changes
            if (key === 'dark_mode') {
                setDarkMode(value);
            }
        } catch (error) {
            console.error('Error updating setting:', error);
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    // NEW: Handle password reset
    const handleChangePassword = async () => {
        if (!userEmail) {
            Alert.alert('Error', 'Unable to get your email address');
            return;
        }

        Alert.alert(
            'Change Password',
            `We'll send a password reset link to ${userEmail}. You can use this link to set a new password.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Reset Email',
                    onPress: async () => {
                        try {
                            // Use Supabase's default password reset without custom redirect
                            const { error } = await supabase.auth.resetPasswordForEmail(userEmail);

                            if (error) {
                                throw error;
                            }

                            Alert.alert(
                                'Email Sent',
                                `A password reset link has been sent to ${userEmail}. Please check your email and follow the instructions.\n\nThe link will open a secure page where you can set your new password.`,
                                [{ text: 'OK' }]
                            );
                        } catch (error: any) {
                            console.error('Error sending password reset:', error);
                            Alert.alert(
                                'Error', 
                                error?.message || 'Failed to send password reset email. Please try again.'
                            );
                        }
                    }
                }
            ]
        );
    };

    const renderSettingItem = (
        title: string,
        subtitle: string,
        value: any,
        onPress: () => void,
        type: 'switch' | 'button' = 'button'
    ) => (
        <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.separator }]}
            onPress={type === 'button' ? onPress : undefined}
            disabled={type === 'switch'}
        >
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>
            {type === 'switch' ? (
                <Switch
                    value={value}
                    onValueChange={onPress}
                    trackColor={{ false: colors.border, true: '#007AFF' }}
                    thumbColor={value ? '#fff' : '#f4f3f4'}
                />
            ) : (
                <View style={styles.settingValue}>
                    {typeof value === 'string' && value !== '' && (
                        <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>{value}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.scrollView}>
                {/* App Preferences */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { 
                        backgroundColor: colors.background, 
                        color: colors.text,
                        borderBottomColor: colors.border 
                    }]}>App Preferences</Text>

                    {renderSettingItem(
                        'Dark Mode',
                        'Switch between light and dark theme',
                        isDarkMode,
                        () => updateSetting('dark_mode', !isDarkMode),
                        'switch'
                    )}
                </View>

                {/* Notifications */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { 
                        backgroundColor: colors.background, 
                        color: colors.text,
                        borderBottomColor: colors.border 
                    }]}>Notifications</Text>

                    {renderSettingItem(
                        'Enable Notifications',
                        'Receive reminders for your routines',
                        settings?.notifications_enabled || false,
                        () => updateSetting('notifications_enabled', !settings?.notifications_enabled),
                        'switch'
                    )}

                    <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.separator }]}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Notification Schedule</Text>
                            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Set when to receive reminders</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>Coming Soon</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Account & Security */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { 
                        backgroundColor: colors.background, 
                        color: colors.text,
                        borderBottomColor: colors.border 
                    }]}>Account & Security</Text>

                    {renderSettingItem(
                        'Change Password',
                        'Send password reset email to your account',
                        '',
                        handleChangePassword
                    )}

                    <TouchableOpacity
                        style={[styles.settingItem, { borderBottomColor: colors.separator }]}
                        onPress={() => {
                            Alert.alert(
                                'Delete Account',
                                'This will permanently delete your account and all data. This action cannot be undone.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Delete Account',
                                        style: 'destructive',
                                        onPress: () => {
                                            Alert.alert(
                                                'Are you sure?',
                                                'Type "DELETE" to confirm account deletion:',
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'I understand',
                                                        style: 'destructive',
                                                        onPress: () => {
                                                            Alert.alert(
                                                                'Feature Coming Soon',
                                                                'Account deletion will be available in a future update. For now, please contact support.'
                                                            );
                                                        },
                                                    },
                                                ]
                                            );
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, styles.dangerText]}>Delete Account</Text>
                            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Permanently delete your account and data</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Ionicons name="chevron-forward" size={16} color="#ff6b6b" />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    section: {
        marginTop: 20,
        paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 14,
    },
    settingValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingValueText: {
        fontSize: 14,
        marginRight: 8,
    },
    dangerText: {
        color: '#ff6b6b',
    },
});