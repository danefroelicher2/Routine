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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { UserSettings } from '../../types/database';
import { useTheme } from '../../../ThemeContext';

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

    // Generate hour options
    const generateHourOptions = () => {
        const hours = [];
        for (let i = 0; i < 24; i++) {
            const period = i >= 12 ? 'PM' : 'AM';
            const displayHour = i === 0 ? 12 : i > 12 ? i - 12 : i;
            hours.push({
                value: i,
                label: `${displayHour}:00 ${period}`,
            });
        }
        return hours;
    };

    const hourOptions = generateHourOptions();

    useEffect(() => {
        loadSettings();
        loadUserEmail();
        loadDaySchedules();
    }, []);

    // ✅ DEBUG STATE CHANGES
    useEffect(() => {
        console.log('📊 TIME PICKER STATE CHANGED:');
        console.log('  - showTimePickerModal:', showTimePickerModal);
        console.log('  - selectedDay:', selectedDay?.day_name || 'null');
        console.log('  - timePickerType:', timePickerType);
        console.log('  - Both conditions true?:', showTimePickerModal && selectedDay ? 'YES' : 'NO');
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

        setShowTimePickerModal(false);
        setSelectedDay(null);

        console.log('✅ Time selection completed successfully');
    };

    const openTimePicker = (day: DaySchedule, type: 'start' | 'end') => {
        console.log('🚀 OPENING TIME PICKER for', day.day_name, type);
        console.log('🔍 Current states before update:');
        console.log('  - showTimePickerModal:', showTimePickerModal);
        console.log('  - selectedDay:', selectedDay);
        console.log('  - timePickerType:', timePickerType);

        setSelectedDay(day);
        setTimePickerType(type);
        setShowTimePickerModal(true);

        setTimeout(() => {
            console.log('🔍 States after update:');
            console.log('  - showTimePickerModal should be true');
            console.log('  - selectedDay should be:', day.day_name);
            console.log('  - timePickerType should be:', type);
            console.log('✅ Time picker should now be visible');
        }, 100);
    };

    const formatHour = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

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

                    {/* Schedule Settings Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, {
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderBottomColor: colors.border
                        }]}>Schedule Settings</Text>

                        {renderSettingItem(
                            'Daily Time Ranges',
                            'Set your active hours for each day of the week',
                            '',
                            () => {
                                console.log('📋 DAILY TIME RANGES PRESSED - Opening schedule modal');
                                setShowScheduleModal(true);
                            }
                        )}
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

                {/* 🚨 DEBUG: Visual State Indicator */}
                {showTimePickerModal && (
                    <View style={{
                        position: 'absolute',
                        top: 100,
                        left: 20,
                        right: 20,
                        backgroundColor: 'red',
                        padding: 20,
                        zIndex: 9999,
                        borderRadius: 10
                    }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                            🚨 DEBUG: TIME PICKER STATE IS TRUE
                        </Text>
                        <Text style={{ color: 'white' }}>
                            Selected Day: {selectedDay?.day_name || 'null'}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            Type: {timePickerType}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            Both conditions: {showTimePickerModal && selectedDay ? 'TRUE' : 'FALSE'}
                        </Text>
                    </View>
                )}

                {/* Schedule Settings Modal */}
                <Modal
                    visible={showScheduleModal}
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
            </SafeAreaView>

            {/* 🚨 SIMPLIFIED TEST MODAL - NO CONDITIONAL RENDERING */}
            <Modal
                visible={showTimePickerModal && selectedDay ? true : false}
                transparent={true}
                animationType="none"
                presentationStyle="overFullScreen"
                onRequestClose={() => {
                    console.log("🚨 Modal onRequestClose called");
                    setShowTimePickerModal(false);
                    setSelectedDay(null);
                }}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,0,0,0.8)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: 'yellow',
                        padding: 30,
                        borderRadius: 10,
                        width: '90%',
                        maxHeight: '70%'
                    }}>
                        <Text style={{
                            color: 'black',
                            fontSize: 24,
                            textAlign: 'center',
                            marginBottom: 20,
                            fontWeight: 'bold'
                        }}>
                            🚨 MODAL IS RENDERING!
                        </Text>

                        <Text style={{
                            color: 'black',
                            fontSize: 18,
                            textAlign: 'center',
                            marginBottom: 20
                        }}>
                            Day: {selectedDay?.day_name || 'Unknown'}
                        </Text>

                        <Text style={{
                            color: 'black',
                            fontSize: 18,
                            textAlign: 'center',
                            marginBottom: 20
                        }}>
                            Type: {timePickerType}
                        </Text>

                        <TouchableOpacity
                            style={{
                                backgroundColor: 'red',
                                padding: 20,
                                borderRadius: 10,
                                marginBottom: 10
                            }}
                            onPress={() => {
                                console.log("🚨 CLOSE BUTTON PRESSED");
                                setShowTimePickerModal(false);
                                setSelectedDay(null);
                            }}
                        >
                            <Text style={{
                                color: 'white',
                                textAlign: 'center',
                                fontSize: 18,
                                fontWeight: 'bold'
                            }}>
                                CLOSE MODAL
                            </Text>
                        </TouchableOpacity>

                        <Text style={{
                            color: 'black',
                            fontSize: 14,
                            textAlign: 'center'
                        }}>
                            If you see this, modals work but something is wrong with our time picker logic
                        </Text>
                    </View>
                </View>
            </Modal>
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
});