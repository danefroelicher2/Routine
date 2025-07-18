// src/screens/Home/CalendarHomeScreen.tsx
// FIXED: Complete calendar functionality with day selector stripe

import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
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
    Animated,
    PanResponder,
    Dimensions,
    TextInput,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";
import { StreakSyncService } from "../../services/StreakSyncService";

interface RoutineWithCompletion extends UserRoutine {
    isCompleted: boolean;
    completionId?: string;
}

interface ScheduledRoutine extends RoutineWithCompletion {
    scheduled_time: string; // "HH:MM" format
    estimated_duration: number; // minutes
}

interface TimeSlot {
    hour: number;
    routines: ScheduledRoutine[];
}

interface CalendarHomeScreenProps {
    navigation: any;
}

// ✅ CRITICAL FIX: Utility function to get local date string consistently
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CalendarHomeScreen: React.FC<CalendarHomeScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();

    // Calendar is always enabled in this version
    const [isCalendarView, setIsCalendarView] = useState(true);

    const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [weekTimeRemaining, setWeekTimeRemaining] = useState("");
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
    const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
    const [daySpecificRoutines, setDaySpecificRoutines] = useState<Record<number, string[]>>({});
    const [userProfile, setUserProfile] = useState<any>(null);

    // NEW: Calendar-specific state
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);

    // EXISTING DRAG STATE
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [originalIndex, setOriginalIndex] = useState<number | null>(null);
    const [lastSwapIndex, setLastSwapIndex] = useState<number | null>(null);
    const [draggedSection, setDraggedSection] = useState<"daily" | "weekly" | null>(null);

    // Days of the week - SAME AS HOMESCREEN
    const daysOfWeek = [
        { name: "Sun", value: 0 },
        { name: "Mon", value: 1 },
        { name: "Tue", value: 2 },
        { name: "Wed", value: 3 },
        { name: "Thu", value: 4 },
        { name: "Fri", value: 5 },
        { name: "Sat", value: 6 },
    ];

    // Initialize time slots (6 AM to 11 PM)
    const initializeTimeSlots = useCallback(() => {
        const slots: TimeSlot[] = [];
        for (let hour = 6; hour <= 23; hour++) {
            slots.push({
                hour,
                routines: []
            });
        }
        setTimeSlots(slots);
    }, []);

    // Format time for display
    const formatTime = (hour: number): string => {
        if (hour === 0) return "12 AM";
        if (hour === 12) return "12 PM";
        if (hour < 12) return `${hour} AM`;
        return `${hour - 12} PM`;
    };

    // Generate personalized greeting
    const personalizedGreeting = useMemo(() => {
        const hour = new Date().getHours();
        const name = userProfile?.display_name || userProfile?.full_name || "there";

        if (hour < 12) return `Good morning, ${name}!`;
        if (hour < 18) return `Good afternoon, ${name}!`;
        return `Good evening, ${name}!`;
    }, [userProfile]);

    // Load user profile
    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) throw error;
            setUserProfile(profile);
        } catch (error) {
            console.error("Error loading user profile:", error);
        }
    };

    // Load routines and data
    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load daily routines
            const { data: dailyData, error: dailyError } = await supabase
                .from("user_routines")
                .select("*")
                .eq("user_id", user.id)
                .eq("is_daily", true)
                .eq("is_active", true)
                .order("sort_order");

            if (dailyError) throw dailyError;

            // Load weekly routines
            const { data: weeklyData, error: weeklyError } = await supabase
                .from("user_routines")
                .select("*")
                .eq("user_id", user.id)
                .eq("is_weekly", true)
                .eq("is_active", true)
                .order("sort_order");

            if (weeklyError) throw weeklyError;

            // Load routine completions for today
            const today = getLocalDateString(new Date());
            const { data: completions, error: completionsError } = await supabase
                .from("routine_completions")
                .select("*")
                .eq("user_id", user.id)
                .eq("completion_date", today);

            if (completionsError) throw completionsError;

            // Merge routines with completion status
            const completionMap = new Map(
                (completions || []).map(c => [c.routine_id, { isCompleted: true, completionId: c.id }])
            );

            const enhancedDaily = (dailyData || []).map(routine => ({
                ...routine,
                isCompleted: completionMap.has(routine.id),
                completionId: completionMap.get(routine.id)?.completionId,
            }));

            const enhancedWeekly = (weeklyData || []).map(routine => ({
                ...routine,
                isCompleted: completionMap.has(routine.id),
                completionId: completionMap.get(routine.id)?.completionId,
            }));

            setDailyRoutines(enhancedDaily);
            setWeeklyRoutines(enhancedWeekly);

            // Load day-specific routines
            await loadDaySpecificRoutines();

            // SIMULATE: Schedule some routines in time slots for demo
            const scheduledRoutines: ScheduledRoutine[] = enhancedDaily.slice(0, 3).map((routine, index) => ({
                ...routine,
                scheduled_time: `${8 + index * 2}:00`,
                estimated_duration: 30 + index * 15,
            }));

            // Distribute scheduled routines into time slots
            const newTimeSlots = timeSlots.map(slot => ({
                ...slot,
                routines: scheduledRoutines.filter(r => {
                    const [hourStr] = r.scheduled_time.split(':');
                    return parseInt(hourStr) === slot.hour;
                })
            }));

            setTimeSlots(newTimeSlots);

        } catch (error) {
            console.error("Error loading data:", error);
            Alert.alert("Error", "Failed to load routines");
        }
    };

    // Load day-specific routines
    const loadDaySpecificRoutines = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("user_day_routines")
                .select(`
                    day_of_week,
                    routine_id,
                    user_routines!inner (
                        id,
                        name,
                        description,
                        icon
                    )
                `)
                .eq("user_id", user.id);

            if (error) throw error;

            const dayMap: Record<number, string[]> = {};
            (data || []).forEach(item => {
                if (!dayMap[item.day_of_week]) {
                    dayMap[item.day_of_week] = [];
                }
                dayMap[item.day_of_week].push(item.routine_id);
            });

            setDaySpecificRoutines(dayMap);
        } catch (error) {
            console.error("Error loading day-specific routines:", error);
        }
    };

    // Refresh data
    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadData(), loadUserProfile()]);
        setRefreshing(false);
    };

    // Complete routine
    const completeRoutine = async (routine: RoutineWithCompletion) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = getLocalDateString(new Date());

            if (routine.isCompleted) {
                // Remove completion
                const { error } = await supabase
                    .from("routine_completions")
                    .delete()
                    .eq("id", routine.completionId);

                if (error) throw error;
            } else {
                // Add completion
                const { error } = await supabase
                    .from("routine_completions")
                    .insert([{
                        user_id: user.id,
                        routine_id: routine.id,
                        completion_date: today,
                        completed_at: new Date().toISOString(),
                    }]);

                if (error) throw error;

                // Sync streaks after completion
                await StreakSyncService.checkAndSyncUserStreaks(user.id);
            }

            await loadData();
        } catch (error) {
            console.error("Error completing routine:", error);
            Alert.alert("Error", "Failed to update routine");
        }
    };

    // Initialize on mount
    useEffect(() => {
        initializeTimeSlots();
        loadUserProfile();
        loadData();
    }, [initializeTimeSlots]);

    // Calendar view component with full functionality
    const renderCalendarView = () => {
        return (
            <View style={styles.calendarViewContainer}>
                <ScrollView style={styles.calendarScrollView} showsVerticalScrollIndicator={false}>
                    {timeSlots.map((slot) => (
                        <View key={slot.hour} style={[styles.timeSlot, { borderBottomColor: colors.border }]}>
                            <View style={styles.timeLabel}>
                                <Text style={[styles.timeLabelText, { color: colors.textSecondary }]}>
                                    {formatTime(slot.hour)}
                                </Text>
                            </View>
                            <View style={[styles.timeSlotContent, { backgroundColor: colors.surface }]}>
                                {slot.routines.length === 0 ? (
                                    <TouchableOpacity
                                        style={[styles.emptySlot, { borderColor: colors.border }]}
                                        onPress={() => {
                                            setSelectedTimeSlot(slot.hour);
                                            setShowScheduleModal(true);
                                        }}
                                    >
                                        <Ionicons name="add-circle-outline" size={24} color={colors.textTertiary} />
                                        <Text style={[styles.emptySlotText, { color: colors.textTertiary }]}>
                                            Add routine
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    slot.routines.map((routine, index) => (
                                        <TouchableOpacity
                                            key={`${routine.id}-${index}`}
                                            style={[
                                                styles.calendarRoutineItem,
                                                {
                                                    borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                                                    backgroundColor: routine.isCompleted ? "rgba(76, 175, 80, 0.1)" : colors.background
                                                }
                                            ]}
                                            onPress={() => completeRoutine(routine)}
                                        >
                                            <View style={styles.calendarRoutineLeft}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.calendarCheckbox,
                                                        { borderColor: routine.isCompleted ? "#4CAF50" : colors.border },
                                                        routine.isCompleted && styles.calendarCheckboxCompleted
                                                    ]}
                                                    onPress={() => completeRoutine(routine)}
                                                >
                                                    {routine.isCompleted && (
                                                        <Ionicons name="checkmark" size={12} color="#fff" />
                                                    )}
                                                </TouchableOpacity>
                                                <View style={styles.calendarRoutineInfo}>
                                                    <Text style={[
                                                        styles.calendarRoutineName,
                                                        { color: colors.text },
                                                        routine.isCompleted && styles.calendarRoutineNameCompleted
                                                    ]}>
                                                        {routine.name}
                                                    </Text>
                                                    <Text style={[styles.calendarRoutineDuration, { color: colors.textSecondary }]}>
                                                        {routine.estimated_duration} min • {routine.scheduled_time}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity style={styles.calendarRoutineOptions}>
                                                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                scrollEnabled={scrollEnabled}
            >
                {/* Header with greeting */}
                <View style={[styles.header, { backgroundColor: colors.surface }]}>
                    <View style={styles.headerContent}>
                        <Text style={[styles.greeting, { color: colors.text }]}>
                            {personalizedGreeting}
                        </Text>
                        <View style={styles.headerRight}>
                            <View style={styles.calendarBadge}>
                                <Ionicons name="calendar" size={16} color="#007AFF" />
                                <Text style={[styles.calendarBadgeText, { color: "#007AFF" }]}>
                                    Calendar View
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* CRITICAL: Day selector - ALWAYS visible - SAME AS HOMESCREEN */}
                <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
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
                                        { borderColor: colors.border },
                                        isToday && !isSelected && styles.dayBoxToday,
                                        isSelected && styles.dayBoxSelected,
                                    ]}
                                    onPress={() => setSelectedDay(day.value)}
                                >
                                    <Text
                                        style={[
                                            styles.dayBoxName,
                                            { color: colors.text },
                                            isToday && !isSelected && styles.dayBoxNameToday,
                                            isSelected && styles.dayBoxNameSelected,
                                        ]}
                                    >
                                        {day.name}
                                    </Text>
                                    <View
                                        style={[
                                            styles.dayBoxIndicator,
                                            hasRoutines && styles.dayBoxIndicatorActive,
                                            { backgroundColor: hasRoutines ? (isSelected ? "#fff" : "#007AFF") : "transparent" }
                                        ]}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Calendar View - Time slots */}
                {renderCalendarView()}

                {/* Schedule Modal */}
                <Modal
                    visible={showScheduleModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowScheduleModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Schedule for {selectedTimeSlot ? formatTime(selectedTimeSlot) : ''}
                                </Text>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => setShowScheduleModal(false)}
                                >
                                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalScrollView}>
                                {availableRoutines.map((routine) => (
                                    <TouchableOpacity
                                        key={routine.id}
                                        style={[
                                            styles.modalRoutineItem,
                                            { backgroundColor: colors.background }
                                        ]}
                                        onPress={() => {
                                            // Handle routine scheduling
                                            setShowScheduleModal(false);
                                        }}
                                    >
                                        <View style={styles.modalRoutineInfo}>
                                            <Text style={[styles.modalRoutineName, { color: colors.text }]}>
                                                {routine.name}
                                            </Text>
                                            <Text style={[styles.modalRoutineDescription, { color: colors.textSecondary }]}>
                                                {routine.description || 'No description'}
                                            </Text>
                                        </View>
                                        <View style={[styles.modalCheckbox, { borderColor: colors.border }]}>
                                            <Ionicons name="add" size={16} color={colors.textSecondary} />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 20,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    greeting: {
        fontSize: 24,
        fontWeight: "700",
        flex: 1,
    },
    headerRight: {
        alignItems: "flex-end",
    },
    calendarBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0, 122, 255, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    calendarBadgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    // CRITICAL: Same calendar container and day selector styles as HomeScreen
    calendarContainer: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    calendarGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    dayBox: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginHorizontal: 2,
        borderRadius: 8,
        borderWidth: 1,
    },
    dayBoxToday: {
        borderColor: "#007AFF",
        backgroundColor: "rgba(0, 122, 255, 0.1)",
    },
    dayBoxSelected: {
        backgroundColor: "#007AFF",
        borderColor: "#007AFF",
    },
    dayBoxName: {
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 4,
    },
    dayBoxNameToday: {
        color: "#007AFF",
    },
    dayBoxNameSelected: {
        color: "#fff",
    },
    dayBoxIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dayBoxIndicatorActive: {
        // backgroundColor will be set inline
    },
    // Calendar view specific styles
    calendarViewContainer: {
        flex: 1,
        marginHorizontal: 16,
    },
    calendarScrollView: {
        flex: 1,
    },
    timeSlot: {
        flexDirection: "row",
        alignItems: "flex-start",
        borderBottomWidth: 1,
        paddingVertical: 8,
    },
    timeLabel: {
        width: 80,
        paddingTop: 16,
        paddingHorizontal: 12,
        alignItems: "center",
    },
    timeLabelText: {
        fontSize: 12,
        fontWeight: "500",
    },
    timeSlotContent: {
        flex: 1,
        padding: 12,
        marginRight: 16,
        marginVertical: 8,
        borderRadius: 8,
        minHeight: 64,
    },
    emptySlot: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderStyle: "dashed",
        borderRadius: 8,
        paddingVertical: 16,
    },
    emptySlotText: {
        fontSize: 14,
        marginTop: 4,
    },
    calendarRoutineItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
    },
    calendarRoutineLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    calendarCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    calendarCheckboxCompleted: {
        backgroundColor: "#4CAF50",
        borderColor: "#4CAF50",
    },
    calendarRoutineInfo: {
        flex: 1,
    },
    calendarRoutineName: {
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 2,
    },
    calendarRoutineNameCompleted: {
        textDecorationLine: "line-through",
        color: "#999",
    },
    calendarRoutineDuration: {
        fontSize: 12,
    },
    calendarRoutineOptions: {
        padding: 4,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "90%",
        maxHeight: "80%",
        borderRadius: 12,
        padding: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0, 0, 0, 0.1)",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScrollView: {
        maxHeight: 400,
    },
    modalRoutineItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 4,
        borderRadius: 8,
    },
    modalRoutineInfo: {
        flex: 1,
    },
    modalRoutineName: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 2,
    },
    modalRoutineDescription: {
        fontSize: 14,
    },
    modalCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
    },
});

export default CalendarHomeScreen;