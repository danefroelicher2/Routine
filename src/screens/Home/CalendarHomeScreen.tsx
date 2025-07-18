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

    // ENHANCED: New drag state for improved UX
    const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    // ENHANCED: Edit mode state for delete functionality
    const [isEditMode, setIsEditMode] = useState(false);
    const [editSection, setEditSection] = useState<"daily" | "weekly" | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [routineToDelete, setRoutineToDelete] = useState<{
        routine: RoutineWithCompletion;
        section: "daily" | "weekly";
    } | null>(null);

    // ENHANCED: Edit routine modal state
    const [showEditRoutineModal, setShowEditRoutineModal] = useState(false);
    const [routineToEdit, setRoutineToEdit] = useState<RoutineWithCompletion | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: "",
        description: "",
    });

    // ENHANCED: Animated values for smooth interactions
    const dragY = useRef(new Animated.Value(0)).current;
    const dragScale = useRef(new Animated.Value(1)).current;
    const dragOpacity = useRef(new Animated.Value(1)).current;
    const dropZoneOpacity = useRef(new Animated.Value(0)).current;

    // Get screen dimensions for better calculations
    const { width: screenWidth } = Dimensions.get("window");

    // Days of the week
    const daysOfWeek = [
        { name: "Sun", value: 0 },
        { name: "Mon", value: 1 },
        { name: "Tue", value: 2 },
        { name: "Wed", value: 3 },
        { name: "Thu", value: 4 },
        { name: "Fri", value: 5 },
        { name: "Sat", value: 6 },
    ];

    // NEW: Generate time slots for calendar view
    const generateTimeSlots = useCallback(() => {
        const slots: TimeSlot[] = [];

        // Generate slots from 6 AM to 11 PM
        for (let hour = 6; hour <= 23; hour++) {
            const slotRoutines = dailyRoutines.filter(routine => {
                if (routine.scheduled_time) {
                    const [routineHour] = routine.scheduled_time.split(':').map(Number);
                    return routineHour === hour;
                }
                return false;
            }) as ScheduledRoutine[];

            slots.push({
                hour,
                routines: slotRoutines,
            });
        }

        setTimeSlots(slots);
    }, [dailyRoutines]);

    // NEW: Format time for display
    const formatTime = (hour: number): string => {
        if (hour === 0) return "12:00 AM";
        if (hour === 12) return "12:00 PM";
        if (hour < 12) return `${hour}:00 AM`;
        return `${hour - 12}:00 PM`;
    };

    // NEW: Sync streak data in background
    const syncStreaksAfterCompletion = async (userId: string) => {
        try {
            await StreakSyncService.checkAndSyncUserStreaks(userId);
        } catch (error) {
            console.error("Error syncing streaks after completion:", error);
        }
    };

    // Create a function to get time period and generate seed for consistent randomness
    const getTimePeriodInfo = () => {
        const now = new Date();
        const hour = now.getHours();
        const dateString = getLocalDateString(now);

        let timePeriod: string;
        if (hour >= 5 && hour < 12) {
            timePeriod = "morning";
        } else if (hour >= 12 && hour < 17) {
            timePeriod = "afternoon";
        } else if (hour >= 17 && hour < 21) {
            timePeriod = "evening";
        } else {
            timePeriod = "night";
        }

        const seed = `${dateString}-${timePeriod}`;
        return { timePeriod, seed, hour };
    };

    // Simple seeded random function to ensure consistency
    const seededRandom = (seed: string) => {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash) / 2147483648;
    };

    // Memoized greeting that only changes when the time period changes
    const personalizedGreeting = useMemo(() => {
        const { timePeriod, seed, hour } = getTimePeriodInfo();
        const firstName = userProfile?.full_name?.split(" ")[0] || "there";

        const morningGreetings = [
            `Good morning, ${firstName}!`,
            `Rise and shine, ${firstName}`,
            `Morning, ${firstName}.`,
            `Start strong, ${firstName}`,
            `New day, new you, ${firstName}.`,
            `Let's conquer today, ${firstName}!`,
            `Early bird gets the worm, ${firstName}`,
            `Ready to seize the day, ${firstName}?`,
            `Fresh start awaits, ${firstName}.`,
        ];

        const afternoonGreetings = [
            `Good afternoon, ${firstName}`,
            `Halfway there, ${firstName}!`,
            `Keep it up, ${firstName}.`,
            `Afternoon momentum, ${firstName}`,
            `You're crushing it, ${firstName}`,
            `Stay focused, ${firstName}.`,
            `Pushing through, ${firstName}?`,
            `Making progress, ${firstName}`,
            `Steady as she goes, ${firstName}.`,
        ];

        const eveningGreetings = [
            `Good evening, ${firstName}`,
            `Evening wind down, ${firstName}`,
            `How did today go, ${firstName}?`,
            `Wrapping up strong, ${firstName}?`,
            `Reflect and recharge, ${firstName}`,
            `Proud of today, ${firstName}?`,
            `Rest well tonight, ${firstName}`,
            `Tomorrow awaits, ${firstName}`,
            `End on a high note, ${firstName}`,
        ];

        const nightGreetings = [
            `Working late, ${firstName}?`,
            `Night owl mode, ${firstName}`,
            `Burning the midnight oil, ${firstName}?`,
            `Late night productivity, ${firstName}`,
            `Making the most of tonight, ${firstName}?`,
            `Night shift, ${firstName}?`,
            `Still going strong, ${firstName}`,
            `Quiet hours, ${firstName}`,
            `Peace and focus, ${firstName}`,
        ];

        let greetingArray = morningGreetings;
        if (timePeriod === "afternoon") greetingArray = afternoonGreetings;
        else if (timePeriod === "evening") greetingArray = eveningGreetings;
        else if (timePeriod === "night") greetingArray = nightGreetings;

        const randomValue = seededRandom(seed);
        const greetingIndex = Math.floor(randomValue * greetingArray.length);
        return greetingArray[greetingIndex];
    }, [userProfile?.full_name]);

    // ✅ ENHANCED: Load data with LOCAL TIMEZONE fixes
    const loadData = useCallback(async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            // NEW: Sync streak data when user opens the app (background operation)
            StreakSyncService.checkAndSyncUserStreaks(user.id);

            // Load profile
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            setUserProfile(profileData);

            // ✅ CRITICAL FIX: Calculate week start using local timezone
            const now = new Date();
            const currentDay = now.getDay();
            const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);

            // ✅ CRITICAL FIX: Query completions using local date strings
            const todayStr = getLocalDateString(now);
            const weekStartStr = getLocalDateString(weekStart);

            // Load routines, completions, and day assignments
            const [
                routinesResult,
                dailyCompletionsResult,
                weeklyCompletionsResult,
                dayRoutinesResult,
            ] = await Promise.all([
                supabase
                    .from("user_routines")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("is_active", true)
                    .order("sort_order"),
                supabase
                    .from("routine_completions")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("completion_date", todayStr),
                supabase
                    .from("routine_completions")
                    .select("*")
                    .eq("user_id", user.id)
                    .gte("week_start_date", weekStartStr)
                    .lt(
                        "week_start_date",
                        getLocalDateString(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000))
                    ),
                supabase.from("user_day_routines").select("*").eq("user_id", user.id),
            ]);

            const routines = routinesResult.data || [];
            const dailyCompletions = dailyCompletionsResult.data || [];
            const weeklyCompletions = weeklyCompletionsResult.data || [];
            const dayRoutines = dayRoutinesResult.data || [];

            // Build day-specific routines mapping
            const dayMapping: Record<number, string[]> = {};
            dayRoutines.forEach((dr) => {
                if (!dayMapping[dr.day_of_week]) {
                    dayMapping[dr.day_of_week] = [];
                }
                dayMapping[dr.day_of_week].push(dr.routine_id);
            });
            setDaySpecificRoutines(dayMapping);

            // Process daily routines for the selected day
            const daily: RoutineWithCompletion[] = [];
            const selectedDayRoutineIds = dayMapping[selectedDay] || [];

            routines?.forEach((routine) => {
                if (!routine.is_weekly && selectedDayRoutineIds.includes(routine.id)) {
                    const completion = dailyCompletions?.find(
                        (c) => c.routine_id === routine.id
                    );
                    daily.push({
                        ...routine,
                        isCompleted: !!completion,
                        completionId: completion?.id,
                    });
                }
            });

            // Process weekly routines
            const weekly: RoutineWithCompletion[] = [];
            routines?.forEach((routine) => {
                if (routine.is_weekly) {
                    const completion = weeklyCompletions?.find(
                        (c) => c.routine_id === routine.id
                    );
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
            const hoursLeft = Math.floor(
                (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );

            if (daysLeft > 0) {
                setWeekTimeRemaining(`${daysLeft}d ${hoursLeft}h left`);
            } else {
                setWeekTimeRemaining(`${hoursLeft}h left`);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            Alert.alert("Error", "Failed to load routines");
        }
    }, [selectedDay]);

    useEffect(() => {
        loadData();
    }, [selectedDay]);

    useEffect(() => {
        generateTimeSlots();
    }, [generateTimeSlots]);

    useEffect(() => {
        const unsubscribe = navigation.addListener("focus", () => {
            console.log("CalendarHomeScreen focused - reloading data");
            loadData();
        });

        return unsubscribe;
    }, [navigation, loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, [loadData]);

    // ✅ ENHANCED toggleRoutineCompletion function with LOCAL TIMEZONE fixes
    const toggleRoutineCompletion = async (
        routine: RoutineWithCompletion,
        isWeekly: boolean
    ) => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            if (routine.isCompleted && routine.completionId) {
                // UNCHECKING a routine
                const { error } = await supabase
                    .from("routine_completions")
                    .delete()
                    .eq("id", routine.completionId);

                if (error) throw error;

                console.log("❌ ROUTINE UNCHECKED:");
                console.log("  - Routine:", routine.name);
                console.log("  - Completion removed for today");
            } else {
                // CHECKING a routine
                // ✅ CRITICAL FIX: Always use today's LOCAL date for completion, regardless of selectedDay
                const today = new Date();
                const completionDate = getLocalDateString(today);

                let weekStartDate = null;
                if (isWeekly) {
                    const now = new Date();
                    const currentDay = now.getDay();
                    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - daysFromMonday);
                    weekStart.setHours(0, 0, 0, 0);
                    weekStartDate = getLocalDateString(weekStart);
                }

                const { error } = await supabase.from("routine_completions").insert({
                    user_id: user.id,
                    routine_id: routine.id,
                    completion_date: completionDate, // ✅ FIXED: Using local date
                    week_start_date: weekStartDate,
                });

                if (error) throw error;

                console.log("✅ ROUTINE CHECKED (FIXED):");
                console.log("  - Routine:", routine.name);
                console.log("  - Completion date (LOCAL):", completionDate);
            }

            // Sync streaks in background
            await syncStreaksAfterCompletion(user.id);

            // Reload data to reflect changes
            await loadData();
        } catch (error) {
            console.error("Error toggling routine:", error);
            Alert.alert("Error", "Failed to update routine");
        }
    };

    // NEW: Add routine to time slot
    const addRoutineToTimeSlot = async (routineId: string, hour: number) => {
        try {
            const { error } = await supabase
                .from("user_routines")
                .update({
                    scheduled_time: `${hour.toString().padStart(2, '0')}:00`,
                    estimated_duration: 30, // Default 30 minutes
                })
                .eq("id", routineId);

            if (error) throw error;
            await loadData();
            setShowScheduleModal(false);
        } catch (error) {
            console.error("Error scheduling routine:", error);
            Alert.alert("Error", "Failed to schedule routine");
        }
    };

    // Load available routines for day assignment modal
    const loadAvailableRoutines = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("user_routines")
                .select("*")
                .eq("user_id", user.id)
                .eq("is_weekly", false)
                .eq("is_active", true)
                .order("name");

            if (error) throw error;
            setAvailableRoutines(data || []);
        } catch (error) {
            console.error("Error loading available routines:", error);
        }
    };

    // Add routine to selected day
    const addRoutineToDay = async (routineId: string) => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from("user_day_routines").insert({
                user_id: user.id,
                routine_id: routineId,
                day_of_week: selectedDay,
            });

            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Error adding routine to day:", error);
            Alert.alert("Error", "Failed to add routine");
        }
    };

    // Remove routine from selected day
    const removeRoutineFromDay = async (routineId: string) => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from("user_day_routines")
                .delete()
                .eq("user_id", user.id)
                .eq("routine_id", routineId)
                .eq("day_of_week", selectedDay);

            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Error removing routine from day:", error);
            Alert.alert("Error", "Failed to remove routine");
        }
    };

    // NEW: Calendar view component with full functionality
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
                                            loadAvailableRoutines();
                                            setShowScheduleModal(true);
                                        }}
                                    >
                                        <Ionicons name="add" size={24} color={colors.textTertiary} />
                                        <Text style={[styles.emptySlotText, { color: colors.textTertiary }]}>
                                            Add routine
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    slot.routines.map((routine) => (
                                        <TouchableOpacity
                                            key={routine.id}
                                            style={[
                                                styles.calendarRoutineItem,
                                                {
                                                    backgroundColor: routine.isCompleted ? "#E8F5E8" : colors.background,
                                                    borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                                                },
                                            ]}
                                            onPress={() => toggleRoutineCompletion(routine, false)}
                                        >
                                            <View style={styles.calendarRoutineLeft}>
                                                <View
                                                    style={[
                                                        styles.calendarCheckbox,
                                                        {
                                                            borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                                                        },
                                                        routine.isCompleted && styles.calendarCheckboxCompleted,
                                                    ]}
                                                >
                                                    {routine.isCompleted && (
                                                        <Ionicons name="checkmark" size={14} color="#fff" />
                                                    )}
                                                </View>
                                                <View style={styles.calendarRoutineInfo}>
                                                    <Text
                                                        style={[
                                                            styles.calendarRoutineName,
                                                            { color: colors.text },
                                                            routine.isCompleted && styles.calendarRoutineNameCompleted,
                                                        ]}
                                                    >
                                                        {routine.name}
                                                    </Text>
                                                    <Text style={[styles.calendarRoutineDuration, { color: colors.textSecondary }]}>
                                                        {routine.estimated_duration || 30} min
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.calendarRoutineOptions}
                                                onPress={() => {
                                                    Alert.alert(
                                                        "Routine Options",
                                                        `What would you like to do with "${routine.name}"?`,
                                                        [
                                                            { text: "Cancel", style: "cancel" },
                                                            {
                                                                text: "Remove from schedule",
                                                                style: "destructive",
                                                                onPress: async () => {
                                                                    try {
                                                                        await supabase
                                                                            .from("user_routines")
                                                                            .update({ scheduled_time: null })
                                                                            .eq("id", routine.id);
                                                                        loadData();
                                                                    } catch (error) {
                                                                        console.error("Error removing schedule:", error);
                                                                    }
                                                                }
                                                            },
                                                        ]
                                                    );
                                                }}
                                            >
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

                {/* Day selector - ALWAYS visible */}
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

                {/* Calendar View */}
                {renderCalendarView()}
            </ScrollView>

            {/* Day Routine Modal */}
            <Modal
                visible={showDayRoutineModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowDayRoutineModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Routines for {daysOfWeek.find(d => d.value === selectedDay)?.name}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowDayRoutineModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScrollView}>
                            {availableRoutines.map((routine) => {
                                const isAssigned = (daySpecificRoutines[selectedDay] || []).includes(routine.id);
                                return (
                                    <TouchableOpacity
                                        key={routine.id}
                                        style={[
                                            styles.modalRoutineItem,
                                            { backgroundColor: colors.background },
                                            isAssigned && styles.modalRoutineItemSelected,
                                        ]}
                                        onPress={() => {
                                            if (isAssigned) {
                                                removeRoutineFromDay(routine.id);
                                            } else {
                                                addRoutineToDay(routine.id);
                                            }
                                        }}
                                    >
                                        <View style={styles.modalRoutineInfo}>
                                            <Text style={[styles.modalRoutineName, { color: colors.text }]}>
                                                {routine.name}
                                            </Text>
                                            {routine.description && (
                                                <Text style={[styles.modalRoutineDescription, { color: colors.textSecondary }]}>
                                                    {routine.description}
                                                </Text>
                                            )}
                                        </View>
                                        <View
                                            style={[
                                                styles.modalCheckbox,
                                                { borderColor: isAssigned ? "#007AFF" : colors.border },
                                                isAssigned && styles.modalCheckboxSelected,
                                            ]}
                                        >
                                            {isAssigned && (
                                                <Ionicons name="checkmark" size={16} color="#fff" />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* NEW: Schedule Routine Modal */}
            <Modal
                visible={showScheduleModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowScheduleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Schedule for {selectedTimeSlot ? formatTime(selectedTimeSlot) : ""}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowScheduleModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScrollView}>
                            {availableRoutines
                                .filter(routine => (daySpecificRoutines[selectedDay] || []).includes(routine.id))
                                .filter(routine => !routine.scheduled_time) // Only show unscheduled routines
                                .map((routine) => (
                                    <TouchableOpacity
                                        key={routine.id}
                                        style={[
                                            styles.modalRoutineItem,
                                            { backgroundColor: colors.background },
                                        ]}
                                        onPress={() => {
                                            if (selectedTimeSlot !== null) {
                                                addRoutineToTimeSlot(routine.id, selectedTimeSlot);
                                            }
                                        }}
                                    >
                                        <View style={styles.modalRoutineInfo}>
                                            <Text style={[styles.modalRoutineName, { color: colors.text }]}>
                                                {routine.name}
                                            </Text>
                                            {routine.description && (
                                                <Text style={[styles.modalRoutineDescription, { color: colors.textSecondary }]}>
                                                    {routine.description}
                                                </Text>
                                            )}
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                ))}

                            {availableRoutines
                                .filter(routine => (daySpecificRoutines[selectedDay] || []).includes(routine.id))
                                .filter(routine => !routine.scheduled_time).length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                            No unscheduled routines available
                                        </Text>
                                        <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
                                            All your routines for today are already scheduled
                                        </Text>
                                    </View>
                                )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// Styles
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
        padding: 20,
        marginBottom: 16,
        borderRadius: 12,
        marginHorizontal: 16,
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
    emptyState: {
        padding: 32,
        alignItems: "center",
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: "500",
        marginBottom: 4,
        textAlign: "center",
    },
    emptyStateSubtext: {
        fontSize: 14,
        textAlign: "center",
    },
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
    modalRoutineItemSelected: {
        backgroundColor: "rgba(0, 122, 255, 0.1)",
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
    modalCheckboxSelected: {
        backgroundColor: "#007AFF",
        borderColor: "#007AFF",
    },
});

export default CalendarHomeScreen;