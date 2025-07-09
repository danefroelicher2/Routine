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
      console.log("📊 Stats screen focused - loading fresh data");
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

  // Achievement calculation logic
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

  const getCurrentStreakMessage = () => {
    if (currentStreak === 0) {
      return "Start your streak today!";
    } else if (currentStreak === 1) {
      return "Great start! Keep it up.";
    } else if (currentStreak <= 7) {
      return "Building momentum!";
    } else if (currentStreak <= 30) {
      return "Impressive consistency!";
    } else {
      return "You're unstoppable!";
    }
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

    return days;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
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
          Statistics
        </Text>
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Enhanced Widget-style streak boxes */}
        <View style={styles.widgetContainer}>
          {/* Current Streak Widget - Enhanced for Dark Mode */}
          <View
            style={[
              styles.widget,
              styles.currentStreakWidget,
              {
                backgroundColor: colors.surface,
                shadowColor: colors.text,
              },
            ]}
          >
            <View style={styles.widgetContent}>
              <Text style={[styles.currentStreakNumber, { color: "#ff6b35" }]}>
                {currentStreak}
              </Text>
              <Text
                style={[
                  styles.currentStreakLabel,
                  { color: colors.text }, // Use primary text color instead of secondary
                ]}
              >
                day{currentStreak !== 1 ? "s" : ""} in a row
              </Text>
              <Text
                style={[
                  styles.currentStreakMessage,
                  { color: colors.textSecondary },
                ]}
              >
                {getCurrentStreakMessage()}
              </Text>
            </View>
            <View style={styles.widgetIcon}>
              <Ionicons
                name={currentStreak > 0 ? "flame" : "flame-outline"}
                size={32}
                color={currentStreak > 0 ? "#ff6b35" : colors.textTertiary}
              />
            </View>
          </View>

          {/* Longest Streak Widget - Enhanced for Dark Mode */}
          <View
            style={[
              styles.widget,
              styles.longestStreakWidget,
              {
                backgroundColor: colors.surface,
                shadowColor: colors.text,
              },
            ]}
          >
            <View style={styles.widgetContent}>
              <Text style={[styles.longestStreakNumber, { color: "#ffd700" }]}>
                {longestStreak.length}
              </Text>
              <Text
                style={[
                  styles.longestStreakLabel,
                  { color: colors.text }, // Use primary text color instead of secondary
                ]}
              >
                longest streak
              </Text>
              <Text
                style={[
                  styles.longestStreakDates,
                  { color: colors.textSecondary },
                ]}
              >
                {getStreakDateRange()}
              </Text>
            </View>
            <View style={styles.widgetIcon}>
              <Ionicons name="trophy" size={32} color="#ffd700" />
            </View>
          </View>
        </View>

        {/* Monthly Heatmap */}
        <View
          style={[styles.heatmapSection, { backgroundColor: colors.surface }]}
        >
          <View style={styles.heatmapHeader}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth("prev")}
            >
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>

            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {getMonthName(currentDate)}
            </Text>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth("next")}
            >
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heatmapGrid}>
            {/* Day labels */}
            <View style={styles.dayLabels}>
              {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => (
                <Text
                  key={index}
                  style={[styles.dayLabel, { color: colors.textSecondary }]}
                >
                  {dayLabel}
                </Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>{renderHeatmapCalendar()}</View>
          </View>

          {/* Success tracker legend */}
          <View style={styles.legend}>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              Less
            </Text>
            <View style={styles.legendColors}>
              <View
                style={[styles.legendColor, { backgroundColor: "#ebedf0" }]}
              />
              <View
                style={[styles.legendColor, { backgroundColor: "#c6e48b" }]}
              />
            </View>
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              More
            </Text>
          </View>
        </View>

        {/* Original Achievements Design with Badge System */}
        <View
          style={[
            styles.achievementsSection,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.achievementsHeader}>
            <View style={styles.achievementsHeaderLeft}>
              <View
                style={[
                  styles.trophyContainer,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="trophy" size={20} color="#ffd700" />
              </View>
              <Text style={[styles.achievementsTitle, { color: colors.text }]}>
                Achievements
              </Text>
            </View>
            <View
              style={[
                styles.achievementsStats,
                { backgroundColor: colors.background },
              ]}
            >
              <Text style={styles.achievementsCount}>
                {achievements.filter((a) => a.unlocked).length}/
                {achievements.length}
              </Text>
            </View>
          </View>

          <View style={styles.achievementsGrid}>
            {achievements.map((achievement, index) => {
              const isUnlocked = achievement.unlocked;
              const getBadgeDesign = (target: number, isUnlocked: boolean) => {
                // Define badge tiers with increasingly impressive designs
                if (target <= 30) {
                  // Starter badges - simple circles with stars (3, 5, 7, 14, 30 days)
                  return {
                    type: "basic",
                    backgroundColor: isUnlocked ? "#10b981" : "#d1d5db",
                    borderColor: isUnlocked ? "#059669" : "#9ca3af",
                    icon: "star",
                    iconColor: isUnlocked ? "#fff" : "#6b7280",
                    ribbonColor: isUnlocked ? "#059669" : "#9ca3af",
                    hasRibbon: true,
                    hasWings: false,
                    hasCrown: false,
                    hasGems: false,
                  };
                } else if (target <= 150) {
                  // Builder badges with ribbons (60, 100, 150 days)
                  return {
                    type: "shield",
                    backgroundColor: isUnlocked ? "#3b82f6" : "#d1d5db",
                    borderColor: isUnlocked ? "#2563eb" : "#9ca3af",
                    icon: "shield-checkmark",
                    iconColor: isUnlocked ? "#fff" : "#6b7280",
                    ribbonColor: isUnlocked ? "#2563eb" : "#9ca3af",
                    hasRibbon: true,
                    hasWings: false,
                    hasCrown: false,
                    hasGems: false,
                  };
                } else if (target <= 300) {
                  // Champion badges with wings (200, 250, 300 days)
                  return {
                    type: "premium",
                    backgroundColor: isUnlocked ? "#8b5cf6" : "#d1d5db",
                    borderColor: isUnlocked ? "#7c3aed" : "#9ca3af",
                    icon: "diamond",
                    iconColor: isUnlocked ? "#fff" : "#6b7280",
                    ribbonColor: isUnlocked ? "#7c3aed" : "#9ca3af",
                    hasRibbon: true,
                    hasWings: true,
                    hasCrown: false,
                    hasGems: true,
                  };
                } else {
                  // Legend badges with crown, wings, and gems (365 days)
                  return {
                    type: "ultimate",
                    backgroundColor: isUnlocked ? "#f59e0b" : "#d1d5db",
                    borderColor: isUnlocked ? "#d97706" : "#9ca3af",
                    icon: "trophy",
                    iconColor: isUnlocked ? "#fff" : "#6b7280",
                    ribbonColor: isUnlocked ? "#d97706" : "#9ca3af",
                    hasRibbon: true,
                    hasWings: true,
                    hasCrown: true,
                    hasGems: true,
                  };
                }
              };

              const badgeDesign = getBadgeDesign(
                achievement.target,
                isUnlocked
              );

              return (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    isUnlocked
                      ? styles.achievementCardUnlocked
                      : styles.achievementCardLocked,
                  ]}
                >
                  <View style={styles.achievementCardInner}>
                    {/* Badge container with decorative elements */}
                    <View style={styles.achievementBadgeContainer}>
                      {/* Wings (for premium and ultimate badges) */}
                      {badgeDesign.hasWings && isUnlocked && (
                        <>
                          <View
                            style={[styles.badgeWing, styles.badgeWingLeft]}
                          />
                          <View
                            style={[styles.badgeWing, styles.badgeWingRight]}
                          />
                        </>
                      )}

                      {/* Crown (for ultimate badges) */}
                      {badgeDesign.hasCrown && isUnlocked && (
                        <View style={styles.badgeCrown}>
                          <Ionicons name="diamond" size={8} color="#ffd700" />
                          <Ionicons name="diamond" size={10} color="#ffd700" />
                          <Ionicons name="diamond" size={8} color="#ffd700" />
                        </View>
                      )}

                      {/* Main badge */}
                      <View
                        style={[
                          styles.achievementBadgeNew,
                          {
                            backgroundColor: badgeDesign.backgroundColor,
                            borderColor: badgeDesign.borderColor,
                          },
                          badgeDesign.type === "shield" && styles.shieldBadge,
                          badgeDesign.type === "premium" && styles.premiumBadge,
                          badgeDesign.type === "ultimate" &&
                            styles.ultimateBadge,
                          isUnlocked && styles.achievementBadgeGlow,
                        ]}
                      >
                        {/* Gems (for premium and ultimate badges) */}
                        {badgeDesign.hasGems && isUnlocked && (
                          <>
                            <View
                              style={[styles.badgeGem, styles.badgeGemTopLeft]}
                            />
                            <View
                              style={[styles.badgeGem, styles.badgeGemTopRight]}
                            />
                            <View
                              style={[
                                styles.badgeGem,
                                styles.badgeGemBottomLeft,
                              ]}
                            />
                            <View
                              style={[
                                styles.badgeGem,
                                styles.badgeGemBottomRight,
                              ]}
                            />
                          </>
                        )}

                        {/* Main icon */}
                        <Ionicons
                          name={badgeDesign.icon as any}
                          size={20}
                          color={badgeDesign.iconColor}
                          style={styles.badgeMainIcon}
                        />

                        {/* Number overlay */}
                        <View style={styles.badgeNumberContainer}>
                          <Text
                            style={[
                              styles.badgeNumber,
                              { color: badgeDesign.iconColor },
                            ]}
                          >
                            {achievement.target}
                          </Text>
                        </View>
                      </View>

                      {/* Ribbon banner */}
                      {badgeDesign.hasRibbon && (
                        <View
                          style={[
                            styles.badgeRibbon,
                            { backgroundColor: badgeDesign.ribbonColor },
                          ]}
                        >
                          <Text style={styles.badgeRibbonText}>
                            {achievement.target <= 30
                              ? "STARTER"
                              : achievement.target <= 150
                              ? "BUILDER"
                              : achievement.target <= 300
                              ? "CHAMPION"
                              : "LEGEND"}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Achievement info */}
                    <View style={styles.achievementInfo}>
                      <Text
                        style={[
                          styles.achievementText,
                          isUnlocked
                            ? styles.achievementTextUnlocked
                            : styles.achievementTextLocked,
                        ]}
                      >
                        {achievement.target} Day
                        {achievement.target > 1 ? "s" : ""}
                      </Text>
                      <Text
                        style={[
                          styles.achievementSubtext,
                          isUnlocked
                            ? styles.achievementSubtextUnlocked
                            : styles.achievementSubtextLocked,
                        ]}
                      >
                        Streak
                      </Text>

                      {isUnlocked && achievement.unlockedDate && (
                        <View style={styles.achievementUnlockedContainer}>
                          <Ionicons name="calendar" size={8} color="#00d4aa" />
                          <Text style={styles.achievementUnlockedDate}>
                            {new Date(
                              achievement.unlockedDate
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Progress indicator for locked achievements */}
                  {!isUnlocked && (
                    <View style={styles.achievementProgress}>
                      <View style={styles.achievementProgressBg}>
                        <View
                          style={[
                            styles.achievementProgressFill,
                            {
                              width: `${Math.min(
                                (currentStreak / achievement.target) * 100,
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
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
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  // Enhanced Widget container and styles
  widgetContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  widget: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentStreakWidget: {
    borderLeftWidth: 4,
    borderLeftColor: "#ff6b35",
  },
  longestStreakWidget: {
    borderLeftWidth: 4,
    borderLeftColor: "#ffd700",
  },
  widgetContent: {
    flex: 1,
  },
  widgetIcon: {
    marginLeft: 12,
  },
  currentStreakNumber: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 32,
  },
  currentStreakLabel: {
    fontSize: 14, // Increased from 12
    marginTop: 2,
    fontWeight: "600", // Added font weight
  },
  currentStreakMessage: {
    fontSize: 11,
    marginTop: 4,
  },
  longestStreakNumber: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 36,
  },
  longestStreakLabel: {
    fontSize: 14, // Increased from 14
    marginTop: 2,
    fontWeight: "600", // Added font weight
  },
  longestStreakDates: {
    fontSize: 12,
    marginTop: 4,
  },
  // Heatmap styles
  heatmapSection: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  heatmapGrid: {
    alignItems: "center",
    width: "100%",
  },
  dayLabels: {
    flexDirection: "row",
    marginBottom: 10,
    width: "100%",
    paddingHorizontal: 0,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
  heatmapCell: {
    width: "14.28%",
    aspectRatio: 1,
    padding: 1,
  },
  heatmapDay: {
    flex: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ebedf0",
  },
  heatmapDayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendColors: {
    flexDirection: "row",
    gap: 2,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  // Original Achievements Section Styles with Badge System
  achievementsSection: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  achievementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  achievementsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  trophyContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  achievementsTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  achievementsStats: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  achievementsCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around", // CHANGED FROM space-between TO space-around
    gap: 12,
  },
  achievementCard: {
    width: (width - 120) / 3,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    position: "relative",
    overflow: "hidden",
    marginBottom: 8,
  },
  achievementCardUnlocked: {
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  achievementCardLocked: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  achievementCardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  achievementBadgeContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  achievementBadgeNew: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  achievementBadgeGlow: {
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  shieldBadge: {
    borderRadius: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  premiumBadge: {
    borderRadius: 12,
    transform: [{ rotate: "45deg" }],
  },
  ultimateBadge: {
    borderRadius: 50,
    width: 52,
    height: 52,
  },
  // Wings for premium badges
  badgeWing: {
    position: "absolute",
    width: 20,
    height: 12,
    backgroundColor: "#fbbf24",
    top: 8,
    zIndex: -1,
  },
  badgeWingLeft: {
    left: -15,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    transform: [{ skewY: "-15deg" }],
  },
  badgeWingRight: {
    right: -15,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    transform: [{ skewY: "15deg" }],
  },
  // Crown for ultimate badges
  badgeCrown: {
    position: "absolute",
    top: -8,
    flexDirection: "row",
    alignItems: "flex-end",
    zIndex: 2,
    gap: 1,
  },
  // Gems for decoration
  badgeGem: {
    position: "absolute",
    width: 4,
    height: 4,
    backgroundColor: "#60a5fa",
    borderRadius: 2,
    zIndex: 1,
  },
  badgeGemTopLeft: {
    top: 4,
    left: 4,
  },
  badgeGemTopRight: {
    top: 4,
    right: 4,
  },
  badgeGemBottomLeft: {
    bottom: 4,
    left: 4,
  },
  badgeGemBottomRight: {
    bottom: 4,
    right: 4,
  },
  // Main icon in center
  badgeMainIcon: {
    position: "absolute",
    zIndex: 2,
  },
  // Number overlay
  badgeNumberContainer: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#fff",
    borderRadius: 8,
    minWidth: 16,
    minHeight: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  badgeNumber: {
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  // Ribbon banner
  badgeRibbon: {
    position: "absolute",
    bottom: -6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 3,
  },
  badgeRibbonText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  achievementInfo: {
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
  achievementProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  achievementProgressBg: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  achievementProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});
