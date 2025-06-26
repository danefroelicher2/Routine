import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { UserRoutine, RoutineCompletion } from '../../types/database';

interface RoutineWithCompletion extends UserRoutine {
    isCompleted: boolean;
    completionId?: string;
}

export default function HomeScreen() {
    const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weekTimeRemaining, setWeekTimeRemaining] = useState('');

    useFocusEffect(
        useCallback(() => {
            loadRoutines();
            calculateWeekTimeRemaining();
        }, [])
    );

    const calculateWeekTimeRemaining = () => {
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentHour = now.getHours();

        // Calculate days until next Monday (assuming week resets on Monday)
        let daysUntilReset = currentDay === 0 ? 1 : 8 - currentDay; // If Sunday, 1 day. Otherwise, 8 - current day
        if (currentDay === 1 && currentHour === 0) {
            daysUntilReset = 7; // If it's Monday at midnight, 7 days until next reset
        }

        const hoursUntilReset = daysUntilReset === 1 ? (24 - currentHour) :
            daysUntilReset > 1 ? ((daysUntilReset - 1) * 24 + (24 - currentHour)) : 0;

        if (daysUntilReset === 0) {
            setWeekTimeRemaining('Resets today!');
        } else if (daysUntilReset === 1) {
            setWeekTimeRemaining(`${hoursUntilReset}h remaining`);
        } else {
            const days = Math.floor(hoursUntilReset / 24);
            const hours = hoursUntilReset % 24;
            setWeekTimeRemaining(`${days}d ${hours}h remaining`);
        }
    };

    const loadRoutines = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get today's date for completion checking
            const today = new Date().toISOString().split('T')[0];

            // Get current week start (Monday)
            const now = new Date();
            const currentDay = now.getDay();
            const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - daysFromMonday);
            const weekStartStr = weekStart.toISOString().split('T')[0];

            // Fetch user routines
            const { data: routines, error: routinesError } = await supabase
                .from('user_routines')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order');

            if (routinesError) throw routinesError;

            // Fetch today's completions for daily routines
            const { data: dailyCompletions, error: dailyCompletionsError } = await supabase
                .from('routine_completions')
                .select('*')
                .eq('user_id', user.id)
                .eq('completion_date', today);

            if (dailyCompletionsError) throw dailyCompletionsError;

            // Fetch this week's completions for weekly routines
            const { data: weeklyCompletions, error: weeklyCompletionsError } = await supabase
                .from('routine_completions')
                .select('*')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr);

            if (weeklyCompletionsError) throw weeklyCompletionsError;

            // Separate daily and weekly routines and add completion status
            const daily: RoutineWithCompletion[] = [];
            const weekly: RoutineWithCompletion[] = [];

            routines?.forEach(routine => {
                if (routine.is_daily) {
                    const completion = dailyCompletions?.find(c => c.routine_id === routine.id);
                    daily.push({
                        ...routine,
                        isCompleted: !!completion,
                        completionId: completion?.id,
                    });
                } else if (routine.is_weekly) {
                    const completion = weeklyCompletions?.find(c => c.routine_id === routine.id);
                    weekly.push({
                        ...routine,
                        isCompleted: !!completion,
                        completionId: completion?.id,
                    });
                }
            });

            setDailyRoutines(daily);
            setWeeklyRoutines(weekly);
        } catch (error) {
            console.error('Error loading routines:', error);
            Alert.alert('Error', 'Failed to load routines');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const toggleRoutineCompletion = async (routine: RoutineWithCompletion, isWeekly = false) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (routine.isCompleted && routine.completionId) {
                // Remove completion
                const { error } = await supabase
                    .from('routine_completions')
                    .delete()
                    .eq('id', routine.completionId);

                if (error) throw error;
            } else {
                // Add completion
                const today = new Date().toISOString().split('T')[0];
                let weekStartDate = null;

                if (isWeekly) {
                    const now = new Date();
                    const currentDay = now.getDay();
                    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - daysFromMonday);
                    weekStartDate = weekStart.toISOString().split('T')[0];
                }

                const { error } = await supabase
                    .from('routine_completions')
                    .insert({
                        user_id: user.id,
                        routine_id: routine.id,
                        completion_date: today,
                        week_start_date: weekStartDate,
                    });

                if (error) throw error;
            }

            // Reload routines to update UI
            loadRoutines();
        } catch (error) {
            console.error('Error toggling routine completion:', error);
            Alert.alert('Error', 'Failed to update routine');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadRoutines();
        calculateWeekTimeRemaining();
    };

    const renderRoutineItem = (routine: RoutineWithCompletion, isWeekly = false) => (
        <TouchableOpacity
            key={routine.id}
            style={styles.routineItem}
            onPress={() => toggleRoutineCompletion(routine, isWeekly)}
        >
            <View style={styles.routineContent}>
                <View style={styles.routineLeft}>
                    <View style={[styles.checkbox, routine.isCompleted && styles.checkboxCompleted]}>
                        {routine.isCompleted && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                    </View>
                    <View style={styles.routineInfo}>
                        <Text style={[styles.routineName, routine.isCompleted && styles.routineNameCompleted]}>
                            {routine.name}
                        </Text>
                        {routine.description && (
                            <Text style={styles.routineDescription}>{routine.description}</Text>
                        )}
                        {routine.target_value && routine.target_unit && (
                            <Text style={styles.routineTarget}>
                                Target: {routine.target_value} {routine.target_unit}
                            </Text>
                        )}
                    </View>
                </View>
                {routine.icon && (
                    <Ionicons name={routine.icon as any} size={24} color="#666" />
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Today's Routine</Text>
                <Text style={styles.headerDate}>
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Daily Routines Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="sunny" size={24} color="#ff9500" />
                        <Text style={styles.sectionTitle}>Daily Goals</Text>
                    </View>

                    {dailyRoutines.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No daily routines set up yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Go to Profile → Manage Routines to add some!
                            </Text>
                        </View>
                    ) : (
                        dailyRoutines.map(routine => renderRoutineItem(routine))
                    )}
                </View>

                {/* Weekly Routines Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="calendar" size={24} color="#007AFF" />
                        <Text style={styles.sectionTitle}>Weekly Goals</Text>
                        <View style={styles.weekTimer}>
                            <Ionicons name="time" size={16} color="#666" />
                            <Text style={styles.weekTimerText}>{weekTimeRemaining}</Text>
                        </View>
                    </View>

                    {weeklyRoutines.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No weekly routines set up yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Add weekly goals to track longer-term habits!
                            </Text>
                        </View>
                    ) : (
                        weeklyRoutines.map(routine => renderRoutineItem(routine, true))
                    )}
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
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    headerDate: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginLeft: 10,
        flex: 1,
    },
    weekTimer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    weekTimerText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
        fontWeight: '500',
    },
    routineItem: {
        marginBottom: 12,
    },
    routineContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
    },
    routineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ddd',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    checkboxCompleted: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    routineInfo: {
        flex: 1,
    },
    routineName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    routineNameCompleted: {
        textDecorationLine: 'line-through',
        color: '#999',
    },
    routineDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    routineTarget: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 2,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginTop: 8,
    },
});