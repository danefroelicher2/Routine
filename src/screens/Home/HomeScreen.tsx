import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { UserRoutine } from '../../types/database';

interface RoutineWithCompletion extends UserRoutine {
    isCompleted: boolean;
    completionId?: string;
}

interface HomeScreenProps {
    navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
    const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [weekTimeRemaining, setWeekTimeRemaining] = useState('');
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
    const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
    const [daySpecificRoutines, setDaySpecificRoutines] = useState<Record<number, string[]>>({});

    // Days of the week
    const daysOfWeek = [
        { name: 'Sun', value: 0 },
        { name: 'Mon', value: 1 },
        { name: 'Tue', value: 2 },
        { name: 'Wed', value: 3 },
        { name: 'Thu', value: 4 },
        { name: 'Fri', value: 5 },
        { name: 'Sat', value: 6 },
    ];

    const loadData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date().toISOString().split('T')[0];

            // Calculate week start (Monday)
            const now = new Date();
            const currentDay = now.getDay();
            const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - daysFromMonday);
            const weekStartStr = weekStart.toISOString().split('T')[0];

            // Fetch all user routines
            const { data: routines, error: routinesError } = await supabase
                .from('user_routines')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order');

            if (routinesError) throw routinesError;
            setAvailableRoutines(routines || []);

            // Fetch day-specific routine assignments
            const { data: dayRoutines, error: dayRoutinesError } = await supabase
                .from('user_day_routines')
                .select('*')
                .eq('user_id', user.id);

            if (dayRoutinesError) throw dayRoutinesError;

            // Organize day routines by day of week
            const dayRoutineMap: Record<number, string[]> = {};
            dayRoutines?.forEach(dr => {
                if (!dayRoutineMap[dr.day_of_week]) {
                    dayRoutineMap[dr.day_of_week] = [];
                }
                dayRoutineMap[dr.day_of_week].push(dr.routine_id);
            });
            setDaySpecificRoutines(dayRoutineMap);

            // Get routines for the selected day (or today if no selection)
            const currentSelectedDay = selectedDay;
            const routinesForSelectedDay = dayRoutineMap[currentSelectedDay] || [];
            const dailyRoutinesForDay = routines?.filter(routine =>
                routinesForSelectedDay.includes(routine.id)
            ) || [];

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

            // Process daily routines for selected day
            const daily: RoutineWithCompletion[] = [];
            dailyRoutinesForDay.forEach(routine => {
                const completion = dailyCompletions?.find(c => c.routine_id === routine.id);
                daily.push({
                    ...routine,
                    isCompleted: !!completion,
                    completionId: completion?.id,
                });
            });

            // Process weekly routines (unchanged)
            const weekly: RoutineWithCompletion[] = [];
            routines?.forEach(routine => {
                if (routine.is_weekly) {
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

            // Calculate time remaining in week
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const timeLeft = weekEnd.getTime() - now.getTime();
            const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            if (daysLeft > 0) {
                setWeekTimeRemaining(`${daysLeft}d ${hoursLeft}h left`);
            } else {
                setWeekTimeRemaining(`${hoursLeft}h left`);
            }

        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load routines');
        }
    }, [selectedDay]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    const handleDayPress = (day: number) => {
        setSelectedDay(day);
    };

    const handleAddRoutineForDay = () => {
        // Navigate to AddRoutine screen and pass the selected day
        navigation.navigate('AddRoutine', { selectedDay });
    };

    const toggleRoutineForDay = async (routineId: string, dayOfWeek: number) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const currentRoutines = daySpecificRoutines[dayOfWeek] || [];
            const isAssigned = currentRoutines.includes(routineId);

            if (isAssigned) {
                // Remove routine from day
                const { error } = await supabase
                    .from('user_day_routines')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('routine_id', routineId)
                    .eq('day_of_week', dayOfWeek);

                if (error) throw error;
            } else {
                // Add routine to day
                const { error } = await supabase
                    .from('user_day_routines')
                    .insert({
                        user_id: user.id,
                        routine_id: routineId,
                        day_of_week: dayOfWeek,
                    });

                if (error) throw error;
            }

            await loadData();
        } catch (error) {
            console.error('Error toggling routine for day:', error);
            Alert.alert('Error', 'Failed to update day routine');
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

            // Reload data to reflect changes
            await loadData();
        } catch (error) {
            console.error('Error toggling routine completion:', error);
            Alert.alert('Error', 'Failed to update routine status');
        }
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

            {/* Day Calendar Strip */}
            <View style={styles.calendarContainer}>
                <View style={styles.calendarGrid}>
                    {daysOfWeek.map((day) => {
                        const isToday = day.value === new Date().getDay();
                        const isSelected = day.value === selectedDay;
                        const hasRoutines = (daySpecificRoutines[day.value] || []).length > 0;

                        return (
                            <TouchableOpacity
                                key={day.value}
                                style={[
                                    styles.dayBox,
                                    isToday && styles.dayBoxToday,
                                    isSelected && styles.dayBoxSelected,
                                ]}
                                onPress={() => handleDayPress(day.value)}
                            >
                                <Text style={[
                                    styles.dayBoxName,
                                    isToday && styles.dayBoxNameToday,
                                    isSelected && styles.dayBoxNameSelected,
                                ]}>
                                    {day.name}
                                </Text>
                                <View style={[
                                    styles.dayBoxIndicator,
                                    hasRoutines && styles.dayBoxIndicatorActive,
                                ]} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
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
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => navigation.navigate('AddRoutine')}
                        >
                            <Ionicons name="add" size={24} color="#007AFF" />
                        </TouchableOpacity>
                    </View>

                    {dailyRoutines.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                No routines set for {daysOfWeek.find(d => d.value === selectedDay)?.name}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                Tap on the day above to assign routines!
                            </Text>
                        </View>
                    ) : (
                        dailyRoutines.map((routine) => renderRoutineItem(routine, false))
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
                        weeklyRoutines.map((routine) => renderRoutineItem(routine, true))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

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
    addButton: {
        padding: 4,
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
    // Calendar Strip Styles
    calendarContainer: {
        backgroundColor: '#fff',
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    calendarGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        marginHorizontal: 2,
        borderRadius: 12,
        backgroundColor: '#f8f9fa',
        borderWidth: 2,
        borderColor: 'transparent',
        minHeight: 65,
        justifyContent: 'center',
    },
    dayBoxToday: {
        backgroundColor: '#e6f3ff',
        borderColor: '#007AFF',
    },
    dayBoxSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    dayBoxName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    dayBoxNameToday: {
        color: '#007AFF',
        fontWeight: '700',
    },
    dayBoxNameSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    dayBoxIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ddd',
    },
    dayBoxIndicatorActive: {
        backgroundColor: '#34c759',
    },
});
;

export default HomeScreen;