// src/screens/Home/HomeScreen.tsx
// ✅ COMPLETE: All existing functionality + working calendar scheduling + CREATE BUTTON

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

// ✅ NEW: Interface for scheduled routines
interface ScheduledRoutine extends RoutineWithCompletion {
  scheduled_time: string;
  estimated_duration: number;
  scheduled_id?: string;
}

// ✅ NEW: Interface for time slots
interface TimeSlot {
  hour: number;
  routines: ScheduledRoutine[];
}

interface HomeScreenProps {
  navigation: any;
}

// ✅ CRITICAL FIX: Utility function to get local date string consistently
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();

  // NEW: Calendar toggle state
  const [isCalendarView, setIsCalendarView] = useState(false);

  const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weekTimeRemaining, setWeekTimeRemaining] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
  const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
  const [daySpecificRoutines, setDaySpecificRoutines] = useState<Record<number, string[]>>({});
  const [userProfile, setUserProfile] = useState<any>(null);

  // ✅ NEW: Calendar-specific state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);

  // ✅ NEW: Create routine modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreloadedOptions, setShowPreloadedOptions] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDescription, setNewRoutineDescription] = useState("");

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

  // ✅ NEW: Preloaded routine options
  const preloadedRoutines = [
    { name: "Morning Workout", description: "30 min cardio and strength training", icon: "💪" },
    { name: "Meditation", description: "10 min mindfulness practice", icon: "🧘" },
    { name: "Read", description: "30 min reading session", icon: "📚" },
    { name: "Hydrate", description: "Drink a glass of water", icon: "💧" },
    { name: "Walk", description: "20 min outdoor walk", icon: "🚶" },
    { name: "Journaling", description: "5 min gratitude journaling", icon: "📝" },
    { name: "Stretch", description: "10 min full body stretch", icon: "🤸" },
    { name: "Call Family", description: "Check in with loved ones", icon: "📞" },
  ];

  // ✅ NEW: Initialize time slots function
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

  // ✅ NEW: Format time function
  const formatTime = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
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

  // ✅ NEW: Load scheduled routines function
  const loadScheduledRoutines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = getLocalDateString(new Date());

      const { data: scheduledData, error } = await supabase
        .from("routine_schedule")
        .select(`
          id,
          routine_id,
          scheduled_time,
          estimated_duration,
          day_of_week,
          user_routines (
            id,
            user_id,
            name,
            description,
            icon,
            target_value,
            target_unit,
            is_daily,
            is_weekly,
            is_active,
            sort_order,
            created_at,
            updated_at
          )
        `)
        .eq("user_id", user.id)
        .eq("day_of_week", selectedDay)
        .eq("is_active", true);

      if (error) throw error;

      // Load routine completions for today
      const { data: completions, error: completionsError } = await supabase
        .from("routine_completions")
        .select("*")
        .eq("user_id", user.id)
        .eq("completion_date", today);

      if (completionsError) throw completionsError;

      // Create completion map
      const completionMap = new Map(
        (completions || []).map(c => [c.routine_id, { isCompleted: true, completionId: c.id }])
      );

      // Convert to scheduled routines format
      const scheduledRoutines: ScheduledRoutine[] = (scheduledData || [])
        .filter(item => item.user_routines) // Filter out items where user_routines is null
        .map(item => {
          const routine = item.user_routines as any; // Type assertion since Supabase types can be tricky
          return {
            // UserRoutine properties
            id: routine.id,
            user_id: routine.user_id || '',
            name: routine.name,
            description: routine.description || '',
            icon: routine.icon || '',
            target_value: routine.target_value || null,
            target_unit: routine.target_unit || '',
            is_daily: routine.is_daily || false,
            is_weekly: routine.is_weekly || false,
            is_active: routine.is_active || true,
            sort_order: routine.sort_order || 0,
            created_at: routine.created_at || '',
            updated_at: routine.updated_at || '',

            // ScheduledRoutine specific properties
            scheduled_time: item.scheduled_time,
            estimated_duration: item.estimated_duration || 30,
            scheduled_id: item.id,

            // Completion properties
            isCompleted: completionMap.has(item.routine_id),
            completionId: completionMap.get(item.routine_id)?.completionId,
          };
        });

      // Distribute into time slots
      const newTimeSlots = timeSlots.map(slot => ({
        ...slot,
        routines: scheduledRoutines.filter(r => {
          const [hourStr] = r.scheduled_time.split(':');
          return parseInt(hourStr) === slot.hour;
        })
      }));

      setTimeSlots(newTimeSlots);

    } catch (error) {
      console.error("Error loading scheduled routines:", error);
    }
  };

  // ✅ NEW: Schedule routine to time slot function
  const scheduleRoutineToTimeSlot = async (routineId: string, hour: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const scheduledTime = `${hour.toString().padStart(2, '0')}:00`;

      // Check if already scheduled
      const { data: existing, error: checkError } = await supabase
        .from("routine_schedule")
        .select("id")
        .eq("user_id", user.id)
        .eq("routine_id", routineId)
        .eq("day_of_week", selectedDay)
        .eq("scheduled_time", scheduledTime);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        Alert.alert("Already Scheduled", "This routine is already scheduled for this time slot.");
        return;
      }

      // Insert the scheduled routine
      const { error } = await supabase
        .from("routine_schedule")
        .insert({
          user_id: user.id,
          routine_id: routineId,
          day_of_week: selectedDay,
          scheduled_time: scheduledTime,
          estimated_duration: 30,
          is_active: true
        });

      if (error) throw error;

      // Reload data
      await loadData();
      setShowScheduleModal(false);

    } catch (error) {
      console.error("Error scheduling routine:", error);
      Alert.alert("Error", "Failed to schedule routine");
    }
  };

  // ✅ NEW: Remove scheduled routine function
  const removeRoutineFromTimeSlot = async (scheduledId: string) => {
    try {
      const { error } = await supabase
        .from("routine_schedule")
        .delete()
        .eq("id", scheduledId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error removing scheduled routine:", error);
      Alert.alert("Error", "Failed to remove routine from schedule");
    }
  };

  // ✅ NEW: Create new routine function
  const createNewRoutine = async (routineData: { name: string; description: string; icon?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: routineData.name,
          description: routineData.description,
          icon: routineData.icon || "🎯",
          is_daily: true,
          is_active: true,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Reload data to include the new routine
      await loadData();
      await loadAvailableRoutines();

      setShowCreateModal(false);
      setShowPreloadedOptions(false);
      setNewRoutineName("");
      setNewRoutineDescription("");

      Alert.alert("Success", "Routine created successfully!");

    } catch (error) {
      console.error("Error creating routine:", error);
      Alert.alert("Error", "Failed to create routine");
    }
  };

  // ✅ ENHANCED: Load data with LOCAL TIMEZONE fixes + calendar support
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

      // ✅ NEW: Load scheduled routines if in calendar view
      if (isCalendarView) {
        await loadScheduledRoutines();
      }

    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Error", "Failed to load routines");
    }
  }, [selectedDay, isCalendarView]);

  // ✅ ENHANCED: Initialize and reload effects
  useEffect(() => {
    initializeTimeSlots();
    loadData();
  }, [selectedDay]);

  // ✅ NEW: Reload scheduled routines when day or view changes
  useEffect(() => {
    if (isCalendarView) {
      loadScheduledRoutines();
    }
  }, [selectedDay, isCalendarView]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("HomeScreen focused - reloading data");
      loadData();
    });

    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [loadData]);

  // ✅ ENHANCED: Function to check if all daily routines are completed with LOCAL TIMEZONE
  const checkDailyCompletionStatus = async (userId: string) => {
    try {
      // ✅ CRITICAL FIX: Use local timezone for today
      const today = new Date();
      const todayStr = getLocalDateString(today);
      const dayOfWeek = today.getDay();

      console.log("🔍 CHECKING DAILY COMPLETION STATUS (FIXED):");
      console.log("  - Date (LOCAL):", todayStr);
      console.log("  - Day of week:", dayOfWeek);

      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId)
            .eq("completion_date", todayStr),
          supabase
            .from("user_routines")
            .select("id, name, is_weekly")
            .eq("user_id", userId),
          supabase
            .from("user_day_routines")
            .select("routine_id, day_of_week")
            .eq("user_id", userId)
            .eq("day_of_week", dayOfWeek),
        ]);

      if (completionsResult.error) throw completionsResult.error;
      if (userRoutinesResult.error) throw userRoutinesResult.error;
      if (dayRoutinesResult.error) throw dayRoutinesResult.error;

      const todayCompletions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const todayRoutineAssignments = dayRoutinesResult.data || [];

      const todayDailyRoutineIds = todayRoutineAssignments.map((a) => a.routine_id);
      const todayDailyRoutines = userRoutines.filter(
        (routine) => !routine.is_weekly && todayDailyRoutineIds.includes(routine.id)
      );

      const completedRoutineIds = todayCompletions.map((c) => c.routine_id);

      const allCompleted =
        todayDailyRoutines.length > 0 &&
        todayDailyRoutines.every((routine) =>
          completedRoutineIds.includes(routine.id)
        );

      console.log("📋 COMPLETION CHECK RESULTS (FIXED):");
      console.log("  - Required routines today:", todayDailyRoutines.map((r) => r.name));
      console.log("  - Completed routine IDs:", completedRoutineIds);
      console.log("  - All daily routines completed:", allCompleted);

      if (allCompleted) {
        console.log("🎉 ALL DAILY ROUTINES COMPLETED!");
        console.log("  - Stats calendar should show GREEN for today");
        console.log("  - Date (LOCAL):", todayStr);
      } else {
        const missing = todayDailyRoutines.filter(
          (r) => !completedRoutineIds.includes(r.id)
        );
        console.log("⏳ Still need to complete:", missing.map((r) => r.name));
      }

      return allCompleted;
    } catch (error) {
      console.error("Error checking completion status:", error);
      return false;
    }
  };

  // ✅ ENHANCED toggleRoutineCompletion function with LOCAL TIMEZONE fixes + scheduled routine support
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

      // Check if all daily routines are now completed
      const allCompleted = await checkDailyCompletionStatus(user.id);

      if (allCompleted) {
        console.log("🎯 ALL DAILY ROUTINES COMPLETED FOR TODAY!");
        console.log("  - This should trigger GREEN in Stats calendar");
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

  // ✅ RESTORED: Original Pan responder for drag and drop
  const createPanResponder = (index: number, section: "daily" | "weekly") => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dy) > 3 && Math.abs(dy) > Math.abs(dx) * 0.5;
      },

      onPanResponderGrant: () => {
        setIsDragging(true);
        setDraggedIndex(index);
        setDraggedSection(section);
        setOriginalIndex(index);
        setIsDragActive(true);
        setScrollEnabled(false);

        Animated.parallel([
          Animated.spring(dragScale, {
            toValue: 1.05,
            useNativeDriver: false,
            tension: 200,
            friction: 8,
          }),
          Animated.timing(dragOpacity, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
      },

      onPanResponderMove: (evt, gestureState) => {
        dragY.setValue(gestureState.dy);

        const routines = section === "daily" ? dailyRoutines : weeklyRoutines;
        const maxRoutines = routines.length - 1;
        const itemSpacing = 100;
        const movementRatio = gestureState.dy / itemSpacing;
        const balancedMovement = movementRatio * 0.68;

        const newIndex = Math.max(
          0,
          Math.min(maxRoutines, Math.round(index + balancedMovement))
        );

        if (
          newIndex !== dropZoneIndex &&
          newIndex >= 0 &&
          newIndex <= maxRoutines
        ) {
          setDropZoneIndex(newIndex);

          Animated.timing(dropZoneOpacity, {
            toValue: newIndex !== index ? 0.3 : 0,
            duration: 150,
            useNativeDriver: false,
          }).start();
        }

        if (
          newIndex !== lastSwapIndex &&
          newIndex !== index &&
          newIndex >= 0 &&
          newIndex <= maxRoutines
        ) {
          setLastSwapIndex(newIndex);

          const newRoutines = [...routines];
          const draggedItem = newRoutines[index];
          newRoutines.splice(index, 1);
          newRoutines.splice(newIndex, 0, draggedItem);

          if (section === "daily") {
            setDailyRoutines(newRoutines);
          } else {
            setWeeklyRoutines(newRoutines);
          }

          setDraggedIndex(newIndex);
        }
      },

      onPanResponderRelease: async (evt, gestureState) => {
        setIsDragging(false);
        setIsDragActive(false);
        setScrollEnabled(true);
        setDropZoneIndex(null);

        Animated.parallel([
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 300,
            friction: 10,
          }),
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: false,
            tension: 200,
            friction: 8,
          }),
          Animated.timing(dragOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(dropZoneOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();

        setDraggedIndex(null);
        setDraggedSection(null);
        setOriginalIndex(null);
        setLastSwapIndex(null);

        if (originalIndex !== draggedIndex) {
          await saveRoutineOrder(section);
        }
      },
    });
  };

  // Save routine order to database
  const saveRoutineOrder = async (section: "daily" | "weekly") => {
    try {
      const routines = section === "daily" ? dailyRoutines : weeklyRoutines;

      const updates = routines.map((routine, index) => ({
        id: routine.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("user_routines")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving routine order:", error);
      Alert.alert("Error", "Failed to save routine order");
    }
  };

  // ✅ RESTORED: Edit mode functions
  const toggleEditMode = (section: "daily" | "weekly") => {
    if (isEditMode && editSection === section) {
      setIsEditMode(false);
      setEditSection(null);
    } else {
      setIsEditMode(true);
      setEditSection(section);
    }
  };

  const handleDeleteRoutine = (routine: RoutineWithCompletion, section: "daily" | "weekly") => {
    setRoutineToDelete({ routine, section });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRoutine = async () => {
    if (!routineToDelete) return;

    try {
      const { error } = await supabase
        .from("user_routines")
        .update({ is_active: false })
        .eq("id", routineToDelete.routine.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setRoutineToDelete(null);
      setIsEditMode(false);
      await loadData();
    } catch (error) {
      console.error("Error deleting routine:", error);
      Alert.alert("Error", "Failed to delete routine");
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoutineToDelete(null);
  };

  const handleEditRoutine = (routine: RoutineWithCompletion) => {
    setRoutineToEdit(routine);
    setEditFormData({
      name: routine.name,
      description: routine.description || "",
    });
    setShowEditRoutineModal(true);
  };

  const saveEditedRoutine = async () => {
    if (!routineToEdit) return;

    try {
      const { error } = await supabase
        .from("user_routines")
        .update({
          name: editFormData.name,
          description: editFormData.description,
        })
        .eq("id", routineToEdit.id);

      if (error) throw error;

      setShowEditRoutineModal(false);
      setRoutineToEdit(null);
      await loadData();
    } catch (error) {
      console.error("Error updating routine:", error);
      Alert.alert("Error", "Failed to update routine");
    }
  };

  // ✅ RESTORED: Original routine item rendering with full TouchableOpacity
  const renderRoutineItem = (
    routine: RoutineWithCompletion,
    index: number,
    section: "daily" | "weekly"
  ) => {
    const panResponder = createPanResponder(index, section);
    const isBeingDragged = isDragging && draggedIndex === index && draggedSection === section;
    const isDropZone = dropZoneIndex === index && isDragActive && !isBeingDragged && draggedSection === section;
    const isInEditMode = isEditMode && editSection === section;

    return (
      <Animated.View
        key={routine.id}
        style={[
          styles.routineItem,
          isBeingDragged && {
            transform: [
              { translateY: dragY },
              { scale: dragScale },
            ] as any,
            opacity: dragOpacity,
            elevation: 12,
            shadowColor: "#007AFF",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            zIndex: 1000,
          },
          isDropZone && {
            backgroundColor: colors.surface,
            borderColor: "#007AFF",
            borderWidth: 2,
            borderStyle: "dashed",
            opacity: 0.7,
          },
        ]}
      >
        {/* Drop zone indicator overlay */}
        {isDropZone && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#007AFF",
                opacity: dropZoneOpacity,
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Ionicons name="add" size={24} color="white" />
          </Animated.View>
        )}

        <View
          style={[
            styles.routineContent,
            {
              backgroundColor: colors.surface,
              borderColor: routine.isCompleted ? "#007AFF" : colors.border,
              ...(isBeingDragged && {
                backgroundColor: colors.surface,
                borderColor: "#007AFF",
                borderWidth: 2,
              }),
            },
          ]}
        >
          {/* ✅ RESTORED: Full TouchableOpacity for entire routine item */}
          <TouchableOpacity
            style={styles.routineLeft}
            onPress={() => toggleRoutineCompletion(routine, section === "weekly")}
            activeOpacity={routine.isCompleted ? 1 : 0.7}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: routine.isCompleted ? "#007AFF" : colors.border,
                },
                routine.isCompleted && styles.checkboxCompleted,
              ]}
            >
              {routine.isCompleted && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <View style={styles.routineInfo}>
              <Text
                style={[
                  styles.routineName,
                  { color: colors.text },
                  routine.isCompleted && styles.routineNameCompleted,
                ]}
              >
                {routine.name}
              </Text>
              {routine.description && (
                <Text
                  style={[
                    styles.routineDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {routine.description}
                </Text>
              )}
              {routine.target_value && routine.target_unit && (
                <Text style={[styles.routineTarget, { color: colors.textSecondary }]}>
                  Target: {routine.target_value} {routine.target_unit}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Edit mode - show edit and delete buttons, Normal mode - show drag handle */}
          {isInEditMode ? (
            <View style={styles.editModeButtons}>
              <TouchableOpacity
                style={styles.editRoutineButton}
                onPress={() => handleEditRoutine(routine)}
              >
                <Ionicons name="create-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteRoutine(routine, section)}
              >
                <Ionicons name="remove-circle" size={24} color="#ff4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.dragHandle,
                isBeingDragged && styles.dragHandleActive,
              ]}
              {...panResponder.panHandlers}
            >
              <View
                style={[
                  styles.dragIcon,
                  isBeingDragged && styles.dragIconActive,
                ]}
              >
                <View
                  style={[
                    styles.dragLine,
                    {
                      backgroundColor: isBeingDragged
                        ? "#007AFF"
                        : colors.textTertiary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dragLine,
                    {
                      backgroundColor: isBeingDragged
                        ? "#007AFF"
                        : colors.textTertiary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dragLine,
                    {
                      backgroundColor: isBeingDragged
                        ? "#007AFF"
                        : colors.textTertiary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </Animated.View>
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
        {/* Header with greeting and calendar toggle */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {personalizedGreeting}
            </Text>
            <View style={styles.headerRight}>
              <Switch
                value={isCalendarView}
                onValueChange={setIsCalendarView}
                trackColor={{ false: colors.border, true: "#007AFF" }}
                thumbColor={isCalendarView ? "#fff" : "#f4f3f4"}
              />
            </View>
          </View>
        </View>

        {/* Day selector calendar - ALWAYS visible in same position */}
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

        {/* ✅ NEW: CREATE BUTTON SECTION - This is where the create button goes based on your red circle */}
        <View style={[styles.createButtonContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: "#007AFF" }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.createButtonText}>Create Routine</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ ENHANCED: Main content - conditional rendering based on calendar view */}
        {isCalendarView ? (
          /* ✅ NEW: Calendar view with working time slots */
          <View style={styles.calendarViewContainer}>
            <View style={styles.timeSlotsContainer}>
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
                        style={styles.addRoutineToSlot}
                        onPress={() => {
                          setSelectedTimeSlot(slot.hour);
                          loadAvailableRoutines();
                          setShowScheduleModal(true); // ✅ FIXED: Use schedule modal instead of day modal
                        }}
                      >
                        <Ionicons name="add" size={16} color={colors.textTertiary} />
                        <Text style={[styles.addRoutineText, { color: colors.textTertiary }]}>
                          Add routine
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      slot.routines.map((routine, index) => (
                        <View
                          key={`${routine.id}-${index}`}
                          style={[
                            styles.calendarRoutineItem,
                            {
                              borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                              backgroundColor: routine.isCompleted ? "rgba(76, 175, 80, 0.1)" : colors.background
                            }
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.calendarRoutineLeft}
                            onPress={() => toggleRoutineCompletion(routine, false)}
                          >
                            <View
                              style={[
                                styles.calendarCheckbox,
                                { borderColor: routine.isCompleted ? "#4CAF50" : colors.border },
                                routine.isCompleted && styles.calendarCheckboxCompleted
                              ]}
                            >
                              {routine.isCompleted && (
                                <Ionicons name="checkmark" size={12} color="white" />
                              )}
                            </View>
                            <View style={styles.calendarRoutineInfo}>
                              <Text
                                style={[
                                  styles.calendarRoutineName,
                                  { color: colors.text },
                                  routine.isCompleted && styles.calendarRoutineNameCompleted
                                ]}
                              >
                                {routine.name}
                              </Text>
                              <Text style={[styles.calendarRoutineDuration, { color: colors.textSecondary }]}>
                                {routine.estimated_duration} min
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calendarRoutineOptions}
                            onPress={() => {
                              if (routine.scheduled_id) {
                                Alert.alert(
                                  "Remove Routine",
                                  `Remove "${routine.name}" from this time slot?`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Remove",
                                      style: "destructive",
                                      onPress: () => removeRoutineFromTimeSlot(routine.scheduled_id!)
                                    }
                                  ]
                                );
                              }
                            }}
                          >
                            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* ✅ EXISTING: Regular home screen content */
          <>
            {/* Daily Routines Section */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="today" size={24} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Daily Routines
                </Text>
                <TouchableOpacity
                  onPress={() => toggleEditMode("daily")}
                  style={[
                    styles.editButton,
                    isEditMode && editSection === "daily" && styles.editButtonActive,
                  ]}
                >
                  <Ionicons
                    name={
                      isEditMode && editSection === "daily" ? "checkmark" : "pencil"
                    }
                    size={18}
                    color={
                      isEditMode && editSection === "daily" ? "#34c759" : "#666"
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    loadAvailableRoutines();
                    setShowDayRoutineModal(true);
                  }}
                  style={styles.addButton}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {dailyRoutines.length > 0 ? (
                dailyRoutines.map((routine, index) =>
                  renderRoutineItem(routine, index, "daily")
                )
              ) : (
                <View style={styles.emptyState}>
                  <Text
                    style={[styles.emptyStateText, { color: colors.textSecondary }]}
                  >
                    No routines for this day yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyStateSubtext,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Tap the + button to add routines to this day!
                  </Text>
                </View>
              )}
            </View>

            {/* Weekly Routines Section */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={24} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Weekly Goals
                </Text>
                <View
                  style={[
                    styles.weekTimer,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons name="time" size={16} color={colors.textSecondary} />
                  <Text
                    style={[styles.weekTimerText, { color: colors.textSecondary }]}
                  >
                    {weekTimeRemaining}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleEditMode("weekly")}
                  style={[
                    styles.editButton,
                    isEditMode && editSection === "weekly" && styles.editButtonActive,
                  ]}
                >
                  <Ionicons
                    name={
                      isEditMode && editSection === "weekly" ? "checkmark" : "pencil"
                    }
                    size={18}
                    color={
                      isEditMode && editSection === "weekly" ? "#34c759" : "#666"
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => navigation.navigate("AddRoutine")}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {weeklyRoutines.length > 0 ? (
                weeklyRoutines.map((routine, index) =>
                  renderRoutineItem(routine, index, "weekly")
                )
              ) : (
                <View style={styles.emptyState}>
                  <Text
                    style={[styles.emptyStateText, { color: colors.textSecondary }]}
                  >
                    No weekly goals yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyStateSubtext,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Create weekly goals to track larger objectives!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ✅ NEW: Schedule Modal for Calendar View */}
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
                Schedule for {selectedTimeSlot !== null ? formatTime(selectedTimeSlot) : ''}
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
                    if (selectedTimeSlot !== null) {
                      scheduleRoutineToTimeSlot(routine.id, selectedTimeSlot);
                    }
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

      {/* ✅ NEW: Create Routine Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create New Routine
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setShowPreloadedOptions(false);
                  setNewRoutineName("");
                  setNewRoutineDescription("");
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {!showPreloadedOptions ? (
                <View style={styles.createOptionsContainer}>
                  {/* Quick Select from Preloaded */}
                  <TouchableOpacity
                    style={[styles.createOptionButton, { backgroundColor: colors.background, borderColor: "#007AFF" }]}
                    onPress={() => setShowPreloadedOptions(true)}
                  >
                    <Ionicons name="apps" size={24} color="#007AFF" />
                    <Text style={[styles.createOptionText, { color: "#007AFF" }]}>
                      Choose from Templates
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#007AFF" />
                  </TouchableOpacity>

                  {/* Custom Creation */}
                  <View style={styles.customCreateSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Or Create Custom Routine
                    </Text>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Routine Name
                      </Text>
                      <TextInput
                        style={[styles.textInput, {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text
                        }]}
                        value={newRoutineName}
                        onChangeText={setNewRoutineName}
                        placeholder="Enter routine name..."
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Description
                      </Text>
                      <TextInput
                        style={[styles.textInput, {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                          height: 80
                        }]}
                        value={newRoutineDescription}
                        onChangeText={setNewRoutineDescription}
                        placeholder="Enter routine description..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        textAlignVertical="top"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.createSubmitButton, {
                        backgroundColor: newRoutineName.trim() ? "#007AFF" : colors.border,
                        opacity: newRoutineName.trim() ? 1 : 0.6
                      }]}
                      onPress={() => {
                        if (newRoutineName.trim()) {
                          createNewRoutine({
                            name: newRoutineName.trim(),
                            description: newRoutineDescription.trim(),
                            icon: "🎯"
                          });
                        }
                      }}
                      disabled={!newRoutineName.trim()}
                    >
                      <Text style={[styles.createSubmitButtonText, {
                        color: newRoutineName.trim() ? "white" : colors.textTertiary
                      }]}>
                        Create Routine
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.preloadedRoutinesContainer}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setShowPreloadedOptions(false)}
                  >
                    <Ionicons name="chevron-back" size={20} color="#007AFF" />
                    <Text style={[styles.backButtonText, { color: "#007AFF" }]}>Back</Text>
                  </TouchableOpacity>

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Choose a Template
                  </Text>

                  {preloadedRoutines.map((routine, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.preloadedRoutineItem, {
                        backgroundColor: colors.background,
                        borderColor: colors.border
                      }]}
                      onPress={() => {
                        createNewRoutine({
                          name: routine.name,
                          description: routine.description,
                          icon: routine.icon
                        });
                      }}
                    >
                      <Text style={styles.preloadedRoutineIcon}>{routine.icon}</Text>
                      <View style={styles.preloadedRoutineInfo}>
                        <Text style={[styles.preloadedRoutineName, { color: colors.text }]}>
                          {routine.name}
                        </Text>
                        <Text style={[styles.preloadedRoutineDescription, { color: colors.textSecondary }]}>
                          {routine.description}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color="#007AFF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Day Routine Modal - EXISTING */}
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

      {/* Delete Confirmation Modal - EXISTING */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
              Delete Routine
            </Text>
            <Text style={[styles.deleteModalText, { color: colors.textSecondary }]}>
              Are you sure you want to delete "{routineToDelete?.routine.name}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.confirmButton]}
                onPress={confirmDeleteRoutine}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Routine Modal - EXISTING */}
      <Modal
        visible={showEditRoutineModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditRoutineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Edit Routine
              </Text>
              <TouchableOpacity
                onPress={() => setShowEditRoutineModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background, color: colors.text }]}
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  placeholder="Routine name"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background, color: colors.text }]}
                  value={editFormData.description}
                  onChangeText={(text) => setEditFormData({ ...editFormData, description: text })}
                  placeholder="Routine description"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveEditedRoutine}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ✅ COMPLETE: All existing styles + new calendar styles + CREATE BUTTON STYLES
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
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
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
  // ✅ NEW: Create button styles
  createButtonContainer: {
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  weekTimer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  weekTimerText: {
    fontSize: 12,
    fontWeight: "500",
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
  },
  editButtonActive: {
    backgroundColor: "rgba(52, 199, 89, 0.1)",
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  routineItem: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  routineContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routineLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxCompleted: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  routineNameCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  routineDescription: {
    fontSize: 14,
    marginBottom: 2,
  },
  routineTarget: {
    fontSize: 12,
    fontStyle: "italic",
  },
  editModeButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editRoutineButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButton: {
    padding: 4,
  },
  dragHandle: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandleActive: {
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    borderRadius: 8,
  },
  dragIcon: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dragIconActive: {
    // Additional active styles if needed
  },
  dragLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
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
  // ✅ NEW: Calendar view styles
  calendarViewContainer: {
    flex: 1,
    padding: 20,
  },
  timeSlotsContainer: {
    flex: 1,
    paddingTop: 12,
  },
  timeSlot: {
    flexDirection: "row",
    borderBottomWidth: 1,
    minHeight: 60,
    paddingVertical: 8,
  },
  timeLabel: {
    width: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  timeLabelText: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeSlotContent: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
    minHeight: 44,
  },
  addRoutineToSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  addRoutineText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  // ✅ NEW: Calendar routine item styles
  calendarRoutineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  calendarRoutineLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
  // ✅ NEW: Create modal styles
  createOptionsContainer: {
    padding: 20,
  },
  createOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
    gap: 12,
  },
  createOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  customCreateSection: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
  },
  createSubmitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  createSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  preloadedRoutinesContainer: {
    padding: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  preloadedRoutineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  preloadedRoutineIcon: {
    fontSize: 24,
  },
  preloadedRoutineInfo: {
    flex: 1,
  },
  preloadedRoutineName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  preloadedRoutineDescription: {
    fontSize: 14,
  },
  deleteModalContent: {
    width: "85%",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  deleteModalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  confirmButton: {
    backgroundColor: "#ff4444",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  editForm: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default HomeScreen;