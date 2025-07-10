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
  Dimensions, // ENHANCED: Added for better calculations
  TextInput, // ENHANCED: Added for edit functionality
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";

interface RoutineWithCompletion extends UserRoutine {
  isCompleted: boolean;
  completionId?: string;
}

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();

  const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>(
    []
  );
  const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>(
    []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [weekTimeRemaining, setWeekTimeRemaining] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
  const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
  const [daySpecificRoutines, setDaySpecificRoutines] = useState<
    Record<number, string[]>
  >({});
  const [userProfile, setUserProfile] = useState<any>(null);

  // EXISTING DRAG STATE
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [originalIndex, setOriginalIndex] = useState<number | null>(null);
  const [lastSwapIndex, setLastSwapIndex] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<
    "daily" | "weekly" | null
  >(null);

  // ENHANCED: New drag state for improved UX
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // ENHANCED: Edit mode state for delete functionality
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSection, setEditSection] = useState<"daily" | "weekly" | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<{
    routine: RoutineWithCompletion;
    section: "daily" | "weekly";
  } | null>(null);

  // ENHANCED: Edit routine modal state
  const [showEditRoutineModal, setShowEditRoutineModal] = useState(false);
  const [routineToEdit, setRoutineToEdit] =
    useState<RoutineWithCompletion | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
  });

  // ENHANCED: Animated values for smooth interactions
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current; // Scale animation for dragged item
  const dragOpacity = useRef(new Animated.Value(1)).current; // Opacity for drag effect
  const dropZoneOpacity = useRef(new Animated.Value(0)).current; // Drop zone indicator

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

  // Create a function to get time period and generate seed for consistent randomness
  const getTimePeriodInfo = () => {
    const now = new Date();
    const hour = now.getHours();
    const dateString = now.toISOString().split("T")[0];

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

  // Load all user routines and day assignments
  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile(profileData);

      // Calculate week start (Monday)
      const now = new Date();
      const currentDay = now.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      // Get today's date string
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

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
          .gte("week_start_date", weekStart.toISOString().split("T")[0])
          .lt(
            "week_start_date",
            new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
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

  // Function to check if all daily routines are completed
  const checkDailyCompletionStatus = async (userId: string) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

      console.log("🔍 CHECKING DAILY COMPLETION STATUS:");
      console.log("  - Date:", todayStr);
      console.log("  - Day of week:", dayOfWeek);

      // Get all the data we need to check completion
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

      // Get daily routines for today
      const todayDailyRoutineIds = todayRoutineAssignments.map(
        (a) => a.routine_id
      );
      const todayDailyRoutines = userRoutines.filter(
        (routine) =>
          !routine.is_weekly && todayDailyRoutineIds.includes(routine.id)
      );

      // Get completed routine IDs for today
      const completedRoutineIds = todayCompletions.map((c) => c.routine_id);

      // Check if ALL daily routines are completed
      const allCompleted =
        todayDailyRoutines.length > 0 &&
        todayDailyRoutines.every((routine) =>
          completedRoutineIds.includes(routine.id)
        );

      console.log("📋 COMPLETION CHECK RESULTS:");
      console.log(
        "  - Required routines today:",
        todayDailyRoutines.map((r) => r.name)
      );
      console.log("  - Completed routine IDs:", completedRoutineIds);
      console.log("  - All daily routines completed:", allCompleted);

      if (allCompleted) {
        console.log("🎉 ALL DAILY ROUTINES COMPLETED!");
        console.log("  - Stats calendar should show GREEN for today");
        console.log("  - Date:", todayStr);
      } else {
        const missing = todayDailyRoutines.filter(
          (r) => !completedRoutineIds.includes(r.id)
        );
        console.log(
          "⏳ Still need to complete:",
          missing.map((r) => r.name)
        );
      }

      return allCompleted;
    } catch (error) {
      console.error("Error checking completion status:", error);
      return false;
    }
  };

  // ENHANCED toggleRoutineCompletion function with real-time completion checking
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
        // CRITICAL FIX: Always use today's date for completion, regardless of selectedDay
        const today = new Date();
        const completionDate = today.toISOString().split("T")[0];

        // Original logic preserved for weekly routine week calculation
        let weekStartDate = null;
        if (isWeekly) {
          const now = new Date();
          const currentDay = now.getDay();
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - daysFromMonday);
          weekStart.setHours(0, 0, 0, 0);
          weekStartDate = weekStart.toISOString().split("T")[0];
        }

        const { error } = await supabase.from("routine_completions").insert({
          user_id: user.id,
          routine_id: routine.id,
          completion_date: completionDate, // Always today's date
          week_start_date: weekStartDate,
        });

        if (error) throw error;

        console.log("✅ ROUTINE CHECKED:");
        console.log("  - Routine:", routine.name);
        console.log("  - Completion date:", completionDate);
        console.log("  - Today's date:", completionDate);
        console.log("  - Selected day in UI:", selectedDay);
        console.log(
          "  - Is for TODAY:",
          completionDate === today.toISOString().split("T")[0]
        );
      }

      // NEW: After any completion change, check if all daily routines are complete
      await checkDailyCompletionStatus(user.id);

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

  // ENHANCED: Pan responder for drag and drop with improved UX
  const createPanResponder = (index: number, section: "daily" | "weekly") => {
    return PanResponder.create({
      // FIXED: Immediate drag response - capture touch from start
      onStartShouldSetPanResponder: (evt, gestureState) => {
        return false; // Don't capture immediately, let onMove handle it
      },

      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // FIXED: Lower threshold for immediate response
        return Math.abs(dy) > 3 && Math.abs(dy) > Math.abs(dx) * 0.5;
      },

      onPanResponderGrant: () => {
        console.log("🎯 DRAG STARTED:", { index, section });

        // REMOVED: All haptic feedback/vibration

        // Set drag state
        setIsDragging(true);
        setDraggedIndex(index);
        setDraggedSection(section);
        setOriginalIndex(index);
        setIsDragActive(true);
        setScrollEnabled(false);

        // ENHANCED: Animated feedback on drag start
        Animated.parallel([
          Animated.spring(dragScale, {
            toValue: 1.05, // Slightly scale up the dragged item
            useNativeDriver: false,
            tension: 200,
            friction: 8,
          }),
          Animated.timing(dragOpacity, {
            toValue: 0.9, // Slightly transparent to show it's being dragged
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
      },

      onPanResponderMove: (evt, gestureState) => {
        // FIXED: More precise finger tracking - use raw gesture movement
        dragY.setValue(gestureState.dy);

        const routines = section === "daily" ? dailyRoutines : weeklyRoutines;

        // FIXED: Constrain movement within the current section
        // Don't allow dragging beyond the section boundaries
        const maxRoutines = routines.length - 1;

        // FIXED: Balanced movement calculation - not too fast, not too slow
        const itemSpacing = 100; // Balanced spacing value

        // FIXED: Medium responsiveness - balanced between 0.5 (too slow) and 0.85 (too fast)
        const movementRatio = gestureState.dy / itemSpacing;
        const balancedMovement = movementRatio * 0.68; // Sweet spot between responsiveness and control

        // FIXED: Strictly constrain to current section boundaries
        const newIndex = Math.max(
          0,
          Math.min(
            maxRoutines, // Use section-specific max
            Math.round(index + balancedMovement)
          )
        );

        // ENHANCED: Show drop zone indicator ONLY within the same section
        if (
          newIndex !== dropZoneIndex &&
          newIndex >= 0 &&
          newIndex <= maxRoutines
        ) {
          setDropZoneIndex(newIndex);

          // Animate drop zone indicator
          Animated.timing(dropZoneOpacity, {
            toValue: newIndex !== index ? 0.3 : 0,
            duration: 150,
            useNativeDriver: false,
          }).start();
        }

        // Perform reordering only when crossing significant boundaries WITHIN the same section
        if (
          newIndex !== lastSwapIndex &&
          newIndex !== index &&
          newIndex >= 0 &&
          newIndex <= maxRoutines
        ) {
          console.log("🔄 REORDERING within", section, ":", {
            from: index,
            to: newIndex,
            fingerMovement: gestureState.dy,
          });

          // REMOVED: Haptic feedback during reordering

          setLastSwapIndex(newIndex);

          const newRoutines = [...routines];
          const draggedItem = newRoutines[index];
          newRoutines.splice(index, 1);
          newRoutines.splice(newIndex, 0, draggedItem);

          // FIXED: Only update the correct section
          if (section === "daily") {
            setDailyRoutines(newRoutines);
          } else {
            setWeeklyRoutines(newRoutines);
          }

          setDraggedIndex(newIndex);
        }
      },

      onPanResponderRelease: async (evt, gestureState) => {
        console.log("🎯 DRAG ENDED:", {
          originalIndex,
          finalIndex: draggedIndex,
          changed: originalIndex !== draggedIndex,
        });

        // REMOVED: All haptic feedback on drop

        // Reset drag state
        setIsDragging(false);
        setIsDragActive(false);
        setScrollEnabled(true);
        setDropZoneIndex(null);

        // ENHANCED: Smooth animation back to normal state
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
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start();

        // Save to database if order changed
        if (originalIndex !== draggedIndex) {
          await saveRoutineOrder(section);
        }

        // Reset all drag state
        setDraggedIndex(null);
        setDraggedSection(null);
        setOriginalIndex(null);
        setLastSwapIndex(null);
      },
    });
  };

  // ENHANCED: Toggle edit mode for specific section
  const toggleEditMode = (section: "daily" | "weekly") => {
    if (isEditMode && editSection === section) {
      // Exit edit mode
      setIsEditMode(false);
      setEditSection(null);
    } else {
      // Enter edit mode for this section
      setIsEditMode(true);
      setEditSection(section);
    }
  };

  // ENHANCED: Handle delete routine
  const handleDeleteRoutine = (
    routine: RoutineWithCompletion,
    section: "daily" | "weekly"
  ) => {
    setRoutineToDelete({ routine, section });
    setShowDeleteConfirm(true);
  };

  // ENHANCED: Confirm delete routine
  const confirmDeleteRoutine = async () => {
    if (!routineToDelete) return;

    try {
      const { routine, section } = routineToDelete;

      // Delete from database
      const { error } = await supabase
        .from("user_routines")
        .update({ is_active: false }) // Soft delete by setting is_active to false
        .eq("id", routine.id);

      if (error) throw error;

      // If it's a daily routine, also remove day assignments
      if (section === "daily") {
        const { error: dayError } = await supabase
          .from("user_day_routines")
          .delete()
          .eq("routine_id", routine.id);

        if (dayError) throw dayError;
      }

      // Refresh data to reflect changes
      await loadData();

      // Reset state
      setShowDeleteConfirm(false);
      setRoutineToDelete(null);

      console.log("✅ ROUTINE DELETED:", routine.name);
    } catch (error) {
      console.error("Error deleting routine:", error);
      Alert.alert("Error", "Failed to delete routine");
    }
  };

  // ENHANCED: Handle edit routine
  const handleEditRoutine = (routine: RoutineWithCompletion) => {
    console.log("🔧 EDIT ROUTINE CLICKED:", routine.name); // Debug log
    setRoutineToEdit(routine);
    setEditFormData({
      name: routine.name,
      description: routine.description || "",
    });
    setShowEditRoutineModal(true);
    console.log("📝 EDIT MODAL SHOULD SHOW:", true); // Debug log
  };

  // ENHANCED: Save edited routine
  const saveEditedRoutine = async () => {
    if (!routineToEdit || !editFormData.name.trim()) {
      Alert.alert("Error", "Routine name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_routines")
        .update({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || null,
        })
        .eq("id", routineToEdit.id);

      if (error) throw error;

      // Refresh data to reflect changes
      await loadData();

      // Reset state
      setShowEditRoutineModal(false);
      setRoutineToEdit(null);
      setEditFormData({ name: "", description: "" });

      console.log("✅ ROUTINE UPDATED:", editFormData.name);
    } catch (error) {
      console.error("Error updating routine:", error);
      Alert.alert("Error", "Failed to update routine");
    }
  };

  // ENHANCED: Cancel edit routine
  const cancelEditRoutine = () => {
    setShowEditRoutineModal(false);
    setRoutineToEdit(null);
    setEditFormData({ name: "", description: "" });
  };
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoutineToDelete(null);
  };
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

      console.log(
        "💾 SAVED ORDER:",
        section,
        updates.map((u) => u.sort_order)
      );
    } catch (error) {
      console.error("Error saving routine order:", error);
      Alert.alert("Error", "Failed to save routine order");
    }
  };

  const renderRoutineItem = (
    routine: RoutineWithCompletion,
    index: number,
    section: "daily" | "weekly"
  ) => {
    const panResponder = createPanResponder(index, section);
    const isBeingDragged =
      isDragging && draggedIndex === index && draggedSection === section;

    // FIXED: Only show drop zone if we're dragging within the same section
    const isDropZone =
      dropZoneIndex === index &&
      isDragActive &&
      !isBeingDragged &&
      draggedSection === section; // Key fix: only same section

    // ENHANCED: Check if this section is in edit mode
    const isInEditMode = isEditMode && editSection === section;

    return (
      <Animated.View
        key={routine.id}
        style={[
          styles.routineItem,
          // ENHANCED: Better visual feedback for dragged items
          isBeingDragged && {
            transform: [
              { translateY: dragY },
              { scale: dragScale }, // Add scale animation
            ],
            opacity: dragOpacity, // Add opacity animation
            elevation: 12, // Higher elevation for more dramatic shadow
            shadowColor: "#007AFF", // Colored shadow for better visibility
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            zIndex: 1000, // Ensure it's on top
          },
          // ENHANCED: Drop zone indicator
          isDropZone && {
            backgroundColor: colors.surface,
            borderColor: "#007AFF",
            borderWidth: 2,
            borderStyle: "dashed",
            opacity: 0.7,
          },
        ]}
      >
        {/* ENHANCED: Drop zone indicator overlay */}
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
              backgroundColor: colors.card,
              borderColor: colors.border,
              // ENHANCED: Better visual state for dragged items
              ...(isBeingDragged && {
                backgroundColor: colors.surface,
                borderColor: "#007AFF",
                borderWidth: 2,
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.routineLeft}
            onPress={() =>
              toggleRoutineCompletion(routine, section === "weekly")
            }
            activeOpacity={routine.isCompleted ? 1 : 0.7}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: routine.isCompleted
                    ? "#007AFF"
                    : colors.textSecondary,
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
                <Text style={styles.routineTarget}>
                  Target: {routine.target_value} {routine.target_unit}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {/* ENHANCED: Edit mode - show edit and delete buttons, Normal mode - show drag handle */}
          {isInEditMode ? (
            <View style={styles.editModeButtons}>
              {/* ENHANCED: Edit routine button */}
              <TouchableOpacity
                style={styles.editRoutineButton}
                onPress={() => handleEditRoutine(routine)}
              >
                <Ionicons name="create-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              {/* Delete routine button */}
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {personalizedGreeting}
          </Text>
          <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        <View
          style={[
            styles.calendarContainer,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.calendarGrid}>
            {daysOfWeek.map((day) => {
              const isToday = day.value === new Date().getDay();
              const isSelected = day.value === selectedDay;
              const hasRoutines =
                (daySpecificRoutines[day.value] || []).length > 0;

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
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={24} color="#007AFF" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Daily Routines
            </Text>
            {/* ENHANCED: Edit button for daily routines */}
            <TouchableOpacity
              onPress={() => toggleEditMode("daily")}
              style={[
                styles.editButton,
                isEditMode &&
                  editSection === "daily" &&
                  styles.editButtonActive,
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
              onPress={() =>
                navigation.navigate("AddRoutine", {
                  selectedDay,
                  isWeekly: false,
                })
              }
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

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color="#ffd700" />
            <View style={styles.titleAndTimer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Weekly Goals
              </Text>
              {/* FIXED: Timer directly next to Weekly Goals title */}
              <View
                style={[styles.weekTimer, { backgroundColor: colors.card }]}
              >
                <Ionicons name="time" size={12} color="#007AFF" />
                <Text
                  style={[
                    styles.weekTimerText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {weekTimeRemaining}
                </Text>
              </View>
            </View>
            {/* ENHANCED: Edit button for weekly goals */}
            <TouchableOpacity
              onPress={() => toggleEditMode("weekly")}
              style={[
                styles.editButton,
                isEditMode &&
                  editSection === "weekly" &&
                  styles.editButtonActive,
              ]}
            >
              <Ionicons
                name={
                  isEditMode && editSection === "weekly"
                    ? "checkmark"
                    : "pencil"
                }
                size={18}
                color={
                  isEditMode && editSection === "weekly" ? "#34c759" : "#666"
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("AddRoutine", { isWeekly: true })
              }
              style={styles.addButton}
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
                No weekly routines set up yet
              </Text>
              <Text
                style={[
                  styles.emptyStateSubtext,
                  { color: colors.textTertiary },
                ]}
              >
                Add weekly goals to track longer-term habits!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ENHANCED: Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.deleteModalOverlay}>
          <View
            style={[
              styles.deleteModalContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
              Delete Routine
            </Text>
            <Text
              style={[
                styles.deleteModalMessage,
                { color: colors.textSecondary },
              ]}
            >
              Are you sure you want to delete "{routineToDelete?.routine.name}"?
              This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={confirmDeleteRoutine}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Day Routine Assignment Modal */}
      <Modal
        visible={showDayRoutineModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Routines for{" "}
              {daysOfWeek.find((d) => d.value === selectedDay)?.name}
            </Text>
            <TouchableOpacity onPress={() => setShowDayRoutineModal(false)}>
              <Text style={[styles.modalCancelButton, { color: "#007AFF" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {availableRoutines.map((routine) => {
              const isAssigned = (
                daySpecificRoutines[selectedDay] || []
              ).includes(routine.id);
              return (
                <TouchableOpacity
                  key={routine.id}
                  style={[
                    styles.availableRoutineItem,
                    {
                      backgroundColor: colors.card,
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    isAssigned
                      ? removeRoutineFromDay(routine.id)
                      : addRoutineToDay(routine.id)
                  }
                >
                  <View style={styles.routineIcon}>
                    <Ionicons
                      name={(routine.icon as any) || "checkmark-circle"}
                      size={24}
                      color="#007AFF"
                    />
                  </View>
                  <View style={styles.routineInfo}>
                    <Text style={[styles.routineName, { color: colors.text }]}>
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
                  </View>
                  <Ionicons
                    name={isAssigned ? "checkmark-circle" : "add-circle"}
                    size={24}
                    color={isAssigned ? "#34c759" : "#007AFF"}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
  },
  section: {
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  weekTimer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  weekTimerText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  routineItem: {
    marginBottom: 12,
  },
  routineContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    fontWeight: "500",
  },
  routineNameCompleted: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  routineDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  routineTarget: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 2,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  calendarContainer: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  calendarGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    marginHorizontal: 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 65,
    justifyContent: "center",
  },
  dayBoxToday: {
    backgroundColor: "#e6f3ff",
    borderColor: "#007AFF",
  },
  dayBoxSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayBoxName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  dayBoxNameToday: {
    color: "#007AFF",
    fontWeight: "700",
  },
  dayBoxNameSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayBoxIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayBoxIndicatorActive: {
    backgroundColor: "#34c759",
  },
  // ENHANCED: Edit button styles
  editButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: "rgba(102, 102, 102, 0.1)",
  },
  editButtonActive: {
    backgroundColor: "rgba(52, 199, 89, 0.1)",
  },
  // ENHANCED: Title and timer container for proper positioning
  titleAndTimer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  // ENHANCED: Edit mode buttons container
  editModeButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // ENHANCED: Edit routine button styles
  editRoutineButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
  },
  // ENHANCED: Delete button styles
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // ENHANCED: Edit modal styles
  editModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    position: "relative",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 60, // Space for character count
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  charCount: {
    position: "absolute",
    bottom: 12,
    right: 16,
    fontSize: 12,
  },
  // ENHANCED: Delete modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  deleteModalContent: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  deleteModalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(102, 102, 102, 0.1)",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    backgroundColor: "#ff4444",
  },
  confirmDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // ENHANCED: Improved drag handle styles
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 44, // Larger touch target
    minHeight: 44, // Larger touch target
    borderRadius: 8, // Rounded corners
  },
  // ENHANCED: Active drag handle state
  dragHandleActive: {
    backgroundColor: "rgba(0, 122, 255, 0.1)", // Light blue background when active
  },
  dragIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  // ENHANCED: Active drag icon state
  dragIconActive: {
    transform: [{ scale: 1.1 }], // Slightly larger when active
  },
  dragLine: {
    width: 20, // Slightly wider for better visibility
    height: 3, // Slightly thicker
    marginVertical: 1.5, // Better spacing
    borderRadius: 1.5, // Rounded edges
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalCancelButton: {
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  availableRoutineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  routineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f8ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});

export default HomeScreen;
