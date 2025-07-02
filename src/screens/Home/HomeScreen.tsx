import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";

interface RoutineWithCompletion extends UserRoutine {
  isCompleted: boolean;
  completionId?: string;
}

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
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

      // Get user's routines and day-specific assignments
      const { data: routines, error: routinesError } = await supabase
        .from("user_routines")
        .select("*")
        .eq("user_id", user.id);

      const { data: dayAssignments, error: dayError } = await supabase
        .from("user_day_routines")
        .select("*")
        .eq("user_id", user.id);

      if (routinesError || dayError) {
        console.error("Error fetching routines:", routinesError || dayError);
        return;
      }

      // Build day-specific routines mapping
      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments?.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });
      setDaySpecificRoutines(dayRoutineMap);

      // Get selected date for filtering daily routines
      const selectedDate = new Date();
      selectedDate.setDate(
        selectedDate.getDate() + (selectedDay - selectedDate.getDay())
      );
      const selectedDateString = selectedDate.toISOString().split("T")[0];

      // Get completions for selected day
      const { data: dailyCompletions, error: dailyError } = await supabase
        .from("routine_completions")
        .select("*")
        .eq("user_id", user.id)
        .eq("completion_date", selectedDateString);

      // Get weekly completions (from week start to now)
      const weekStartString = weekStart.toISOString().split("T")[0];
      const { data: weeklyCompletions, error: weeklyError } = await supabase
        .from("routine_completions")
        .select("*")
        .eq("user_id", user.id)
        .gte("completion_date", weekStartString);

      if (dailyError || weeklyError) {
        console.error("Error fetching completions:", dailyError || weeklyError);
        return;
      }

      // Filter routines for selected day
      const selectedDayRoutineIds = dayRoutineMap[selectedDay] || [];
      const daily: RoutineWithCompletion[] = [];

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
        const { error } = await supabase.from("routine_completions").insert({
          user_id: user.id,
          routine_id: routine.id,
          completed_date: today,
        });

        if (error) throw error;
      }

      // Reload data to reflect changes
      loadData();
    } catch (error) {
      console.error("Error toggling completion:", error);
      Alert.alert("Error", "Failed to update routine");
    }
  };

  const handleDayPress = (dayValue: number) => {
    setSelectedDay(dayValue);
  };

  const addRoutineToDay = () => {
    navigation.navigate("AddRoutine", { selectedDay });
  };

  const renderRoutineItem = (
    routine: RoutineWithCompletion,
    isWeekly: boolean
  ) => (
    <TouchableOpacity
      key={routine.id}
      style={styles.routineItem}
      onPress={() => toggleRoutineCompletion(routine, isWeekly)}
    >
      <View style={styles.routineContent}>
        <View style={styles.routineLeft}>
          <View
            style={[
              styles.checkbox,
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
                routine.isCompleted && styles.routineNameCompleted,
              ]}
            >
              {routine.name}
            </Text>
            {routine.description && (
              <Text style={styles.routineDescription}>
                {routine.description}
              </Text>
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
        <Text style={styles.headerTitle}>{personalizedGreeting}</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Day Calendar Strip */}
      <View style={styles.calendarContainer}>
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
                  isToday && styles.dayBoxToday,
                  isSelected && styles.dayBoxSelected,
                ]}
                onPress={() => handleDayPress(day.value)}
              >
                <Text
                  style={[
                    styles.dayBoxName,
                    isToday && styles.dayBoxNameToday,
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

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Daily Routines Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>
              {daysOfWeek.find((d) => d.value === selectedDay)?.name} Routines
            </Text>
            <TouchableOpacity
              onPress={addRoutineToDay}
              style={styles.addButton}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {dailyRoutines.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No routines set for{" "}
                {daysOfWeek.find((d) => d.value === selectedDay)?.name}
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
              <Text style={styles.emptyStateText}>
                No weekly routines set up yet
              </Text>
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
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
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  weekTimer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekTimerText: {
    fontSize: 12,
    color: "#666",
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
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
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
    borderColor: "#ddd",
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
    color: "#333",
  },
  routineNameCompleted: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  routineDescription: {
    fontSize: 14,
    color: "#666",
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
    color: "#666",
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  // Calendar Strip Styles
  calendarContainer: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
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
    backgroundColor: "#f8f9fa",
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
    color: "#333",
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
    backgroundColor: "#ddd",
  },
  dayBoxIndicatorActive: {
    backgroundColor: "#34c759",
  },
});

export default HomeScreen;
