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
  SafeAreaView,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { RoutineCompletion } from "../../types/database";
import { useTheme } from "../../../ThemeContext";
import { TouchableOpacity } from 'react-native'; // If not already imported
import { usePremium } from '../../contexts/PremiumContext';
import { useNavigation } from '@react-navigation/native';


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

// Enhanced Achievement interface
interface Achievement {
  id: string;
  name: string;
  target: number;
  unlocked: boolean;
  unlockedDate?: string;
  icon: string;
  level: string;
  color: string;
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

// ✅ NEW: Stats version that handles BOTH home screen variations (normal + calendar)
const checkDailyCompletionStatusForStats = (
  userId: string,
  dateStr: string,
  dayOfWeek: number,
  userRoutines: any[],
  completedRoutineIds: string[],
  dayRoutineMap: Record<number, string[]>
): boolean => {
  // Get routines assigned to this day of week (normal view)
  const todayDailyRoutineIds = dayRoutineMap[dayOfWeek] || [];

  // Filter to get active daily routines assigned to this day
  const todayDailyRoutines = userRoutines.filter(
    (routine) => !routine.is_weekly &&
      (routine.is_active === undefined || routine.is_active === true) &&
      todayDailyRoutineIds.includes(routine.id)
  );

  // IMPORTANT: Also count ANY daily (non-weekly) routine that was completed today
  // This captures calendar view completions that might not be in day assignments
  const allCompletedDailyRoutines = userRoutines.filter(
    (routine) => !routine.is_weekly &&
      (routine.is_active === undefined || routine.is_active === true) &&
      completedRoutineIds.includes(routine.id)
  );

  // Check which assigned routines are completed
  const completedAssignedRoutines = todayDailyRoutines.filter(
    routine => completedRoutineIds.includes(routine.id)
  );

  // FLEXIBLE COMPLETION LOGIC:
  // Option 1: User completed ALL their assigned routines (perfect day for normal view)
  const allAssignedCompleted = todayDailyRoutines.length > 0 &&
    todayDailyRoutines.every((routine) => completedRoutineIds.includes(routine.id));

  // Option 2: User completed at least 2 daily routines total (including calendar view)
  const enoughRoutinesCompleted = allCompletedDailyRoutines.length >= 2;

  // Option 3: User has no assigned routines but completed some daily routines
  const noAssignedButCompleted = todayDailyRoutines.length === 0 && allCompletedDailyRoutines.length >= 1;

  // Use the most flexible check - ANY of these conditions
  const isConsideredComplete = allAssignedCompleted || enoughRoutinesCompleted || noAssignedButCompleted;

  // Enhanced logging for today
  const today = getLocalDateString(new Date());
  if (dateStr === today) {
    console.log("🟢 STATS: TODAY'S COMPLETION CHECK (MULTI-VIEW):");
    console.log("  - Date (LOCAL):", dateStr);
    console.log("  - Day of week:", dayOfWeek);
    console.log("  - Assigned routine IDs:", todayDailyRoutineIds);
    console.log("  - Assigned routine names:", todayDailyRoutines.map((r) => r.name || r.id));
    console.log("  - ALL completed routine IDs:", completedRoutineIds);
    console.log("  - Completed assigned routines:", completedAssignedRoutines.map((r) => r.name || r.id));
    console.log("  - ALL completed daily routines:", allCompletedDailyRoutines.map((r) => r.name || r.id));
    console.log("  - Assigned count:", todayDailyRoutines.length);
    console.log("  - Completed assigned count:", completedAssignedRoutines.length);
    console.log("  - Total daily completed count:", allCompletedDailyRoutines.length);
    console.log("  - All assigned completed?", allAssignedCompleted);
    console.log("  - Enough routines (2+)?", enoughRoutinesCompleted);
    console.log("  - No assigned but completed some?", noAssignedButCompleted);
    console.log("  - FINAL DECISION:", isConsideredComplete ? "✅ GREEN" : "❌ TRANSPARENT");
  }

  return isConsideredComplete;
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
  const { isPremium } = usePremium();
  const navigation = useNavigation<any>();

  // Achievement targets with levels and themed badges
  const ACHIEVEMENT_LEVELS = [
    // BEGINNER (Bronze theme)
    { days: 3, name: "First Steps", icon: "🌱", level: "Beginner", color: "#CD7F32" },
    { days: 5, name: "Getting Started", icon: "🌟", level: "Beginner", color: "#CD7F32" },
    { days: 7, name: "One Week Wonder", icon: "✨", level: "Beginner", color: "#CD7F32" },

    // BUILDER (Silver theme)
    { days: 14, name: "Habit Builder", icon: "🔨", level: "Builder", color: "#C0C0C0" },
    { days: 30, name: "Monthly Master", icon: "📅", level: "Builder", color: "#C0C0C0" },
    { days: 60, name: "Committed", icon: "💪", level: "Builder", color: "#C0C0C0" },

    // CHAMPION (Gold theme)
    { days: 100, name: "Century Club", icon: "💯", level: "Champion", color: "#FFD700" },
    { days: 150, name: "Unstoppable", icon: "🚀", level: "Champion", color: "#FFD700" },
    { days: 200, name: "Legendary Focus", icon: "🎯", level: "Champion", color: "#FFD700" },
    { days: 250, name: "Elite Performer", icon: "⭐", level: "Champion", color: "#FFD700" },

    // LEGEND (Purple/Diamond theme)
    { days: 300, name: "Near Mythical", icon: "👑", level: "Legend", color: "#9B59B6" },
    { days: 365, name: "Year of Glory", icon: "💎", level: "Legend", color: "#9B59B6" },
  ];

  // Keep the simple array for compatibility
  const ACHIEVEMENT_TARGETS = ACHIEVEMENT_LEVELS.map(a => a.days);

  // ENHANCED: Load data when screen comes into focus (real-time updates)
  useFocusEffect(
    useCallback(() => {
      console.log("📊 STATS SCREEN: Focused - checking for updates");

      // Check for update flag from home screen
      const checkAndLoadData = async () => {
        try {
          const updateFlag = await AsyncStorage.getItem('stats_needs_update');
          console.log("📊 STATS SCREEN: Checking update flag:", updateFlag);

          if (updateFlag) {
            const flagData = JSON.parse(updateFlag);
            console.log("📊 STATS SCREEN: Update flag found:", flagData);
            await AsyncStorage.removeItem('stats_needs_update');
            console.log("📊 STATS SCREEN: Update flag cleared");
          }

          // Always load data with a delay
          console.log("📊 STATS SCREEN: Loading data in 300ms...");
          setTimeout(() => {
            console.log("📊 STATS SCREEN: Loading data NOW");
            loadStatsData();
          }, 300);

        } catch (error) {
          console.error("📊 STATS SCREEN: Error checking update flag:", error);
          // Load data anyway
          setTimeout(() => {
            loadStatsData();
          }, 300);
        }
      };

      checkAndLoadData();

      return () => {
        console.log("📊 STATS SCREEN: Cleanup - focus lost");
      };
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
          // Get all active user routines with is_active field
          supabase
            .from("user_routines")
            .select("id, is_weekly, name, is_active") // Added is_active
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
            .select("id, is_weekly, is_active")
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
      console.log("📊 STATS: Calculating achievements using current streak data");

      // Use the already calculated streak data instead of recalculating
      const currentLongestStreak = longestStreak.length;

      // Create achievements based on the longest streak we've already calculated
      const newAchievements: Achievement[] = ACHIEVEMENT_LEVELS.map((achievement) => {
        const isUnlocked = currentLongestStreak >= achievement.days;
        return {
          id: `streak_${achievement.days}`,
          name: achievement.name,
          target: achievement.days,
          unlocked: isUnlocked,
          unlockedDate: isUnlocked ? longestStreak.endDate : undefined,
          icon: achievement.icon,
          level: achievement.level,
          color: achievement.color,
        };
      });

      console.log("📊 STATS: Achievements calculated:", {
        longestStreak: currentLongestStreak,
        unlockedCount: newAchievements.filter(a => a.unlocked).length,
        totalCount: newAchievements.length
      });

      setAchievements(newAchievements);
    } catch (error) {
      console.error("Error calculating achievements:", error);
    }
  }, [longestStreak]);

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
                  { color: colors.text },
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

          {/* Longest Streak Widget - PREMIUM PROTECTED */}
          <TouchableOpacity
            style={[
              styles.widget,
              styles.longestStreakWidget,
              {
                backgroundColor: colors.surface,
                shadowColor: colors.text,
              },
            ]}
            onPress={() => {
              if (!isPremium) {
                console.log("🚫 Non-premium user trying to view best streak - redirecting to premium");
                (navigation as any).navigate('Premium', { source: 'best_streak' });
              }
            }}
            activeOpacity={isPremium ? 1 : 0.7}
          >
            <View style={styles.widgetContent}>
              {isPremium ? (
                <>
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
                </>
              ) : (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={20} color="#007AFF" />
                  <Text style={[styles.premiumText, { color: colors.text }]}>
                    best streak
                  </Text>
                  <Text style={[styles.premiumSubtext, { color: colors.textSecondary }]}>
                    Tap to unlock
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.widgetIcon}>
              <Ionicons
                name={isPremium && longestStreak.length > 0 ? "trophy" : "lock-closed"}
                size={32}
                color={isPremium && longestStreak.length > 0 ? "#ffd700" : "#007AFF"}
              />
            </View>
          </TouchableOpacity>
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

        {/* Enhanced Achievement Section */}
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
            🏆 Achievement Levels
          </Text>

          {/* Group achievements by level */}
          {["Beginner", "Builder", "Champion", "Legend"].map((levelName) => {
            const levelAchievements = achievements.filter(a => a.level === levelName);
            const levelColor = levelAchievements[0]?.color || "#007AFF";
            const unlockedCount = levelAchievements.filter(a => a.unlocked).length;
            const totalCount = levelAchievements.length;

            return (
              <View key={levelName} style={styles.levelSection}>
                <View style={styles.levelHeader}>
                  <Text style={[styles.levelTitle, { color: levelColor }]}>
                    {levelName.toUpperCase()}
                  </Text>
                  <Text style={[styles.levelProgress, { color: colors.textSecondary }]}>
                    {unlockedCount}/{totalCount}
                  </Text>
                </View>

                <View style={styles.levelAchievements}>
                  {levelAchievements.map((achievement) => (
                    <View
                      key={achievement.id}
                      style={[
                        styles.enhancedAchievementItem,
                        achievement.unlocked && styles.achievementUnlocked
                      ]}
                    >
                      <View
                        style={[
                          styles.enhancedBadge,
                          {
                            backgroundColor: achievement.unlocked
                              ? achievement.color
                              : colors.background,
                            borderColor: achievement.unlocked
                              ? achievement.color
                              : colors.border,
                          },
                        ]}
                      >
                        <Text style={styles.badgeIcon}>
                          {achievement.unlocked ? achievement.icon : "🔒"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.enhancedAchievementName,
                          {
                            color: achievement.unlocked
                              ? colors.text
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {achievement.name}
                      </Text>
                      <Text
                        style={[
                          styles.achievementDays,
                          {
                            color: achievement.unlocked
                              ? achievement.color
                              : colors.textTertiary,
                          },
                        ]}
                      >
                        {achievement.target} days
                      </Text>
                      {achievement.unlocked && achievement.unlockedDate && (
                        <Text
                          style={[
                            styles.unlockedDate,
                            { color: colors.textSecondary },
                          ]}
                        >
                          ✓ {formatStreakDate(achievement.unlockedDate)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>



      </ScrollView>
    </SafeAreaView >
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
  lockOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  premiumText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  premiumSubtext: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
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
  // Level-based styles
  levelSection: {
    marginBottom: 24,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  levelProgress: {
    fontSize: 12,
    fontWeight: "600",
  },
  levelAchievements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  enhancedAchievementItem: {
    alignItems: "center",
    width: "30%",
    marginBottom: 8,
    opacity: 0.6,
  },
  achievementUnlocked: {
    opacity: 1,
  },
  enhancedBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeIcon: {
    fontSize: 28,
  },
  enhancedAchievementName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  achievementDays: {
    fontSize: 10,
    fontWeight: "500",
  },
  unlockedDate: {
    fontSize: 9,
    marginTop: 2,
  },
});