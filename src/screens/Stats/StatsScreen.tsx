import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { RoutineCompletion } from "../../types/database";
import { useTheme } from "../../../ThemeContext";

const { width } = Dimensions.get("window");

interface CompletionData {
  date: string;
  completionCount: number;
}

interface StreakInfo {
  length: number;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
}

// Achievement interface
interface Achievement {
  id: string;
  name: string;
  target: number;
  unlocked: boolean;
  unlockedDate?: string;
}

export default function StatsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completionData, setCompletionData] = useState<CompletionData[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState<StreakInfo>({
    length: 0,
    startDate: "",
    endDate: "",
    isOngoing: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Theme context
  const { colors } = useTheme();

  // Achievement targets (in days) - 12 total achievements
  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 100, 150, 200, 250, 300, 365,
  ];

  // ENHANCED: Load data when screen comes into focus (real-time updates)
  useFocusEffect(
    useCallback(() => {
      console.log("📊 STATS: Screen focused - reloading all data");
      // Add a small delay to ensure database writes are complete
      const timer = setTimeout(() => {
        loadStatsData();
      }, 100);

      return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    loadStatsData();
  }, [currentDate]);

  // ENHANCED loadStatsData function with better completion detection
  const loadStatsData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      console.log("📊 STATS: Starting fresh data load...");

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Current month for calendar display
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // EXPANDED range to include today if it's outside current month
      const queryStartDate = today < firstDay ? today : firstDay;
      const queryEndDate = today > lastDay ? today : lastDay;

      console.log("📅 STATS: Loading data for calendar");
      console.log(
        "  - Month view:",
        firstDay.toISOString().split("T")[0],
        "to",
        lastDay.toISOString().split("T")[0]
      );
      console.log(
        "  - Query range:",
        queryStartDate.toISOString().split("T")[0],
        "to",
        queryEndDate.toISOString().split("T")[0]
      );
      console.log("  - Today:", todayStr);

      // Get both completions and user routines - EXPANDED RANGE
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          // Get completions for the EXPANDED range (includes today)
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", user.id)
            .gte("completion_date", queryStartDate.toISOString().split("T")[0])
            .lte("completion_date", queryEndDate.toISOString().split("T")[0]),
          // Get all active user routines
          supabase
            .from("user_routines")
            .select("id, is_weekly, name") // Added name for debugging
            .eq("user_id", user.id),
          // Get day-specific routine assignments
          supabase
            .from("user_day_routines")
            .select("routine_id, day_of_week")
            .eq("user_id", user.id),
        ]);

      if (completionsResult.error) throw completionsResult.error;
      if (userRoutinesResult.error) throw userRoutinesResult.error;
      if (dayRoutinesResult.error) throw dayRoutinesResult.error;

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayAssignments = dayRoutinesResult.data || [];

      console.log("📊 STATS: Loaded data:");
      console.log("  - Completions:", completions.length);
      console.log("  - User routines:", userRoutines.length);
      console.log("  - Day assignments:", dayAssignments.length);

      // Build day-specific routines mapping
      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });

      // Create completion map for ALL dates in our expanded range
      const completionsByDate = new Map<string, string[]>();
      completions.forEach((completion) => {
        const date = completion.completion_date;
        if (!completionsByDate.has(date)) {
          completionsByDate.set(date, []);
        }
        completionsByDate.get(date)!.push(completion.routine_id);
      });

      // Process success data for the DISPLAY MONTH only
      const successData: CompletionData[] = [];

      for (
        let d = new Date(firstDay);
        d <= lastDay;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split("T")[0];
        const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Get routines that should be active on this day (daily routines only)
        const dailyRoutineIds = dayRoutineMap[dayOfWeek] || [];
        const dailyRoutines = userRoutines.filter(
          (routine) =>
            !routine.is_weekly && dailyRoutineIds.includes(routine.id)
        );

        // Get completions for this date from our expanded dataset
        const completedRoutineIds = completionsByDate.get(dateStr) || [];

        // Check if ALL daily routines are completed
        const allCompleted =
          dailyRoutines.length > 0 &&
          dailyRoutines.every((routine) =>
            completedRoutineIds.includes(routine.id)
          );

        // ENHANCED LOGGING for today's data
        if (dateStr === todayStr) {
          console.log("🟢 STATS: TODAY'S CALENDAR ANALYSIS:");
          console.log("  - Date:", dateStr);
          console.log("  - Day of week:", dayOfWeek);
          console.log(
            "  - Required routines:",
            dailyRoutines.map((r) => `${r.name} (${r.id})`)
          );
          console.log("  - Completed routine IDs:", completedRoutineIds);
          console.log("  - All completed?", allCompleted);
          console.log(
            "  - Calendar will show:",
            allCompleted ? "GREEN" : "TRANSPARENT"
          );
        }

        successData.push({
          date: dateStr,
          completionCount: allCompleted ? 1 : 0, // 1 = success, 0 = not complete
        });
      }

      setCompletionData(successData);
      console.log(
        "📈 STATS: Final completion data set:",
        successData.length,
        "days"
      );
      console.log(
        "📈 STATS: Today's data included:",
        successData.some((d) => d.date === todayStr)
      );

      // Calculate streaks based on success days (using expanded data)
      await calculateStreaks(user.id);

      // Calculate achievements
      await calculateAchievements(user.id);
    } catch (error) {
      console.error("Error loading stats:", error);
      Alert.alert("Error", "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const calculateStreaks = async (userId: string) => {
    try {
      console.log("=== CALCULATING STREAKS ===");

      // Get fresh data every time
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId)
            .order("completion_date", { ascending: false }),
          supabase
            .from("user_routines")
            .select("id, is_weekly")
            .eq("user_id", userId),
          supabase
            .from("user_day_routines")
            .select("routine_id, day_of_week")
            .eq("user_id", userId),
        ]);

      if (completionsResult.error) throw completionsResult.error;
      if (userRoutinesResult.error) throw userRoutinesResult.error;
      if (dayRoutinesResult.error) throw dayRoutinesResult.error;

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayAssignments = dayRoutinesResult.data || [];

      console.log("Fresh data loaded:");
      console.log("- Completions:", completions.length);
      console.log("- User Routines:", userRoutines.length);
      console.log("- Day Assignments:", dayAssignments.length);

      if (completions.length === 0 || userRoutines.length === 0) {
        console.log("No data found, setting streaks to 0");
        setCurrentStreak(0);
        setLongestStreak({
          length: 0,
          startDate: "",
          endDate: "",
          isOngoing: false,
        });
        return;
      }

      // Build day-routine mapping
      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });

      console.log("Day routine mapping:", dayRoutineMap);

      // Create success days map
      const successDays = new Set<string>();

      // Group completions by date
      const completionsByDate = new Map<string, string[]>();
      completions.forEach((completion) => {
        const date = completion.completion_date;
        if (!completionsByDate.has(date)) {
          completionsByDate.set(date, []);
        }
        completionsByDate.get(date)!.push(completion.routine_id);
      });

      console.log(
        "Current completions by date:",
        Object.fromEntries(completionsByDate)
      );

      // Check each date for success
      const today = new Date().toISOString().split("T")[0];
      console.log("Checking success for today:", today);

      completionsByDate.forEach((completedRoutineIds, date) => {
        const dayOfWeek = new Date(date).getDay();
        const dailyRoutineIds = dayRoutineMap[dayOfWeek] || [];
        const dailyRoutines = userRoutines.filter(
          (routine) =>
            !routine.is_weekly && dailyRoutineIds.includes(routine.id)
        );

        if (date === today) {
          console.log(`TODAY (${date}) analysis:`);
          console.log("- Day of week:", dayOfWeek);
          console.log("- Required routine IDs:", dailyRoutineIds);
          console.log(
            "- Required routines:",
            dailyRoutines.map((r) => r.id)
          );
          console.log("- Completed routine IDs:", completedRoutineIds);
        }

        const allCompleted =
          dailyRoutines.length > 0 &&
          dailyRoutines.every((routine) =>
            completedRoutineIds.includes(routine.id)
          );

        if (date === today) {
          console.log("- All completed?", allCompleted);
          if (allCompleted) {
            console.log("🎉 TODAY IS A SUCCESS DAY!");
          }
        }

        if (allCompleted) {
          successDays.add(date);
        }
      });

      const successDatesArray = Array.from(successDays).sort();
      console.log("All success days:", successDatesArray);

      // Calculate current streak (working backwards from today)
      let currentStreakValue = 0;
      const todayDate = new Date();

      for (let i = 0; i < 365; i++) {
        // Look back up to a year
        const checkDate = new Date(todayDate);
        checkDate.setDate(todayDate.getDate() - i);
        const checkDateStr = checkDate.toISOString().split("T")[0];

        if (successDays.has(checkDateStr)) {
          currentStreakValue++;
        } else {
          break; // Streak broken
        }
      }

      // Calculate longest streak by finding consecutive sequences
      let longestStreakValue = 0;
      let longestStart = "";
      let longestEnd = "";
      let longestIsOngoing = false;

      if (successDatesArray.length > 0) {
        let currentStart = successDatesArray[0];
        let currentLength = 1;

        for (let i = 1; i < successDatesArray.length; i++) {
          const prevDate = new Date(successDatesArray[i - 1]);
          const currDate = new Date(successDatesArray[i]);
          const dayDiff =
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            // Consecutive day
            currentLength++;
          } else {
            // Check if current sequence is longest
            if (currentLength > longestStreakValue) {
              longestStreakValue = currentLength;
              longestStart = currentStart;
              longestEnd = successDatesArray[i - 1];
              longestIsOngoing = successDatesArray[i - 1] === today;
            }
            // Start new sequence
            currentStart = successDatesArray[i];
            currentLength = 1;
          }
        }

        // Check final sequence
        if (currentLength > longestStreakValue) {
          longestStreakValue = currentLength;
          longestStart = currentStart;
          longestEnd = successDatesArray[successDatesArray.length - 1];
          longestIsOngoing =
            successDatesArray[successDatesArray.length - 1] === today;
        }
      }

      setCurrentStreak(currentStreakValue);
      setLongestStreak({
        length: longestStreakValue,
        startDate: longestStart,
        endDate: longestEnd,
        isOngoing: longestIsOngoing,
      });

      console.log("📊 STATS: Streak calculation results:");
      console.log("  - Success days:", successDatesArray.length);
      console.log("  - Current streak:", currentStreakValue);
      console.log("  - Longest streak:", longestStreakValue);
      console.log("  - Today is success:", successDays.has(today));
    } catch (error) {
      console.error("Error calculating streaks:", error);
    }
  };

  // Achievement calculation logic (same as StatsScreen)
  const calculateAchievements = useCallback(async (userId: string) => {
    try {
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId)
            .order("completion_date", { ascending: true }),
          supabase
            .from("user_routines")
            .select("id, is_weekly")
            .eq("user_id", userId),
          supabase
            .from("user_day_routines")
            .select("routine_id, day_of_week")
            .eq("user_id", userId),
        ]);

      if (
        completionsResult.error ||
        userRoutinesResult.error ||
        dayRoutinesResult.error
      ) {
        throw new Error("Failed to fetch achievement data");
      }

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayAssignments = dayRoutinesResult.data || [];

      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });

      const successDays = new Set<string>();
      const completionsByDate = new Map<string, string[]>();

      completions.forEach((completion) => {
        const date = completion.completion_date;
        if (!completionsByDate.has(date)) {
          completionsByDate.set(date, []);
        }
        completionsByDate.get(date)!.push(completion.routine_id);
      });

      completionsByDate.forEach((completedRoutineIds, date) => {
        const dayOfWeek = new Date(date).getDay();
        const dailyRoutineIds = dayRoutineMap[dayOfWeek] || [];
        const dailyRoutines = userRoutines.filter(
          (routine) =>
            !routine.is_weekly && dailyRoutineIds.includes(routine.id)
        );

        const allCompleted =
          dailyRoutines.length > 0 &&
          dailyRoutines.every((routine) =>
            completedRoutineIds.includes(routine.id)
          );

        if (allCompleted) {
          successDays.add(date);
        }
      });

      const successDatesArray = Array.from(successDays).sort();

      // Find all streaks that have occurred
      const streaks: Array<{ length: number; endDate: string }> = [];

      if (successDatesArray.length > 0) {
        let currentStreakLength = 1;
        let currentStreakStart = successDatesArray[0];

        for (let i = 1; i < successDatesArray.length; i++) {
          const prevDate = new Date(successDatesArray[i - 1]);
          const currDate = new Date(successDatesArray[i]);
          const dayDiff =
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            currentStreakLength++;
          } else {
            streaks.push({
              length: currentStreakLength,
              endDate: successDatesArray[i - 1],
            });
            currentStreakLength = 1;
            currentStreakStart = successDatesArray[i];
          }
        }

        // Don't forget the last streak
        streaks.push({
          length: currentStreakLength,
          endDate: successDatesArray[successDatesArray.length - 1],
        });
      }

      // Create achievements based on streak targets
      const newAchievements: Achievement[] = ACHIEVEMENT_TARGETS.map(
        (target) => {
          const unlockedStreak = streaks.find(
            (streak) => streak.length >= target
          );

          return {
            id: `${target}-day-streak`,
            name: `${target} Day${target === 1 ? "" : "s"} in a Row`,
            target,
            unlocked: !!unlockedStreak,
            unlockedDate: unlockedStreak?.endDate,
          };
        }
      );

      setAchievements(newAchievements);
    } catch (error) {
      console.error("Error calculating achievements:", error);
    }
  }, []);

  const formatStreakDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getStreakDateRange = () => {
    if (longestStreak.length === 0) return "";

    if (longestStreak.isOngoing) {
      return `${formatStreakDate(longestStreak.startDate)} - Ongoing`;
    } else {
      return `${formatStreakDate(longestStreak.startDate)} - ${formatStreakDate(
        longestStreak.endDate
      )}`;
    }
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatsData();
    setRefreshing(false);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getIntensityColor = (isSuccess: number) => {
    // Binary success tracking - only light green for complete success, transparent otherwise
    return isSuccess === 1 ? "#c6e48b" : "transparent";
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const renderHeatmapCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(
        <View key={`empty-${i}`} style={styles.heatmapCell}>
          <View
            style={[styles.heatmapDay, { backgroundColor: "transparent" }]}
          />
        </View>
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toISOString().split("T")[0];
      const dayData = completionData.find((d) => d.date === dateStr);
      const completionCount = dayData ? dayData.completionCount : 0;
      const backgroundColor = getIntensityColor(completionCount);

      // Check if this is today
      const today = new Date().toISOString().split("T")[0];
      const isToday = dateStr === today;

      days.push(
        <View key={day} style={styles.heatmapCell}>
          <View
            style={[
              styles.heatmapDay,
              {
                backgroundColor,
                borderWidth: isToday ? 2 : 0,
                borderColor: isToday ? "#007AFF" : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.heatmapDayText,
                {
                  color: completionCount > 0 ? "#2d5016" : colors.textSecondary,
                  fontWeight: isToday ? "bold" : "normal",
                },
              ]}
            >
              {day}
            </Text>
          </View>
        </View>
      );
    }

    // Fill remaining cells to complete the grid
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    for (let i = firstDayOfWeek + daysInMonth; i < totalCells; i++) {
      days.push(
        <View key={`empty-end-${i}`} style={styles.heatmapCell}>
          <View
            style={[styles.heatmapDay, { backgroundColor: "transparent" }]}
          />
        </View>
      );
    }

    return (
      <View style={styles.heatmapContainer}>
        <View style={styles.heatmapHeader}>
          <TouchableOpacity
            onPress={() => navigateMonth("prev")}
            style={styles.monthNavButton}
          >
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {getMonthName(currentDate)}
          </Text>
          <TouchableOpacity
            onPress={() => navigateMonth("next")}
            style={styles.monthNavButton}
          >
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Week day headers */}
        <View style={styles.weekDaysHeader}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <View key={index} style={styles.weekDayHeader}>
              <Text
                style={[styles.weekDayText, { color: colors.textSecondary }]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.heatmapGrid}>{days}</View>

        {/* Legend */}
        <View style={styles.heatmapLegend}>
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Less
          </Text>
          <View style={styles.legendSquares}>
            <View
              style={[styles.legendSquare, { backgroundColor: "#ebedf0" }]}
            />
            <View
              style={[styles.legendSquare, { backgroundColor: "#c6e48b" }]}
            />
          </View>
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            More
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <Ionicons name="stats-chart" size={28} color="#007AFF" />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Your Progress
            </Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statIcon}>
              <Ionicons name="flame" size={24} color="#FF6B35" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Current Streak
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statIcon}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {longestStreak.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Best Streak
            </Text>
            {longestStreak.length > 0 && (
              <Text style={[styles.streakDate, { color: colors.textTertiary }]}>
                {getStreakDateRange()}
              </Text>
            )}
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#32D74B" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {completionData.filter((d) => d.completionCount > 0).length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Perfect Days
            </Text>
          </View>
        </View>

        {/* Calendar Heatmap */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color="#007AFF" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Monthly Progress
            </Text>
          </View>
          {renderHeatmapCalendar()}
        </View>

        {/* Achievements */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Achievements
            </Text>
          </View>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  {
                    backgroundColor: achievement.unlocked
                      ? "#f0f9ff"
                      : colors.card,
                    borderColor: achievement.unlocked
                      ? "#0ea5e9"
                      : colors.border,
                  },
                ]}
              >
                <View style={styles.achievementContent}>
                  <Ionicons
                    name={achievement.unlocked ? "trophy" : "trophy-outline"}
                    size={20}
                    color={achievement.unlocked ? "#0ea5e9" : "#9ca3af"}
                  />
                  <Text
                    style={[
                      styles.achievementText,
                      achievement.unlocked
                        ? styles.achievementTextUnlocked
                        : styles.achievementTextLocked,
                    ]}
                  >
                    {achievement.target}
                  </Text>
                  <Text
                    style={[
                      styles.achievementSubtext,
                      achievement.unlocked
                        ? styles.achievementSubtextUnlocked
                        : styles.achievementSubtextLocked,
                    ]}
                  >
                    Day{achievement.target === 1 ? "" : "s"}
                  </Text>
                </View>
                {achievement.unlocked && achievement.unlockedDate && (
                  <View style={styles.achievementUnlockedContainer}>
                    <Ionicons name="checkmark" size={10} color="#059669" />
                    <Text style={styles.achievementUnlockedDate}>
                      {formatStreakDate(achievement.unlockedDate)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginLeft: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  streakDate: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
  heatmapContainer: {
    marginTop: 8,
  },
  heatmapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthNavButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekDaysHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  heatmapCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 1,
  },
  heatmapDay: {
    flex: 1,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ebedf0",
  },
  heatmapDayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  heatmapLegend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  legendText: {
    fontSize: 12,
    marginHorizontal: 8,
  },
  legendSquares: {
    flexDirection: "row",
    gap: 2,
  },
  legendSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  achievementCard: {
    width: (width - 80) / 4,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 8,
    position: "relative",
    overflow: "hidden",
  },
  achievementContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  achievementText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
  achievementTextUnlocked: {
    color: "#059669",
  },
  achievementTextLocked: {
    color: "#6b7280",
  },
  achievementSubtext: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
  achievementSubtextUnlocked: {
    color: "#10b981",
  },
  achievementSubtextLocked: {
    color: "#9ca3af",
  },
  achievementUnlockedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  achievementUnlockedDate: {
    fontSize: 8,
    color: "#059669",
    fontWeight: "600",
  },
});
