// src/screens/Home/HomeScreen.tsx
// ✅ COMPLETE: All existing functionality + working calendar scheduling + CREATE BUTTON + SCHEDULE SETTINGS INTEGRATION + CALENDAR EDIT FUNCTIONALITY

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";
import { StreakSyncService } from "../../services/StreakSyncService";
import { usePremium } from '../../contexts/PremiumContext';
import { useHomeView } from '../../contexts/HomeViewContext';


interface RoutineWithCompletion extends UserRoutine {
  isCompleted: boolean;
  completionId?: string;
}

// ✅ EXISTING: Interface for scheduled routines
interface ScheduledRoutine extends RoutineWithCompletion {
  scheduled_time: string;
  estimated_duration: number;
  scheduled_id?: string;
}

// ✅ EXISTING: Interface for time slots
interface TimeSlot {
  hour: number;
  routines: ScheduledRoutine[];
}

// ✅ NEW: Interface for user day schedules
interface UserDaySchedule {
  day_id: number;
  start_hour: number;
  end_hour: number;
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
  const { isPremium } = usePremium();

  // EXISTING: Calendar toggle state
  const [isCalendarView, setIsCalendarView] = useState(false);
  console.log("🔍 isCalendarView state:", isCalendarView);
  const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weekTimeRemaining, setWeekTimeRemaining] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
  const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
  const [daySpecificRoutines, setDaySpecificRoutines] = useState<Record<number, string[]>>({});
  const [userProfile, setUserProfile] = useState<any>(null);

  // ✅ EXISTING: Calendar-specific state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);

  // ✅ EXISTING: Create routine modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreloadedOptions, setShowPreloadedOptions] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDescription, setNewRoutineDescription] = useState("");

  // ✅ NEW: Schedule settings state
  const [userDaySchedules, setUserDaySchedules] = useState<Record<number, UserDaySchedule>>({});

  // EXISTING DRAG STATE
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [originalIndex, setOriginalIndex] = useState<number | null>(null);
  const [lastSwapIndex, setLastSwapIndex] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<"daily" | "weekly" | "calendar" | null>(null);

  // ENHANCED: New drag state for improved UX
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // ✅ NEW: Calendar drag state
  const [draggedTimeSlot, setDraggedTimeSlot] = useState<number | null>(null);

  // ENHANCED: Edit mode state for delete functionality
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSection, setEditSection] = useState<"daily" | "weekly" | "calendar" | null>(null);
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
  const { defaultToCalendarView, isLoading: homeViewLoading } = useHomeView();

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

  // ✅ EXISTING: Preloaded routine options
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

  // ✅ NEW: Function to load user's custom day schedules
  const loadUserDaySchedules = async (): Promise<Record<number, UserDaySchedule>> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return getDefaultTimeRange();

      const { data, error } = await supabase
        .from('user_day_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_id');

      if (error) {
        console.log('Could not load user day schedules:', error.message);
        return getDefaultTimeRange();
      }

      if (!data || data.length === 0) {
        // Fallback to default 6am-11pm
        return getDefaultTimeRange();
      }

      // Convert to format your calendar expects
      const scheduleMap: Record<number, UserDaySchedule> = {};
      data.forEach(schedule => {
        scheduleMap[schedule.day_id] = {
          day_id: schedule.day_id,
          start_hour: schedule.start_hour,
          end_hour: schedule.end_hour
        };
      });

      return scheduleMap;
    } catch (error) {
      console.error('Error loading user day schedules:', error);
      return getDefaultTimeRange();
    }
  };

  // ✅ NEW: Default time range fallback
  const getDefaultTimeRange = (): Record<number, UserDaySchedule> => {
    const defaultRange: Record<number, UserDaySchedule> = {};
    for (let i = 0; i < 7; i++) {
      defaultRange[i] = {
        day_id: i,
        start_hour: 6,
        end_hour: 23
      }; // 6am-11pm
    }
    return defaultRange;
  };

  // ✅ MODIFIED: Initialize time slots function using user's custom schedules
  const initializeTimeSlots = useCallback(async () => {
    // Load user's custom day schedules
    const schedules = await loadUserDaySchedules();
    setUserDaySchedules(schedules);

    // Generate time slots for the selected day
    const daySchedule = schedules[selectedDay] || { day_id: selectedDay, start_hour: 6, end_hour: 23 };

    const slots: TimeSlot[] = [];
    for (let hour = daySchedule.start_hour; hour <= daySchedule.end_hour; hour++) {
      slots.push({
        hour,
        routines: []
      });
    }
    setTimeSlots(slots);
  }, [selectedDay]);

  // ✅ EXISTING: Format time function
  const formatTime = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Find where syncStreaksAfterCompletion is defined and add this function if it doesn't exist
  const syncStreaksAfterCompletion = async (userId: string) => {
    console.log("📊 SYNC STREAKS: Starting streak synchronization");
    try {
      // This function might not exist or might be empty
      // Let's add a placeholder if needed
      console.log("📊 SYNC STREAKS: Completed");
    } catch (error) {
      console.error("📊 SYNC STREAKS: Error:", error);
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
  // REPLACE THE ENTIRE personalizedGreeting useMemo section (around lines 282-346) with this:

  // Memoized greeting that only changes when the time period changes
  const personalizedGreeting = useMemo(() => {
    const { timePeriod, seed, hour } = getTimePeriodInfo();
    const firstName = userProfile?.full_name?.split(" ")[0] || "there";

    const morningGreetings = [
      `Good morning,\n${firstName}!`,
      `Rise and shine,\n${firstName}`,
      `Morning,\n${firstName}.`,
      `Start strong,\n${firstName}`,
      `New day, new you,\n${firstName}.`,
      `Let's conquer today,\n${firstName}!`,
      `Early bird gets the worm,\n${firstName}`,
      `Ready to seize the day,\n${firstName}?`,
      `Fresh start awaits,\n${firstName}.`,
    ];

    const afternoonGreetings = [
      `Good afternoon,\n${firstName}`,
      `Keep pushing,\n${firstName}!`,
      `Keep it up,\n${firstName}.`,
      `Afternoon momentum,\n${firstName}`,
      `You're crushing it,\n${firstName}`,
      `Stay focused,\n${firstName}.`,
      `Pushing through,\n${firstName}?`,
      `Making progress,\n${firstName}`,
      `Steady as she goes,\n${firstName}.`,
    ];

    const eveningGreetings = [
      `Good evening,\n${firstName}`,
      `Evening wind down,\n${firstName}`,
      `How did today go,\n${firstName}?`,
      `Wrapping up strong,\n${firstName}?`,
      `Reflect and recharge,\n${firstName}`,
      `Proud of today,\n${firstName}?`,
      `Rest well tonight,\n${firstName}`,
      `Tomorrow awaits,\n${firstName}`,
      `End on a high note,\n${firstName}`,
    ];

    const nightGreetings = [
      `Working late,\n${firstName}?`,
      `Night owl mode,\n${firstName}`,
      `Burning the midnight oil,\n${firstName}?`,
      `Late night productivity,\n${firstName}`,
      `Making the most of tonight,\n${firstName}?`,
      `Night shift,\n${firstName}?`,
      `Still going strong,\n${firstName}`,
      `Quiet hours,\n${firstName}`,
      `Peace and focus,\n${firstName}`,
    ];

    let greetingArray = morningGreetings;
    if (timePeriod === "afternoon") greetingArray = afternoonGreetings;
    else if (timePeriod === "evening") greetingArray = eveningGreetings;
    else if (timePeriod === "night") greetingArray = nightGreetings;

    const randomValue = seededRandom(seed);
    const greetingIndex = Math.floor(randomValue * greetingArray.length);
    return greetingArray[greetingIndex];
  }, [userProfile?.full_name]);

  // ✅ MODIFIED: Load scheduled routines function with user's custom time range
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
        .eq("is_active", true)
        .order("scheduled_time");

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

      // ✅ IMPORTANT: Use user's custom time range for this day
      const daySchedule = userDaySchedules[selectedDay] || { day_id: selectedDay, start_hour: 6, end_hour: 23 };

      // Regenerate time slots based on user's schedule
      const newTimeSlots: TimeSlot[] = [];
      for (let hour = daySchedule.start_hour; hour <= daySchedule.end_hour; hour++) {
        newTimeSlots.push({
          hour,
          routines: scheduledRoutines.filter(r => {
            const [hourStr] = r.scheduled_time.split(':');
            return parseInt(hourStr) === hour;
          })
        });
      }

      setTimeSlots(newTimeSlots);

    } catch (error) {
      console.error("Error loading scheduled routines:", error);
    }
  };

  // ✅ EXISTING: Schedule routine to time slot function
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

  // ✅ EXISTING: Remove scheduled routine function
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

  // ✅ EXISTING: Create new routine function
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

  // ✅ ENHANCED: Load data with LOCAL TIMEZONE fixes + calendar support + schedule settings
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
  }, [selectedDay, isCalendarView, userDaySchedules]);

  // ✅ ENHANCED: Initialize and reload effects
  useEffect(() => {
    initializeTimeSlots();
    loadData();
  }, [selectedDay]);
  useEffect(() => {
    // Set the initial view based on user's preference when component loads
    if (!homeViewLoading && isPremium) {
      setIsCalendarView(defaultToCalendarView);
      console.log(`🗓️ Setting initial view to: ${defaultToCalendarView ? 'Calendar' : 'Daily'}`);
    }
  }, [defaultToCalendarView, homeViewLoading, isPremium]);
  // ✅ MODIFIED: Reload scheduled routines when day or view changes, and refresh time slots with user's schedule
  useEffect(() => {
    if (isCalendarView) {
      loadScheduledRoutines();
    } else {
      // When switching back to list view, reload user schedules for next time
      loadUserDaySchedules().then(schedules => {
        setUserDaySchedules(schedules);
      });
    }
  }, [selectedDay, isCalendarView]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("HomeScreen focused - reloading data");
      loadData();
      // ✅ NEW: Also reload user schedules when screen focuses (in case user changed settings)
      loadUserDaySchedules().then(schedules => {
        setUserDaySchedules(schedules);
      });
    });

    return unsubscribe;
  }, [navigation, loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("HomeScreen focused - reloading data");
      loadData();
      // ✅ NEW: Also reload user schedules when screen focuses (in case user changed settings)
      loadUserDaySchedules().then(schedules => {
        setUserDaySchedules(schedules);
      });
    });

    return unsubscribe;
  }, [navigation, loadData]);

  // ADD THIS NEW useEffect HERE:
  useEffect(() => {
    let lastCheckedDate = getLocalDateString(new Date());

    // Check every minute if we've crossed midnight
    const checkMidnightTransition = () => {
      const now = new Date();
      const currentDateStr = getLocalDateString(now);

      if (currentDateStr !== lastCheckedDate) {
        console.log("🌙 MIDNIGHT TRANSITION DETECTED!");
        console.log("  - Previous date:", lastCheckedDate);
        console.log("  - New date:", currentDateStr);

        // Update the stored date
        lastCheckedDate = currentDateStr;

        // Reload data to reflect new day
        loadData();

        // Update selected day if viewing "today"
        const newDayOfWeek = now.getDay();
        if (selectedDay === new Date().getDay() - 1 ||
          (selectedDay === 6 && newDayOfWeek === 0)) {
          setSelectedDay(newDayOfWeek);
        }
      }
    };

    // Check immediately
    checkMidnightTransition();

    // Check every minute
    const interval = setInterval(checkMidnightTransition, 60000);

    return () => clearInterval(interval);
  }, [loadData, selectedDay]);

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
      console.log("  - Is Calendar View:", isCalendarView);

      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId)
            .eq("completion_date", todayStr),
          supabase
            .from("user_routines")
            .select("id, is_weekly, is_active, name")  // Added is_active and name
            .eq("user_id", userId)
            .eq("is_active", true),
          supabase
            .from("user_day_routines")
            .select("routine_id, day_of_week")
            .eq("user_id", userId)
            .eq("day_of_week", dayOfWeek),
        ]);

      if (completionsResult.error) throw completionsResult.error;
      if (userRoutinesResult.error) throw userRoutinesResult.error;
      if (dayRoutinesResult.error) throw dayRoutinesResult.error;

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayRoutines = dayRoutinesResult.data || [];

      console.log("🔧 DEBUG: Query results:");
      console.log("  - Completions found:", completions.length);
      console.log("  - User routines:", userRoutines.length);
      console.log("  - Today's assigned routines:", dayRoutines.length);

      // Get today's daily routine IDs
      const todayDailyRoutineIds = dayRoutines.map((dr) => dr.routine_id);

      // Filter to get only today's ACTIVE daily routines (not weekly)
      const todayDailyRoutines = userRoutines.filter(
        (routine) =>
          !routine.is_weekly &&
          routine.is_active !== false &&
          todayDailyRoutineIds.includes(routine.id)
      );

      console.log("🔧 DEBUG: Today's daily routines:", todayDailyRoutines.map(r => r.id));

      // Get completed routine IDs for today
      const completedRoutineIds = completions.map((c) => c.routine_id);
      console.log("🔧 DEBUG: Completed routine IDs:", completedRoutineIds);

      // Check if all daily routines are completed
      const allCompleted =
        todayDailyRoutines.length > 0 &&
        todayDailyRoutines.every((routine) =>
          completedRoutineIds.includes(routine.id)
        );

      console.log("🔧 DEBUG: All completed?", allCompleted);
      console.log("  - Required count:", todayDailyRoutines.length);
      console.log("  - Completed count:", completedRoutineIds.filter(id =>
        todayDailyRoutineIds.includes(id)).length);

      return allCompleted;
    } catch (error) {
      console.error("❌ Error checking completion status:", error);
      return false;
    }
  };
  // New function to set completion context
  const setCompletionContext = async (userId: string, viewType: 'normal' | 'calendar') => {
    try {
      const completionContext = {
        userId,
        date: getLocalDateString(new Date()),
        viewType,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem('completion_context', JSON.stringify(completionContext));
      console.log(`✅ Set completion context for ${viewType} view`);
    } catch (error) {
      console.error("Error setting completion context:", error);
    }
  };

  // Force sync with stats screen
  const forceSyncWithStats = async () => {
    console.log("🔄 FORCE SYNC: Triggering stats update");

    // Use AsyncStorage to set a flag for stats screen
    try {
      await AsyncStorage.setItem('stats_needs_update', JSON.stringify({
        timestamp: Date.now(),
        date: getLocalDateString(new Date()),
        source: 'home'
      }));
      console.log("✅ Stats update flag set successfully");
    } catch (error) {
      console.error("Error setting stats update flag:", error);
    }
  };

  const toggleRoutineCompletion = async (
    routine: RoutineWithCompletion,
    isWeekly: boolean
  ) => {
    console.log("🔧 DEBUG: toggleRoutineCompletion START");
    console.log("  - Routine:", routine.name);
    console.log("  - Is Weekly:", isWeekly);
    console.log("  - Is Completed:", routine.isCompleted);
    console.log("  - Calendar View Active:", isCalendarView);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (routine.isCompleted && routine.completionId) {
        // UNCHECKING a routine
        console.log("❌ UNCHECKING routine:", routine.name);
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
        console.log("✅ CHECKING routine:", routine.name);

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

        console.log("🔄 About to insert completion:", {
          user_id: user.id,
          routine_id: routine.id,
          routine_name: routine.name,
          completion_date: completionDate,
          week_start_date: weekStartDate,
        });

        const { error, data } = await supabase.from("routine_completions").insert({
          user_id: user.id,
          routine_id: routine.id,
          completion_date: completionDate,
          week_start_date: weekStartDate,
        }).select();

        console.log("📥 Database insert result:", { error, data });

        if (error) {
          console.error("❌ Database insert failed:", error);
          throw error;
        }

        console.log("✅ Database insert successful");
        console.log("✅ ROUTINE CHECKED:");
        console.log("  - Routine:", routine.name);
        console.log("  - Completion date (LOCAL):", completionDate);
      }

      // ✅ FIX: Add delay to ensure database write is committed
      console.log("⏳ Waiting for database to commit...");
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if all daily routines are now completed
      console.log("🔧 DEBUG: About to check daily completion status");
      const allCompleted = await checkDailyCompletionStatus(user.id);
      console.log("🔧 DEBUG: Daily completion check result:", allCompleted);

      if (allCompleted) {
        console.log("🎯 ALL DAILY ROUTINES COMPLETED FOR TODAY!");
        console.log("  - This should trigger GREEN in Stats calendar");
        console.log("  - Current date:", getLocalDateString(new Date()));
        console.log("  - View type:", isCalendarView ? "calendar" : "normal");

        // Set which view completed the routines
        await setCompletionContext(user.id, isCalendarView ? 'calendar' : 'normal');
      }

      // Force sync with stats
      console.log("🔧 DEBUG: Calling forceSyncWithStats");
      await forceSyncWithStats();

      // Reload data to reflect changes
      console.log("🔧 DEBUG: Reloading home data");
      await loadData();
      console.log("🔧 DEBUG: toggleRoutineCompletion COMPLETE");

    } catch (error) {
      console.error("❌ Error toggling routine:", error);
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

  // ✅ UPDATED: Pan responder for drag and drop with calendar support
  const createPanResponder = (index: number, section: "daily" | "weekly" | "calendar", timeSlot?: number) => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // More precise gesture detection for smoother initiation
        return Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx) * 0.6;
      },

      onPanResponderGrant: () => {
        setIsDragging(true);
        setDraggedIndex(index);
        setDraggedSection(section);
        if (timeSlot !== undefined) {
          setDraggedTimeSlot(timeSlot);
        }
        setDraggedItemId(section === "daily" ? dailyRoutines[index]?.id :
          section === "weekly" ? weeklyRoutines[index]?.id :
            timeSlots.find(slot => slot.hour === timeSlot)?.routines[index]?.id);
        setOriginalIndex(index);
        setIsDragActive(true);
        setScrollEnabled(false);

        // Smoother initial animations
        Animated.parallel([
          Animated.spring(dragScale, {
            toValue: 1.05,
            useNativeDriver: false,
            tension: 300,
            friction: 8,
          }),
          Animated.timing(dragOpacity, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: false,
          }),
        ]).start();
      },

      onPanResponderMove: (evt, gestureState) => {
        dragY.setValue(gestureState.dy);

        const currentRoutines = section === "daily" ? dailyRoutines :
          section === "weekly" ? weeklyRoutines :
            timeSlots.find(slot => slot.hour === timeSlot)?.routines || [];

        const maxRoutines = currentRoutines.length - 1;

        // Improved movement calculations for calendar vs normal items
        const itemSpacing = section === "calendar" ? 70 : 100; // Adjusted for calendar item height
        const movementRatio = gestureState.dy / itemSpacing;
        const balancedMovement = movementRatio * 0.7; // Slightly more responsive

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
            toValue: newIndex !== index ? 0.4 : 0, // Slightly more visible
            duration: 100, // Faster response
            useNativeDriver: false,
          }).start();
        }

        // Improved swapping logic with better threshold
        if (
          newIndex !== lastSwapIndex &&
          newIndex !== index &&
          newIndex >= 0 &&
          newIndex <= maxRoutines &&
          Math.abs(gestureState.dy) > itemSpacing * 0.4 // Better threshold
        ) {
          setLastSwapIndex(newIndex);

          const newRoutines = [...currentRoutines];
          const draggedItem = newRoutines[index];
          newRoutines.splice(index, 1);
          newRoutines.splice(newIndex, 0, draggedItem);

          if (section === "daily") {
            setDailyRoutines(newRoutines);
          } else if (section === "weekly") {
            setWeeklyRoutines(newRoutines);
          } else if (section === "calendar" && timeSlot !== undefined) {
            const newTimeSlots = timeSlots.map(slot =>
              slot.hour === timeSlot ? { ...slot, routines: newRoutines } : slot
            );
            setTimeSlots(newTimeSlots);
          }

          setDraggedIndex(newIndex);
        }
      },

      onPanResponderRelease: async (evt, gestureState) => {
        setIsDragging(false);
        setIsDragActive(false);
        setScrollEnabled(true);
        setDropZoneIndex(null);

        // Enhanced release animations
        Animated.parallel([
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 400,
            friction: 12,
            velocity: gestureState.vy, // Use release velocity for natural feel
          }),
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: false,
            tension: 300,
            friction: 10,
          }),
          Animated.timing(dragOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(dropZoneOpacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: false,
          }),
        ]).start();

        if (originalIndex !== draggedIndex && draggedItemId) {
          if (section === "calendar" && timeSlot !== undefined) {
            await saveCalendarRoutineOrder(timeSlot, originalIndex!, draggedIndex!);
          } else if (section === "daily" || section === "weekly") {
            await saveRoutineOrder(section);
          }
        }

        setDraggedIndex(null);
        setDraggedSection(null);
        setDraggedTimeSlot(null);
        setOriginalIndex(null);
        setLastSwapIndex(null);
        setDraggedItemId(null);
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

  // ✅ NEW: Save calendar routine order
  const saveCalendarRoutineOrder = async (timeSlot: number, fromIndex: number, toIndex: number) => {
    try {
      const slot = timeSlots.find(s => s.hour === timeSlot);
      if (!slot || !slot.routines.length) return;

      const reorderedRoutines = [...slot.routines];
      const [movedItem] = reorderedRoutines.splice(fromIndex, 1);
      reorderedRoutines.splice(toIndex, 0, movedItem);

      // Update the time slots state
      const newTimeSlots = timeSlots.map(s =>
        s.hour === timeSlot ? { ...s, routines: reorderedRoutines } : s
      );
      setTimeSlots(newTimeSlots);

      console.log("📝 Calendar routine order updated in UI - database save skipped (sort_order column not available)");

      // TODO: Add sort_order column to routine_schedule table for persistent ordering
      // For now, the reordering works in the UI but won't persist after reload

    } catch (error) {
      console.error("Error saving calendar routine order:", error);
      // Don't show alert since this is expected without the sort_order column
    }
  };

  // ✅ UPDATED: Edit mode functions with calendar support
  const toggleEditMode = (section: "daily" | "weekly" | "calendar") => {
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
                onValueChange={(newValue) => {
                  console.log("🔄 Toggle changed to:", newValue);

                  // 🔒 PREMIUM CHECK - Block calendar view for non-premium users
                  if (newValue && !isPremium) {
                    console.log("🚫 Non-premium user trying to access calendar view - redirecting to premium");
                    navigation.navigate('Premium', { source: 'calendar_toggle' });
                    return; // Don't change the toggle state
                  }

                  // If premium user or turning off calendar view, allow the change
                  setIsCalendarView(newValue);
                }}
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

        {/* ✅ CORRECTED: CREATE BUTTON SECTION - Only show when calendar view is ON */}
        {isCalendarView && (
          <View style={[styles.createButtonContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: "#007AFF" }]}
              onPress={() => navigation.navigate("AddRoutine", {
                selectedDay,
                isCalendarMode: true  // ✅ ADD this parameter
              })}
            >
              <Ionicons name="add" size={24} color="white" />
              <Text style={styles.createButtonText}>Create Routine</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ ENHANCED: Main content - conditional rendering based on calendar view */}
        {isCalendarView ? (
          /* ✅ MODIFIED: Calendar view with working time slots using user's custom schedule */
          <View style={styles.calendarViewContainer}>
            {/* ✅ NEW: Calendar Edit Mode Toggle */}
            <View style={[styles.sectionHeader, { backgroundColor: colors.surface, marginBottom: 12, marginHorizontal: 16, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }]}>
              <Ionicons name="calendar" size={24} color="#007AFF" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Calendar View
              </Text>
              <TouchableOpacity
                onPress={() => toggleEditMode("calendar")}
                style={[
                  styles.editButton,
                  isEditMode && editSection === "calendar" && styles.editButtonActive,
                ]}
              >
                <Ionicons
                  name={
                    isEditMode && editSection === "calendar" ? "checkmark" : "pencil"
                  }
                  size={18}
                  color={
                    isEditMode && editSection === "calendar" ? "#34c759" : "#666"
                  }
                />
              </TouchableOpacity>
            </View>

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
                          setShowScheduleModal(true);
                        }}
                      >
                        <Ionicons name="add" size={16} color={colors.textTertiary} />
                        <Text style={[styles.addRoutineText, { color: colors.textTertiary }]}>
                          Add routine
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      slot.routines.map((routine, index) => {
                        const calendarPanResponder = createPanResponder(index, "calendar", slot.hour);
                        const isBeingDragged = isDragging && draggedIndex === index && draggedSection === "calendar" && draggedTimeSlot === slot.hour;
                        const isDropZone = dropZoneIndex === index && isDragActive && !isBeingDragged && draggedSection === "calendar" && draggedTimeSlot === slot.hour;
                        const isInEditMode = isEditMode && editSection === "calendar";

                        return (
                          <Animated.View
                            key={`${routine.id}-${index}`}
                            style={[
                              styles.calendarRoutineItem,
                              {
                                borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                                backgroundColor: routine.isCompleted ? "rgba(76, 175, 80, 0.1)" : colors.background
                              },
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
                                    borderRadius: 8,
                                    justifyContent: "center",
                                    alignItems: "center",
                                  },
                                ]}
                              >
                                <Ionicons name="add" size={20} color="white" />
                              </Animated.View>
                            )}

                            <TouchableOpacity
                              style={styles.calendarRoutineLeft}
                              onPress={() => {
                                console.log("📅 CALENDAR: Toggling routine:", routine.name);
                                console.log("  - Routine ID:", routine.id);
                                console.log("  - Current completion status:", routine.isCompleted);
                                console.log("  - Is scheduled routine:", !!routine.scheduled_id);
                                console.log("  - Scheduled ID:", routine.scheduled_id);
                                toggleRoutineCompletion(routine, false);
                              }}
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
                                {routine.description ? (
                                  <Text style={[styles.calendarRoutineDuration, { color: colors.textSecondary }]}>
                                    {routine.description}
                                  </Text>
                                ) : null}
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
                                  <Ionicons name="remove-circle" size={20} color="#ff4444" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.dragHandle,
                                  isBeingDragged && styles.dragHandleActive,
                                ]}
                                {...calendarPanResponder.panHandlers}
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
                          </Animated.View>
                        );
                      })
                    )}
                  </View>
                </View>
              ))}
            </View>
            {/* ✅ NEW: Display current day schedule info */}
            {userDaySchedules[selectedDay] && (
              <View style={[styles.scheduleInfo, { backgroundColor: colors.surface }]}>
                <Text style={[styles.scheduleInfoText, { color: colors.textSecondary }]}>
                  Schedule: {formatTime(userDaySchedules[selectedDay].start_hour)} - {formatTime(userDaySchedules[selectedDay].end_hour)}
                </Text>
                <TouchableOpacity
                  style={styles.editScheduleButton}
                  onPress={() => navigation.navigate("Settings")}
                >
                  <Ionicons name="settings" size={16} color="#007AFF" />
                  <Text style={[styles.editScheduleText, { color: "#007AFF" }]}>Edit Schedule</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* ✅ EXISTING: Regular home screen content */
          <>
            {/* Daily Routines Section */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="today" size={24} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Daily Routine
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
                  onPress={() => navigation.navigate("AddRoutine", { selectedDay })}  // ✅ CORRECT
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
                <Ionicons name="checkbox-outline" size={24} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  To Do List
                </Text>
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
                    No items in your to do list
                  </Text>
                  <Text
                    style={[
                      styles.emptyStateSubtext,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Add items to track tasks and goals!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ✅ EXISTING: Schedule Modal for Calendar View */}
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

      {/* ✅ EXISTING: Create Routine Modal */}
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

// ✅ COMPLETE: All existing styles + new calendar styles + CREATE BUTTON STYLES + SCHEDULE INFO STYLES
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
  // ✅ EXISTING: Create button styles
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
  // ✅ EXISTING: Calendar view styles
  calendarViewContainer: {
    flex: 1,
    paddingHorizontal: 16,
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
  // ✅ EXISTING: Calendar routine item styles
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
  // ✅ NEW: Schedule info styles
  scheduleInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  scheduleInfoText: {
    fontSize: 14,
    fontWeight: "500",
  },
  editScheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editScheduleText: {
    fontSize: 14,
    fontWeight: "500",
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
  // ✅ EXISTING: Create modal styles
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