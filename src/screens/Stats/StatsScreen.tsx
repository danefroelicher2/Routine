// KEY FIXES MADE:
// 1. Added getLocalDateString utility function to ensure consistent local date handling
// 2. Fixed renderHeatmapCalendar to use local dates instead of UTC
// 3. Updated all date comparisons to use local timezone
// 4. Fixed "today" detection in calendar to use device timezone
// 5. Ensured completion data uses local dates consistently
// 6. Added checkDailyCompletionStatusForStats function to match Home page logic
// 7. Removed scheduled_routines references to prevent errors

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

// ✅ CRITICAL FIX: Utility function to get local date string consistently
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ✅ CRITICAL FIX: Utility to create local date from date string
const createLocalDate = (year: number, month: number, day: number): Date => {
  return new Date(year, month, day);
};

// ✅ NEW: Stats version of completion checking that matches Home page logic exactly
const checkDailyCompletionStatusForStats = (
  userId: string,
  dateStr: string,
  dayOfWeek: number,
  userRoutines: any[],
  completedRoutineIds: string[],
  dayRoutineMap: Record<number, string[]>
): boolean => {
  // Get routines assigned to this day of week (same logic as Home page)
  const todayDailyRoutineIds = dayRoutineMap[dayOfWeek] || [];
  const todayDailyRoutines = userRoutines.filter(
    (routine) => !routine.is_weekly && todayDailyRoutineIds.includes(routine.id)
  );

  // Check if all daily routines are completed (same logic as Home page)
  const allCompleted =
    todayDailyRoutines.length > 0 &&
    todayDailyRoutines.every((routine) =>
      completedRoutineIds.includes(routine.id)
    );

  // Enhanced logging for today
  const today = getLocalDateString(new Date());
  if (dateStr === today) {
    console.log("🟢 STATS: TODAY'S COMPLETION CHECK (MATCHING HOME PAGE):");
    console.log("  - Date (LOCAL):", dateStr);
    console.log("  - Day of week:", dayOfWeek);
    console.log("  - Required routines:", todayDailyRoutines.map((r) => r.name || r.id));
    console.log("  - Completed routine IDs:", completedRoutineIds);
    console.log("  - All completed?", allCompleted);
    console.log("  - Calendar will show:", allCompleted ? "GREEN" : "TRANSPARENT");
    console.log("  - This should MATCH the Home page completion status!");
  }

  return allCompleted;
};

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

  // ✅ ENHANCED loadStatsData function with LOCAL TIMEZONE fixes
  const loadStatsData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      console.log("📊 STATS: Starting fresh data load...");

      // ✅ CRITICAL FIX: Use local timezone for today
      const today = new Date();
      const todayStr = getLocalDateString(today);

      // Current month for calendar display (use currentDate for month navigation)
      const firstDay = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const lastDay = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      // ✅ CRITICAL FIX: Use local dates for query range
      const queryStartDate = today < firstDay ? today : firstDay;
      const queryEndDate = today > lastDay ? today : lastDay;

      console.log("📅 STATS: Loading data for calendar");
      console.log(
        "  - Month view:",
        getLocalDateString(firstDay),
        "to",
        getLocalDateString(lastDay)
      );
      console.log(
        "  - Query range:",
        getLocalDateString(queryStartDate),
        "to",
        getLocalDateString(queryEndDate)
      );
      console.log("  - Today (LOCAL):", todayStr);

      // Get both completions and user routines - EXPANDED RANGE
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          // ✅ CRITICAL FIX: Query using local date strings
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", user.id)
            .gte("completion_date", getLocalDateString(queryStartDate))
            .lte("completion_date", getLocalDateString(queryEndDate)),
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

      // ✅ CRITICAL FIX: Use local date iteration
      for (
        let d = new Date(firstDay);
        d <= lastDay;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = getLocalDateString(d);
        const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Get completions for this date from our expanded dataset
        const completedRoutineIds = completionsByDate.get(dateStr) || [];

        // ✅ FIXED: Use the same completion logic as Home page
        const allCompleted = checkDailyCompletionStatusForStats(
          user.id,
          dateStr,
          dayOfWeek,
          userRoutines,
          completedRoutineIds,
          dayRoutineMap
        );

        // ✅ ENHANCED LOGGING for today's data (matching Home page style)
        if (dateStr === todayStr) {
          console.log("🟢 STATS: TODAY'S CALENDAR ANALYSIS (MATCHING HOME PAGE):");
          console.log("  - Date (LOCAL):", dateStr);
          console.log("  - Day of week:", dayOfWeek);
          console.log("  - Completed routine IDs:", completedRoutineIds);
          console.log("  - All completed?", allCompleted);
          console.log("  - Calendar will show:", allCompleted ? "GREEN" : "TRANSPARENT");
          console.log("  - This should MATCH the Home page completion status!");
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
      console.log("=== CALCULATING STREAKS (LOCAL TIMEZONE) ===");

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

      // ✅ CRITICAL FIX: Use local timezone for today
      const today = getLocalDateString(new Date());
      console.log("Checking success for today (LOCAL):", today);

      completionsByDate.forEach((completedRoutineIds, date) => {
        // ✅ CRITICAL FIX: Parse date string back to Date for day calculation
        const dateParts = date.split("-");
        const checkDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        );
        const dayOfWeek = checkDate.getDay();

        if (date === today) {
          console.log(`TODAY (${date}) analysis:`);
          console.log("- Day of week:", dayOfWeek);
          console.log("- Completed routine IDs:", completedRoutineIds);
        }

        // ✅ FIXED: Use the same completion logic as Home page
        const allCompleted = checkDailyCompletionStatusForStats(
          userId,
          date,
          dayOfWeek,
          userRoutines,
          completedRoutineIds,
          dayRoutineMap
        );

        if (date === today) {
          console.log("- All completed?", allCompleted);
        }

        if (allCompleted) {
          successDays.add(date);
        }
      });

      console.log("Success days:", Array.from(successDays));
      console.log(`Today (${today}) is success:`, successDays.has(today));

      // Calculate current streak (going backwards from today)
      let currentStreakCount = 0;
      const todayDate = new Date();

      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(todayDate);
        checkDate.setDate(todayDate.getDate() - i);
        const dateStr = getLocalDateString(checkDate);

        if (successDays.has(dateStr)) {
          currentStreakCount++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreakCount = 0;
      let longestStreakStart = "";
      let longestStreakEnd = "";
      let currentTempStreak = 0;
      let tempStart = "";

      // Sort success days
      const sortedSuccessDays = Array.from(successDays).sort();

      if (sortedSuccessDays.length > 0) {
        tempStart = sortedSuccessDays[0];
        currentTempStreak = 1;

        for (let i = 1; i < sortedSuccessDays.length; i++) {
          const prevDate = new Date(sortedSuccessDays[i - 1]);
          const currDate = new Date(sortedSuccessDays[i]);

          // Check if dates are consecutive
          const dayDiff = Math.floor(
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (dayDiff === 1) {
            currentTempStreak++;
          } else {
            // Streak broken, check if it's the longest
            if (currentTempStreak > longestStreakCount) {
              longestStreakCount = currentTempStreak;
              longestStreakStart = tempStart;
              longestStreakEnd = sortedSuccessDays[i - 1];
            }
            // Start new streak
            currentTempStreak = 1;
            tempStart = sortedSuccessDays[i];
          }
        }

        // Check final streak
        if (currentTempStreak > longestStreakCount) {
          longestStreakCount = currentTempStreak;
          longestStreakStart = tempStart;
          longestStreakEnd = sortedSuccessDays[sortedSuccessDays.length - 1];
        }
      }

      const isOngoing = currentStreakCount > 0 && longestStreakEnd === today;

      console.log("📊 STREAK CALCULATION RESULTS:");
      console.log("- Current streak:", currentStreakCount);
      console.log("- Longest streak:", longestStreakCount);
      console.log("- Longest start:", longestStreakStart);
      console.log("- Longest end:", longestStreakEnd);
      console.log("- Is ongoing:", isOngoing);

      setCurrentStreak(currentStreakCount);
      setLongestStreak({
        length: longestStreakCount,
        startDate: longestStreakStart,
        endDate: longestStreakEnd,
        isOngoing,
      });
    } catch (error) {
      console.error("Error calculating streaks:", error);
    }
  };

  const calculateAchievements = useCallback(async (userId: string) => {
    try {
      // Get fresh data for achievements
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId),
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
        // ✅ CRITICAL FIX: Parse date string back to Date for day calculation
        const dateParts = date.split("-");
        const checkDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        );
        const dayOfWeek = checkDate.getDay();

        // ✅ FIXED: Use the same completion logic as Home page
        const allCompleted = checkDailyCompletionStatusForStats(
          userId,
          date,
          dayOfWeek,
          userRoutines,
          completedRoutineIds,
          dayRoutineMap
        );

        if (allCompleted) {
          successDays.add(date);
        }
      });

      // Find all streak periods
      const sortedSuccessDays = Array.from(successDays).sort();
      const streakPeriods: { length: number; endDate: string }[] = [];

      if (sortedSuccessDays.length > 0) {
        let currentStreakLength = 1;
        let currentStreakEnd = sortedSuccessDays[0];

        for (let i = 1; i < sortedSuccessDays.length; i++) {
          const prevDate = new Date(sortedSuccessDays[i - 1]);
          const currDate = new Date(sortedSuccessDays[i]);

          const dayDiff = Math.floor(
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (dayDiff === 1) {
            currentStreakLength++;
            currentStreakEnd = sortedSuccessDays[i];
          } else {
            streakPeriods.push({
              length: currentStreakLength,
              endDate: currentStreakEnd,
            });
            currentStreakLength = 1;
            currentStreakEnd = sortedSuccessDays[i];
          }
        }

        // Add the final streak
        streakPeriods.push({
          length: currentStreakLength,
          endDate: currentStreakEnd,
        });
      }

      const newAchievements: Achievement[] = ACHIEVEMENT_TARGETS.map(
        (target) => {
          const unlockedStreak = streakPeriods.find((s) => s.length >= target);
          return {
            id: `streak_${target}`,
            name: `${target} Day${target !== 1 ? "s" : ""} in a Row`,
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
    const dateParts = dateStr.split("-");
    const date = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );
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

  // ✅ CRITICAL FIX: Completely rewritten renderHeatmapCalendar with local timezone handling
  const renderHeatmapCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = createLocalDate(year, month, 1);
    const lastDayOfMonth = createLocalDate(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    // ✅ CRITICAL FIX: Get today using local timezone
    const today = new Date();
    const todayStr = getLocalDateString(today);

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
      // ✅ CRITICAL FIX: Create date using local timezone, not UTC
      const currentDayDate = createLocalDate(year, month, day);
      const dateStr = getLocalDateString(currentDayDate);

      const dayData = completionData.find((d) => d.date === dateStr);
      const completionCount = dayData ? dayData.completionCount : 0;
      const backgroundColor = getIntensityColor(completionCount);

      // ✅ CRITICAL FIX: Compare local date strings for "today" detection
      const isToday = dateStr === todayStr;

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
                color={currentStreak > 0 ? "#ff6b35" : colors.textSecondary}
              />
            </View>
          </View>

          {/* Longest Streak Widget */}
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
              <Text style={[styles.longestStreakLabel, { color: colors.text }]}>
                best streak
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
              <Ionicons
                name={longestStreak.length > 0 ? "trophy" : "trophy-outline"}
                size={32}
                color={
                  longestStreak.length > 0 ? "#ffd700" : colors.textSecondary
                }
              />
            </View>
          </View>
        </View>

        {/* Heatmap Calendar Section */}
        <View
          style={[
            styles.heatmapSection,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.text,
            },
          ]}
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

        {/* Achievement Section */}
        <View
          style={[
            styles.achievementSection,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.text,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🏆 Achievements
          </Text>
          <View style={styles.achievementGrid}>
            {achievements.map((achievement) => (
              <View key={achievement.id} style={styles.achievementItem}>
                <View
                  style={[
                    styles.achievementBadge,
                    {
                      backgroundColor: achievement.unlocked
                        ? "#007AFF"
                        : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={achievement.unlocked ? "trophy" : "trophy-outline"}
                    size={20}
                    color={achievement.unlocked ? "#fff" : colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.achievementText,
                    {
                      color: achievement.unlocked
                        ? colors.text
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {achievement.name}
                </Text>
                {achievement.unlocked && achievement.unlockedDate && (
                  <Text
                    style={[
                      styles.achievementDate,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatStreakDate(achievement.unlockedDate)}
                  </Text>
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  // Widget styles
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
    fontSize: 14,
    marginTop: 2,
    fontWeight: "600",
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
    fontSize: 14,
    marginTop: 2,
    fontWeight: "600",
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
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 1,
  },
  heatmapDay: {
    flex: 1,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  heatmapDayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  legendLabel: {
    fontSize: 12,
    marginHorizontal: 8,
  },
  legendColors: {
    flexDirection: "row",
    gap: 3,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  // Achievement styles
  achievementSection: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  achievementItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    marginBottom: 8,
  },
  achievementBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  achievementText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  achievementDate: {
    fontSize: 10,
    marginTop: 2,
  },
});