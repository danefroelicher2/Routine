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
    Modal,
    FlatList,
    Platform,
    InteractionManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { UserSettings } from '../../types/database';
import { useTheme } from '../../../ThemeContext';
import { usePremium } from '../../contexts/PremiumContext';
import { useNavigation } from '@react-navigation/native';

interface SettingsScreenProps {
    navigation: any;
}

interface DaySchedule {
    day_id: number;
    day_name: string;
    start_hour: number;
    end_hour: number;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string>('');

    // ✅ Schedule settings state
    const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showTimePickerModal, setShowTimePickerModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DaySchedule | null>(null);
    const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');

    // Use theme context
    const { isDarkMode, colors, setDarkMode } = useTheme();
    const { isPremium } = usePremium();
    const navigationHook = useNavigation<any>();



    // Default day schedules
    const defaultDaySchedules: DaySchedule[] = [
        { day_id: 0, day_name: 'Sunday', start_hour: 6, end_hour: 23 },
        { day_id: 1, day_name: 'Monday', start_hour: 6, end_hour: 23 },
        { day_id: 2, day_name: 'Tuesday', start_hour: 6, end_hour: 23 },
        { day_id: 3, day_name: 'Wednesday', start_hour: 6, end_hour: 23 },
        { day_id: 4, day_name: 'Thursday', start_hour: 6, end_hour: 23 },
        { day_id: 5, day_name: 'Friday', start_hour: 6, end_hour: 23 },
        { day_id: 6, day_name: 'Saturday', start_hour: 6, end_hour: 23 },
    ];

    // ✅ SIMPLE TIME OPTIONS - 24 hour format
    const timeOptions = Array.from({ length: 24 }, (_, i) => {
        const period = i >= 12 ? 'PM' : 'AM';
        const displayHour = i === 0 ? 12 : i > 12 ? i - 12 : i;
        return {
            value: i,
            label: `${displayHour}:00 ${period}`,
        };
    });

    useEffect(() => {
        loadSettings();
        loadUserEmail();
        loadDaySchedules();
    }, []);

    // ✅ DEBUG: Modal visibility tracker
    useEffect(() => {
        if (showTimePickerModal) {
            console.log('🚨🚨🚨 TIME PICKER MODAL STATE IS TRUE! 🚨🚨🚨');
            console.log('Selected Day:', selectedDay);
            console.log('Picker Type:', timePickerType);

            // Check if modal is actually in the DOM
            setTimeout(() => {
                console.log('🔍 Checking if modal is rendered after 500ms...');
            }, 500);
        }
    }, [showTimePickerModal, selectedDay, timePickerType]);

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

    const loadDaySchedules = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setDaySchedules(defaultDaySchedules);
                return;
            }

            const { data, error } = await supabase
                .from('user_day_schedules')
                .select('*')
                .eq('user_id', user.id)
                .order('day_id');

            if (error) {
                console.log('Day schedules table not found, using defaults:', error.message);
                setDaySchedules(defaultDaySchedules);
                return;
            }

            if (data && data.length > 0) {
                const schedules = data.map(item => ({
                    day_id: item.day_id,
                    day_name: defaultDaySchedules[item.day_id].day_name,
                    start_hour: item.start_hour,
                    end_hour: item.end_hour,
                }));
                setDaySchedules(schedules);
            } else {
                try {
                    await createDefaultDaySchedules(user.id);
                    setDaySchedules(defaultDaySchedules);
                } catch (createError) {
                    console.log('Could not create default schedules, using local defaults');
                    setDaySchedules(defaultDaySchedules);
                }
            }
        } catch (error) {
            console.log('Error loading day schedules, using defaults:', error);
            setDaySchedules(defaultDaySchedules);
        }
    };

    const createDefaultDaySchedules = async (userId: string) => {
        try {
            const scheduleInserts = defaultDaySchedules.map(schedule => ({
                user_id: userId,
                day_id: schedule.day_id,
                start_hour: schedule.start_hour,
                end_hour: schedule.end_hour,
            }));

            const { error } = await supabase
                .from('user_day_schedules')
                .insert(scheduleInserts);

            if (error) {
                console.log('Could not create default schedules:', error.message);
                return;
            }
            console.log('✅ Default day schedules created');
        } catch (error) {
            console.log('❌ Error creating default day schedules:', error);
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
                const defaultSettings = {
                    user_id: user.id,
                    dark_mode: false,
                    notifications_enabled: true,
                    weekly_reset_day: 1,
                    default_calendar_view: false,
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

            if (key === 'dark_mode') {
                setDarkMode(value);
            }
        } catch (error) {
            console.error('Error updating setting:', error);
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    const updateDaySchedule = async (dayId: number, startHour: number, endHour: number) => {
        console.log('⚡ Updating day schedule:', { dayId, startHour, endHour });

        if (startHour >= endHour) {
            Alert.alert('Invalid Time Range', 'Start time must be before end time.');
            return;
        }

        setDaySchedules(prev => prev.map(schedule =>
            schedule.day_id === dayId
                ? { ...schedule, start_hour: startHour, end_hour: endHour }
                : schedule
        ));

        console.log('✅ Local state updated successfully');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('user_day_schedules')
                .update({
                    start_hour: startHour,
                    end_hour: endHour
                })
                .eq('user_id', user.id)
                .eq('day_id', dayId);

            if (error) {
                console.log('Could not update database (table may not exist):', error.message);
            } else {
                console.log(`✅ Updated ${defaultDaySchedules[dayId].day_name} schedule: ${startHour}:00 - ${endHour}:00`);
            }
        } catch (error) {
            console.log('Database update failed, but local state updated:', error);
        }
    };

    // ✅ COMPLETELY NEW: Simple time selection handler
    const handleTimeSelection = (hour: number) => {
        console.log('🎯 TIME SELECTED:', hour);

        if (!selectedDay) {
            console.error('❌ No selected day!');
            return;
        }

        let newStartHour = selectedDay.start_hour;
        let newEndHour = selectedDay.end_hour;

        if (timePickerType === 'start') {
            newStartHour = hour;
            if (hour >= selectedDay.end_hour) {
                newEndHour = Math.min(hour + 1, 23);
            }
        } else {
            newEndHour = hour;
            if (hour <= selectedDay.start_hour) {
                newStartHour = Math.max(hour - 1, 0);
            }
        }

        updateDaySchedule(selectedDay.day_id, newStartHour, newEndHour);

        // Close modal
        setShowTimePickerModal(false);
        setSelectedDay(null);

        console.log('✅ Time selection completed successfully');
    };

    // ✅ NEW: Open time picker with Alert showing all hours
    const openTimePicker = (day: DaySchedule, type: 'start' | 'end') => {
        // Store day in a local variable to avoid closure issues
        const currentDay = day;
        const currentType = type;

        setSelectedDay(day);
        setTimePickerType(type);

        // Create options for all 24 hours
        const timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const label = `${displayHour}:00 ${period}`;

            timeOptions.push({
                text: label,
                onPress: () => {
                    console.log(`Selected ${label} for ${currentDay.day_name} ${currentType}`);
                    // Use the captured day directly
                    let newStartHour = currentDay.start_hour;
                    let newEndHour = currentDay.end_hour;

                    if (currentType === 'start') {
                        newStartHour = hour;
                        if (hour >= currentDay.end_hour) {
                            newEndHour = Math.min(hour + 1, 23);
                        }
                    } else {
                        newEndHour = hour;
                        if (hour <= currentDay.start_hour) {
                            newStartHour = Math.max(hour - 1, 0);
                        }
                    }

                    updateDaySchedule(currentDay.day_id, newStartHour, newEndHour);
                }
            });
        }

        // Add cancel button
        timeOptions.push({ text: 'Cancel', style: 'cancel' });

        // Show alert with all options
        Alert.alert(
            `Select ${type} time for ${day.day_name}`,
            'Scroll to see all times:',
            timeOptions,
            { cancelable: true }
        );
    };

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

    const handleChangePassword = () => {
        navigation.navigate('ChangePassword');
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

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.auth.signOut();
                            if (error) throw error;

                            // The auth state listener in App.tsx will handle navigation
                            console.log('User logged out successfully');
                        } catch (error) {
                            console.error('Error logging out:', error);
                            Alert.alert('Error', 'Failed to log out. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const renderDayScheduleItem = (day: DaySchedule) => (
        <View key={day.day_id} style={[styles.dayScheduleItem, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.dayName, { color: colors.text }]}>{day.day_name}</Text>
            <View style={styles.timeSelectors}>
                <TouchableOpacity
                    style={[styles.timeSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                        console.log('📅 START TIME PRESSED for', day.day_name);
                        openTimePicker(day, 'start');
                    }}
                >
                    <Text style={[styles.timeSelectorLabel, { color: colors.textSecondary }]}>Start</Text>
                    <Text style={[styles.timeSelectorValue, { color: colors.text }]}>{formatHour(day.start_hour)}</Text>
                </TouchableOpacity>

                <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>to</Text>

                <TouchableOpacity
                    style={[styles.timeSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                        console.log('📅 END TIME PRESSED for', day.day_name);
                        openTimePicker(day, 'end');
                    }}
                >
                    <Text style={[styles.timeSelectorLabel, { color: colors.textSecondary }]}>End</Text>
                    <Text style={[styles.timeSelectorValue, { color: colors.text }]}>{formatHour(day.end_hour)}</Text>
                </TouchableOpacity>
            </View>
        </View>
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
        <>
            {/* ✅ DEBUG: Test modal at ROOT LEVEL - OUTSIDE SafeAreaView */}
            {showTimePickerModal && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    zIndex: 999999,
                    elevation: 999999,
                }}>
                    <SafeAreaView style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: 'white',
                            fontSize: 30,
                            fontWeight: 'bold',
                            textAlign: 'center'
                        }}>
                            TIME PICKER IS VISIBLE!
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                console.log('🔴 DEBUG CLOSE PRESSED');
                                setShowTimePickerModal(false);
                            }}
                            style={{
                                backgroundColor: 'white',
                                padding: 20,
                                marginTop: 20,
                                borderRadius: 10
                            }}
                        >
                            <Text style={{ color: 'black', fontSize: 20 }}>CLOSE</Text>
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>
            )}

            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView style={styles.scrollView}>
           // In your SettingsScreen.tsx, find the "App Preferences" section and replace it with this:

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

                        {/* ✅ PREMIUM PROTECTED Auto Populate Calendar View */}
                        <TouchableOpacity
                            style={[
                                styles.settingItem,
                                {
                                    borderBottomColor: colors.separator,
                                    opacity: isPremium ? 1 : 0.6
                                }
                            ]}
                            onPress={() => {
                                if (!isPremium) {
                                    console.log("🚫 Non-premium user trying to access calendar auto-populate - redirecting to premium");
                                    navigation.navigate('Premium', { source: 'calendar_auto_populate' });
                                } else {
                                    // Toggle the setting for premium users
                                    updateSetting('default_calendar_view', !settings?.default_calendar_view);
                                }
                            }}
                        >
                            <View style={styles.settingContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.settingTitle, { color: isPremium ? colors.text : colors.textSecondary }]}>
                                        Auto Populate Calendar View
                                    </Text>
                                    {!isPremium && (
                                        <View style={[styles.premiumBadge, { backgroundColor: '#007AFF', marginLeft: 8 }]}>
                                            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                                    {isPremium
                                        ? "Start app in calendar view instead of daily routines"
                                        : "Unlock to customize your default home screen view"
                                    }
                                </Text>
                            </View>
                            <View style={styles.settingValue}>
                                {isPremium ? (
                                    <Switch
                                        value={settings?.default_calendar_view || false}
                                        onValueChange={(value) => updateSetting('default_calendar_view', value)}
                                        trackColor={{ false: colors.border, true: '#007AFF' }}
                                        thumbColor={settings?.default_calendar_view ? "#007AFF" : "#FFFFFF"}
                                    />
                                ) : (
                                    <Ionicons
                                        name="lock-closed"
                                        size={16}
                                        color="#007AFF"
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
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

                    {/* Schedule Settings Section - PREMIUM PROTECTED */}
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { backgroundColor: colors.background, color: colors.text, borderBottomColor: colors.border }]}>
                            Schedule Settings
                        </Text>

                        {/* ✅ PREMIUM PROTECTED Daily Time Ranges */}
                        <TouchableOpacity
                            style={[
                                styles.settingItem,
                                {
                                    borderBottomColor: colors.separator,
                                    opacity: isPremium ? 1 : 0.6
                                }
                            ]}
                            onPress={() => {
                                if (!isPremium) {
                                    console.log("🚫 Non-premium user trying to access schedule settings - redirecting to premium");
                                    navigationHook.navigate('Premium', { source: 'schedule_settings' });
                                } else {
                                    console.log('📅 DAILY TIME RANGES PRESSED - Opening schedule modal');
                                    setShowScheduleModal(true);
                                }
                            }}
                        >
                            <View style={styles.settingContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.settingTitle, { color: isPremium ? colors.text : colors.textSecondary }]}>
                                        Daily Time Ranges
                                    </Text>
                                    {!isPremium && (
                                        <View style={[styles.premiumBadge, { backgroundColor: '#007AFF', marginLeft: 8 }]}>
                                            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                                    {isPremium
                                        ? "Set your active hours for each day of the week"
                                        : "Unlock to customize your daily schedule"
                                    }
                                </Text>
                            </View>
                            <View style={styles.settingValue}>
                                <Ionicons
                                    name={isPremium ? "chevron-forward" : "lock-closed"}
                                    size={16}
                                    color={isPremium ? colors.textTertiary : "#007AFF"}
                                />
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

                        {renderSettingItem(
                            'Log Out',
                            'Sign out of your account',
                            '',
                            handleLogout
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

                    {/* Schedule Settings Modal - Only show if premium */}
                    <Modal
                        visible={showScheduleModal && isPremium}
                        animationType="slide"
                        presentationStyle="pageSheet"
                        onRequestClose={() => setShowScheduleModal(false)}
                    >
                        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                                <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                                    <Text style={[styles.modalCloseButton, { color: colors.textSecondary }]}>Done</Text>
                                </TouchableOpacity>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Time Ranges</Text>
                                <View style={{ width: 50 }} />
                            </View>

                            <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
                                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                                    Set your active hours for each day. This determines the time range shown in your calendar view.
                                </Text>

                                <View style={[styles.daySchedulesList, { backgroundColor: colors.surface }]}>
                                    {daySchedules.map(renderDayScheduleItem)}
                                </View>
                            </ScrollView>
                        </SafeAreaView>
                    </Modal>
                </ScrollView>
            </SafeAreaView>
        </>
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
    premiumBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    modalCloseButton: {
        fontSize: 16,
        fontWeight: '500',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    modalDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    daySchedulesList: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    dayScheduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    dayName: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    timeSelectors: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeSelector: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 70,
        alignItems: 'center',
    },
    timeSelectorLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 2,
    },
    timeSelectorValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    timeSeparator: {
        fontSize: 14,
        fontWeight: '500',
        marginHorizontal: 4,
    },
    // ✅ BRAND NEW: Super simple time picker styles
    timePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    timePickerModal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        minHeight: 400,
    },
    timePickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    timePickerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    timePickerCancel: {
        fontSize: 16,
    },
    timePickerDone: {
        fontSize: 16,
        fontWeight: '600',
    },
    timePickerScrollView: {
        flex: 1,
    },
    timePickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        minHeight: 56,
    },
    timePickerItemText: {
        fontSize: 18,
        flex: 1,
    },
});