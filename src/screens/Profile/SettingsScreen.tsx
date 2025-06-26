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

interface SettingsScreenProps {
    navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

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
        } catch (error) {
            console.error('Error updating setting:', error);
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    const getWeeklyResetDayName = (day: number) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[day] || 'Monday';
    };

    const showWeeklyResetDayPicker = () => {
        const days = [
            { name: 'Sunday', value: 0 },
            { name: 'Monday', value: 1 },
            { name: 'Tuesday', value: 2 },
            { name: 'Wednesday', value: 3 },
            { name: 'Thursday', value: 4 },
            { name: 'Friday', value: 5 },
            { name: 'Saturday', value: 6 },
        ];

        Alert.alert(
            'Weekly Reset Day',
            'Choose which day your weekly routines should reset:',
            [
                ...days.map(day => ({
                    text: day.name,
                    onPress: () => updateSetting('weekly_reset_day', day.value),
                })),
                { text: 'Cancel', style: 'cancel' },
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
            style={styles.settingItem}
            onPress={type === 'button' ? onPress : undefined}
            disabled={type === 'switch'}
        >
            <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{title}</Text>
                <Text style={styles.settingSubtitle}>{subtitle}</Text>
            </View>
            {type === 'switch' ? (
                <Switch
                    value={value}
                    onValueChange={onPress}
                    trackColor={{ false: '#f0f0f0', true: '#007AFF' }}
                    thumbColor="#fff"
                />
            ) : (
                <View style={styles.settingValue}>
                    <Text style={styles.settingValueText}>{value}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView}>
                {/* App Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Preferences</Text>

                    {renderSettingItem(
                        'Dark Mode',
                        'Switch between light and dark theme',
                        settings?.dark_mode || false,
                        () => updateSetting('dark_mode', !settings?.dark_mode),
                        'switch'
                    )}

                    {renderSettingItem(
                        'Weekly Reset Day',
                        'Day when weekly routines reset',
                        getWeeklyResetDayName(settings?.weekly_reset_day || 1),
                        showWeeklyResetDayPicker
                    )}
                </View>

                {/* Notifications */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>

                    {renderSettingItem(
                        'Enable Notifications',
                        'Receive reminders for your routines',
                        settings?.notifications_enabled || false,
                        () => updateSetting('notifications_enabled', !settings?.notifications_enabled),
                        'switch'
                    )}

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Notification Schedule</Text>
                            <Text style={styles.settingSubtitle}>Set when to receive reminders</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Text style={styles.settingValueText}>Coming Soon</Text>
                            <Ionicons name="chevron-forward" size={16} color="#ccc" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Account */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Export Data</Text>
                            <Text style={styles.settingSubtitle}>Download your routine data</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Ionicons name="chevron-forward" size={16} color="#ccc" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingItem}
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
                            <Text style={styles.settingSubtitle}>Permanently delete your account and data</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Ionicons name="chevron-forward" size={16} color="#ff6b6b" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Info</Text>

                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Version</Text>
                        <Text style={styles.infoValue}>1.0.0</Text>
                    </View>

                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Build</Text>
                        <Text style={styles.infoValue}>2025.1.0</Text>
                    </View>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Privacy Policy</Text>
                            <Text style={styles.settingSubtitle}>View our privacy policy</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Ionicons name="chevron-forward" size={16} color="#ccc" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Terms of Service</Text>
                            <Text style={styles.settingSubtitle}>View our terms of service</Text>
                        </View>
                        <View style={styles.settingValue}>
                            <Ionicons name="chevron-forward" size={16} color="#ccc" />
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
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
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
        color: '#666',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 20,
        paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    settingValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingValueText: {
        fontSize: 14,
        color: '#666',
        marginRight: 8,
    },
    dangerText: {
        color: '#ff6b6b',
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 16,
        color: '#333',
    },
    infoValue: {
        fontSize: 16,
        color: '#666',
    },
});