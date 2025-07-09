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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext"; // CRITICAL: Theme import

interface RoutineWithCompletion extends UserRoutine {
  isCompleted: boolean;
  completionId?: string;
}

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // CRITICAL: Get theme colors - this was missing!
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [originalIndex, setOriginalIndex] = useState<number | null>(null);
  const [lastSwapIndex, setLastSwapIndex] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<
    "daily" | "weekly" | null
  >(null);

  const dragY = useRef(new Animated.Value(0)).current;

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
    const dateString = now.toDateString(); // This will be the same for the entire day

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

    // Create a consistent seed based on date + time period
    // This ensures the same greeting within the same time period of the same day
    const seed = `${dateString}-${timePeriod}`;
    return { timePeriod, seed, hour };
  };

  // Simple seeded random function to ensure consistency
  const seededRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Normalize to 0-1 range
    return Math.abs(hash) / 2147483648;
  };

  // Memoized greeting that only changes when the time period changes
  const personalizedGreeting = useMemo(() => {
    const { timePeriod, seed, hour } = getTimePeriodInfo();
    const firstName = userProfile?.full_name?.split(" ")[0] || "there";

    // Morning greetings (5 AM - 11:59 AM)
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

    // Afternoon greetings (12 PM - 4:59 PM)
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

    // Evening greetings (5 PM - 8:59 PM)
    const eveningGreetings = [
      `Good evening, ${firstName}`,
      `Evening vibes, ${firstName}.`,
      `Wind down time, ${firstName}`,
      `Almost there, ${firstName}!`,
      `Finish strong, ${firstName}`,
      `Home stretch, ${firstName}.`,
      `Wrapping up the day, ${firstName}?`,
      `Time to unwind, ${firstName}`,
      `Day's end approaches, ${firstName}.`,
    ];

    // Night greetings (9 PM - 4:59 AM)
    const nightGreetings = [
      `Good night, ${firstName}`,
      `Night owl mode, ${firstName}?`,
      `Late night grind, ${firstName}.`,
      `Burning the midnight oil, ${firstName}`,
      `Rest well soon, ${firstName}`,
      `Tomorrow's another day, ${firstName}.`,
      `Still going strong, ${firstName}?`,
      `Time for some rest, ${firstName}`,
      `The night is yours, ${firstName}.`,
    ];

    let greetings;
    if (hour >= 5 && hour < 12) {
      greetings = morningGreetings;
    } else if (hour >= 12 && hour < 17) {
      greetings = afternoonGreetings;
    } else if (hour >= 17 && hour < 21) {
      greetings = eveningGreetings;
    } else {
      greetings = nightGreetings;
    }

    // Use seeded random to get consistent greeting for this time period
    const randomValue = seededRandom(seed);
    const index = Math.floor(randomValue * greetings.length);
    return greetings[index];
  }, [userProfile?.full_name, getTimePeriodInfo().seed]); // Only re-compute when user name or time period changes

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile for personalized greeting
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (!profileError && profile) {
        setUserProfile(profile);
      }

      const today = new Date().toISOString().split("T")[0];

      // Calculate week start (Monday)
      const now = new Date();
      const currentDay = now.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekStartDate = weekStart.toISOString().split("T")[0];

      // Load routines and completions
      const [routinesResult, dailyCompletionsResult, weeklyCompletionsResult] =
        await Promise.all([
          supabase
            .from("user_routines")
            .select("*")
            .eq("user_id", user.id)
            .order("sort_order"),
          supabase
            .from("routine_completions")
            .select("*")
            .eq("user_id", user.id)
            .eq("completion_date", today),
          supabase
            .from("routine_completions")
            .select("*")
            .eq("user_id", user.id)
            .gte("completion_date", weekStartDate)
            .eq("is_weekly_completion", true),
        ]);

      const { data: routines } = routinesResult;
      const { data: dailyCompletions } = dailyCompletionsResult;
      const { data: weeklyCompletions } = weeklyCompletionsResult;

      // Filter routines for today or selected day
      const daily: RoutineWithCompletion[] = [];
      const daySpecificData: Record<number, string[]> = {};

      // Initialize day specific data
      for (let i = 0; i <= 6; i++) {
        daySpecificData[i] = [];
      }

      routines?.forEach((routine) => {
        if (routine.is_daily) {
          const completion = dailyCompletions?.find(
            (c) => c.routine_id === routine.id
          );
          daily.push({
            ...routine,
            isCompleted: !!completion,
            completionId: completion?.id,
          });
        } else {
          // This is a day-specific routine
          // For simplicity, assuming day_of_week field exists or use a mapping
          const dayOfWeek =
            routine.day_of_week !== undefined
              ? routine.day_of_week
              : selectedDay;
          daySpecificData[dayOfWeek].push(routine.id);

          if (dayOfWeek === selectedDay) {
            const completion = dailyCompletions?.find(
              (c) => c.routine_id === routine.id
            );
            daily.push({
              ...routine,
              isCompleted: !!completion,
              completionId: completion?.id,
            });
          }
        }
      });

      // Process weekly routines (unchanged)
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
      setDaySpecificRoutines(daySpecificData);

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

  // Add focus listener to reload data when coming back from AddRoutine
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
        // Remove completion
        const { error } = await supabase
          .from("routine_completions")
          .delete()
          .eq("id", routine.completionId);

        if (error) throw error;
      } else {
        // Add completion
        const today = new Date().toISOString().split("T")[0];

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
          completion_date: today,
          week_start_date: weekStartDate,
          is_weekly_completion: isWeekly,
        });

        if (error) throw error;
      }

      // Reload data
      loadData();
    } catch (error) {
      console.error("Error toggling routine:", error);
      Alert.alert("Error", "Failed to update routine");
    }
  };

  const handleDayPress = (dayValue: number) => {
    setSelectedDay(dayValue);
  };

  // RESTORED: Missing function for adding routines to specific days
  const addRoutineToDay = () => {
    setShowDayRoutineModal(true);
    loadAvailableRoutines();
  };

  // RESTORED: Load available routines for the modal
  const loadAvailableRoutines = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: routines, error } = await supabase
        .from("user_routines")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setAvailableRoutines(routines || []);
    } catch (error) {
      console.error("Error loading available routines:", error);
      Alert.alert("Error", "Failed to load available routines");
    }
  };

  // RESTORED: Add routine to specific day
  const assignRoutineToDay = async (routineId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Add to user_day_routines table or update routine's day_of_week
      const { error } = await supabase
        .from("user_routines")
        .update({ day_of_week: selectedDay })
        .eq("id", routineId)
        .eq("user_id", user.id);

      if (error) throw error;

      setShowDayRoutineModal(false);
      loadData(); // Reload to show the new assignment
    } catch (error) {
      console.error("Error assigning routine to day:", error);
      Alert.alert("Error", "Failed to assign routine to day");
    }
  };

  // Drag and drop functionality for reordering routines
  const createPanResponder = (index: number, section: "daily" | "weekly") =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only allow vertical dragging and ensure we have enough movement
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dx) < 50;
      },
      onPanResponderGrant: () => {
        setDraggedIndex(index);
        setOriginalIndex(index);
        setDraggedSection(section);
        setIsDragging(true);
        setScrollEnabled(false);
        setLastSwapIndex(null);
      },
      onPanResponderMove: (_, gestureState) => {
        // Update the animated value
        dragY.setValue(gestureState.dy);

        // Calculate which index we should swap with based on drag position
        const routines = section === "daily" ? dailyRoutines : weeklyRoutines;
        const itemHeight = 80; // Approximate height of routine item
        const offset = gestureState.dy;
        const targetIndex = Math.max(
          0,
          Math.min(routines.length - 1, index + Math.round(offset / itemHeight))
        );

        // Only perform swap if we're dragging to a different position
        if (targetIndex !== lastSwapIndex && targetIndex !== index) {
          const newRoutines = [...routines];
          const draggedItem = newRoutines[index];

          // Remove dragged item and insert at new position
          newRoutines.splice(index, 1);
          newRoutines.splice(targetIndex, 0, draggedItem);

          // Update state
          if (section === "daily") {
            setDailyRoutines(newRoutines);
          } else {
            setWeeklyRoutines(newRoutines);
          }

          setDraggedIndex(targetIndex);
          setLastSwapIndex(targetIndex);
        }
      },
      onPanResponderRelease: async () => {
        // Reset drag state
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: false,
        }).start();

        setIsDragging(false);
        setScrollEnabled(true);

        // Save new order to database if position changed
        if (draggedIndex !== null && originalIndex !== draggedIndex) {
          await saveRoutineOrder(section);
        }

        setDraggedIndex(null);
        setOriginalIndex(null);
        setDraggedSection(null);
        setLastSwapIndex(null);
      },
    });

  const saveRoutineOrder = async (section: "daily" | "weekly") => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const routines = section === "daily" ? dailyRoutines : weeklyRoutines;

      // Update sort_order for all routines in this section
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

  const renderRoutineItem = (
    routine: RoutineWithCompletion,
    index: number,
    section: "daily" | "weekly"
  ) => {
    const panResponder = createPanResponder(index, section);
    const isBeingDragged =
      isDragging && draggedIndex === index && draggedSection === section;

    return (
      <Animated.View
        key={routine.id}
        style={[
          styles.routineItem,
          isBeingDragged && {
            transform: [{ translateY: dragY }],
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
          },
        ]}
      >
        <View
          style={[
            styles.routineContent,
            { backgroundColor: colors.card, borderColor: colors.border },
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
                { borderColor: colors.border },
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

          {/* Drag Handle - Separate from main touch area */}
          <View style={styles.dragHandle} {...panResponder.panHandlers}>
            <View style={styles.dragIcon}>
              <View
                style={[
                  styles.dragLine,
                  { backgroundColor: colors.textTertiary },
                ]}
              />
              <View
                style={[
                  styles.dragLine,
                  { backgroundColor: colors.textTertiary },
                ]}
              />
              <View
                style={[
                  styles.dragLine,
                  { backgroundColor: colors.textTertiary },
                ]}
              />
            </View>
          </View>
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
        {/* Header */}
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

        {/* Day Calendar Strip */}
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
                    { backgroundColor: colors.card },
                    isToday && styles.dayBoxToday,
                    isSelected && styles.dayBoxSelected,
                  ]}
                  onPress={() => handleDayPress(day.value)}
                >
                  <Text
                    style={[
                      styles.dayBoxName,
                      { color: colors.text },
                      isToday && styles.dayBoxNameToday,
                      isSelected && styles.dayBoxNameSelected,
                    ]}
                  >
                    {day.name}
                  </Text>
                  <View
                    style={[
                      styles.dayBoxIndicator,
                      { backgroundColor: colors.border },
                      hasRoutines && styles.dayBoxIndicatorActive,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Daily Routines Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color="#007AFF" />
            <View style={styles.dailyRoutinesHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Daily Routines
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate("AddRoutine")}
            >
              <Ionicons name="add" size={24} color="#007AFF" />
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
                No daily routines set up yet
              </Text>
              <Text
                style={[
                  styles.emptyStateSubtext,
                  { color: colors.textTertiary },
                ]}
              >
                Build consistent daily habits!
              </Text>
            </View>
          )}
        </View>

        {/* Weekly Routines Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color="#ffd700" />
            <View style={styles.weeklyGoalsHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Weekly Goals
              </Text>
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

      {/* RESTORED: Day Routine Assignment Modal */}
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
            style={[
              styles.modalHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowDayRoutineModal(false)}>
              <Text style={[styles.modalCancelButton, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add to {daysOfWeek.find((d) => d.value === selectedDay)?.name}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            {availableRoutines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={[
                  styles.availableRoutineItem,
                  {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.separator,
                  },
                ]}
                onPress={() => assignRoutineToDay(routine.id)}
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
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            ))}
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
  },
  // New container for Weekly Goals header layout
  weeklyGoalsHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  // New container for Daily Routines header layout (same as weekly)
  dailyRoutinesHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
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
    marginLeft: 12,
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
  // Calendar Strip Styles
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
  // Drag and Drop Styles
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 40,
    minHeight: 40,
  },
  dragIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  dragLine: {
    width: 18,
    height: 2,
    marginVertical: 1,
    borderRadius: 1,
  },
  // RESTORED: Modal Styles
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
