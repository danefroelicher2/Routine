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

// NEW: Achievement interface
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

  // NEW: Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // NEW: Achievement targets (in days)
  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 90, 120, 150, 200, 250, 300, 365,
  ];

  // ADDED: Load data when screen comes into focus (real-time updates)
  useFocusEffect(
    useCallback(() => {
      loadStatsData();
    }, [currentDate])
  );

  useEffect(() => {
    loadStatsData();
  }, [currentDate]);

  const loadStatsData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get first and last day of current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // FIXED: Get both completions and user routines (not "routines" table)
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          // Get completions for the month
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", user.id)
            .gte("completion_date", firstDay.toISOString().split("T")[0])
            .lte("completion_date", lastDay.toISOString().split("T")[0]),
          // Get all active user routines
          supabase
            .from("user_routines")
            .select("id, is_weekly")
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

      // FIXED: Build day-specific routines mapping
      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });

      // UPDATED: Process success data using the correct table structure
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

        // Get completions for this date
        const dayCompletions = completions.filter(
          (c) => c.completion_date === dateStr
        );
        const completedRoutineIds = dayCompletions.map((c) => c.routine_id);

        // Check if ALL daily routines are completed
        const allCompleted =
          dailyRoutines.length > 0 &&
          dailyRoutines.every((routine) =>
            completedRoutineIds.includes(routine.id)
          );

        successData.push({
          date: dateStr,
          completionCount: allCompleted ? 1 : 0, // 1 = success, 0 = not complete
        });
      }

      setCompletionData(successData);

      // Calculate streaks based on success days
      await calculateStreaks(user.id);

      // NEW: Calculate achievements
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
        }

        if (allCompleted) {
          successDays.add(date);
        }
      });

      console.log("Success days found:", Array.from(successDays));

      const successDatesArray = Array.from(successDays).sort();

      // Calculate current streak
      let currentStreakCount = 0;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      console.log("Checking streak starting from today or yesterday...");
      console.log("- Today success:", successDays.has(today));
      console.log("- Yesterday success:", successDays.has(yesterday));

      if (successDays.has(today) || successDays.has(yesterday)) {
        let currentDate = successDays.has(today) ? today : yesterday;
        console.log("Starting streak count from:", currentDate);

        while (successDays.has(currentDate)) {
          currentStreakCount++;
          console.log(
            `- Day ${currentDate} counts, streak now: ${currentStreakCount}`
          );
          const prevDate = new Date(currentDate);
          prevDate.setDate(prevDate.getDate() - 1);
          currentDate = prevDate.toISOString().split("T")[0];
        }
      }

      console.log("FINAL CURRENT STREAK:", currentStreakCount);
      setCurrentStreak(currentStreakCount);

      // Calculate longest streak (simplified for now)
      let maxStreak = 0;
      let maxStreakStart = "";
      let maxStreakEnd = "";
      let isMaxStreakOngoing = false;

      if (successDatesArray.length > 0) {
        let tempStreak = 1;
        let tempStart = successDatesArray[0];

        for (let i = 1; i < successDatesArray.length; i++) {
          const prevDate = new Date(successDatesArray[i - 1]);
          const currDate = new Date(successDatesArray[i]);
          const dayDiff =
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            tempStreak++;
          } else {
            if (tempStreak > maxStreak) {
              maxStreak = tempStreak;
              maxStreakStart = tempStart;
              maxStreakEnd = successDatesArray[i - 1];
              isMaxStreakOngoing = false;
            }
            tempStreak = 1;
            tempStart = successDatesArray[i];
          }
        }

        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
          maxStreakStart = tempStart;
          maxStreakEnd = successDatesArray[successDatesArray.length - 1];
          isMaxStreakOngoing =
            maxStreakEnd === today || maxStreakEnd === yesterday;
        }
      }

      console.log("FINAL LONGEST STREAK:", maxStreak);

      setLongestStreak({
        length: maxStreak,
        startDate: maxStreakStart,
        endDate: maxStreakEnd,
        isOngoing: isMaxStreakOngoing,
      });
    } catch (error) {
      console.error("Error calculating streaks:", error);
    }
  };

  // NEW: Calculate achievements based on streak data
  const calculateAchievements = useCallback(async (userId: string) => {
    try {
      // Get all historical streak data to check for past achievements
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

      // Build day-routine mapping (same logic as streak calculation)
      const dayRoutineMap: Record<number, string[]> = {};
      dayAssignments.forEach((assignment) => {
        if (!dayRoutineMap[assignment.day_of_week]) {
          dayRoutineMap[assignment.day_of_week] = [];
        }
        dayRoutineMap[assignment.day_of_week].push(assignment.routine_id);
      });

      // Create success days map
      const successDays = new Set<string>();
      const completionsByDate = new Map<string, string[]>();

      completions.forEach((completion) => {
        const date = completion.completion_date;
        if (!completionsByDate.has(date)) {
          completionsByDate.set(date, []);
        }
        completionsByDate.get(date)!.push(completion.routine_id);
      });

      // Check each date for success (same logic as streak calculation)
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
      const allStreaks: {
        length: number;
        startDate: string;
        endDate: string;
      }[] = [];

      if (successDatesArray.length > 0) {
        let currentStreakLength = 1;
        let currentStreakStart = successDatesArray[0];

        for (let i = 1; i < successDatesArray.length; i++) {
          const prevDate = new Date(successDatesArray[i - 1]);
          const currDate = new Date(successDatesArray[i]);
          const dayDiff =
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            // Consecutive day
            currentStreakLength++;
          } else {
            // Streak broken, record the streak
            allStreaks.push({
              length: currentStreakLength,
              startDate: currentStreakStart,
              endDate: successDatesArray[i - 1],
            });
            currentStreakLength = 1;
            currentStreakStart = successDatesArray[i];
          }
        }

        // Don't forget the last streak
        allStreaks.push({
          length: currentStreakLength,
          startDate: currentStreakStart,
          endDate: successDatesArray[successDatesArray.length - 1],
        });
      }

      // Create achievements array
      const newAchievements: Achievement[] = ACHIEVEMENT_TARGETS.map(
        (target) => {
          // Check if any streak has reached this target
          const unlockedStreak = allStreaks.find(
            (streak) => streak.length >= target
          );

          return {
            id: `streak_${target}`,
            name: `${target} Day${target > 1 ? "s" : ""} in a Row`,
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

  // ADDED: Pull-to-refresh handler
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
    // UPDATED: Binary success tracking - only light green for complete success, transparent otherwise
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

      days.push(
        <View key={day} style={styles.heatmapCell}>
          <View
            style={[
              styles.heatmapDay,
              { backgroundColor: getIntensityColor(completionCount) },
            ]}
          >
            <Text style={styles.heatmapDayText}>{day}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.heatmapGrid}>
        <View style={styles.dayLabels}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text key={index} style={styles.dayLabel}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>{days}</View>
      </View>
    );
  };

  const getCurrentStreakMessage = () => {
    if (currentStreak === 0) {
      return "Start your journey!";
    } else if (currentStreak === 1) {
      return "Great start!";
    } else if (currentStreak < 7) {
      return "Building momentum!";
    } else if (currentStreak < 30) {
      return "You're on fire! 🔥";
    } else {
      return "Incredible dedication! 🌟";
    }
  };

  // NEW: Render achievements section
  const renderAchievements = () => {
    return (
      <View style={styles.achievementsSection}>
        <View style={styles.achievementsHeader}>
          <Ionicons name="trophy" size={24} color="#ffd700" />
          <Text style={styles.achievementsTitle}>Achievements</Text>
        </View>

        <View style={styles.achievementsGrid}>
          {achievements.map((achievement, index) => (
            <View
              key={achievement.id}
              style={[
                styles.achievementBadge,
                achievement.unlocked
                  ? styles.achievementUnlocked
                  : styles.achievementLocked,
              ]}
            >
              <View
                style={[
                  styles.achievementCircle,
                  achievement.unlocked
                    ? styles.achievementCircleUnlocked
                    : styles.achievementCircleLocked,
                ]}
              >
                <Text
                  style={[
                    styles.achievementNumber,
                    achievement.unlocked
                      ? styles.achievementNumberUnlocked
                      : styles.achievementNumberLocked,
                  ]}
                >
                  {achievement.target}
                </Text>
              </View>
              <Text
                style={[
                  styles.achievementText,
                  achievement.unlocked
                    ? styles.achievementTextUnlocked
                    : styles.achievementTextLocked,
                ]}
              >
                {achievement.name}
              </Text>
              {achievement.unlocked && achievement.unlockedDate && (
                <Text style={styles.achievementUnlockedDate}>
                  Unlocked{" "}
                  {new Date(achievement.unlockedDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* NEW: Widget-style streak boxes */}
        <View style={styles.widgetContainer}>
          {/* Current Streak Widget */}
          <View style={[styles.widget, styles.currentStreakWidget]}>
            <View style={styles.widgetContent}>
              <Text style={styles.currentStreakNumber}>{currentStreak}</Text>
              <Text style={styles.currentStreakLabel}>
                day{currentStreak !== 1 ? "s" : ""} in a row
              </Text>
              <Text style={styles.currentStreakMessage}>
                {getCurrentStreakMessage()}
              </Text>
            </View>
            <View style={styles.widgetIcon}>
              <Ionicons
                name={currentStreak > 0 ? "flame" : "flame-outline"}
                size={32}
                color={currentStreak > 0 ? "#ff6b35" : "#ccc"}
              />
            </View>
          </View>

          {/* Longest Streak Widget */}
          <View style={[styles.widget, styles.longestStreakWidget]}>
            <View style={styles.widgetContent}>
              <Text style={styles.longestStreakNumber}>
                {longestStreak.length}
              </Text>
              <Text style={styles.longestStreakLabel}>longest streak</Text>
              <Text style={styles.longestStreakDates}>
                {getStreakDateRange()}
              </Text>
            </View>
            <View style={styles.widgetIcon}>
              <Ionicons name="trophy" size={32} color="#ffd700" />
            </View>
          </View>
        </View>

        {/* Monthly Heatmap */}
        <View style={styles.heatmapSection}>
          <View style={styles.heatmapHeader}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth("prev")}
            >
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>{getMonthName(currentDate)}</Text>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth("next")}
            >
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {renderHeatmapCalendar()}

          {/* UPDATED: Success tracker legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Incomplete</Text>
            <View style={styles.legendColors}>
              <View
                style={[
                  styles.legendColor,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "#ebedf0",
                  },
                ]}
              />
              <View
                style={[styles.legendColor, { backgroundColor: "#c6e48b" }]}
              />
            </View>
            <Text style={styles.legendLabel}>All Complete</Text>
          </View>
        </View>

        {/* NEW: Achievements Section */}
        {renderAchievements()}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  },
  scrollView: {
    flex: 1,
  },
  // NEW: Widget container and styles
  widgetContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  widget: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentStreakWidget: {
    backgroundColor: "#fff",
  },
  longestStreakWidget: {
    backgroundColor: "#fff",
  },
  widgetContent: {
    flex: 1,
  },
  widgetIcon: {
    marginLeft: 12,
  },
  currentStreakNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff6b35",
    lineHeight: 36,
  },
  currentStreakLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  currentStreakMessage: {
    fontSize: 12,
    color: "#ff6b35",
    marginTop: 4,
    fontWeight: "500",
  },
  longestStreakNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffd700",
    lineHeight: 36,
  },
  longestStreakLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  longestStreakDates: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  // Existing heatmap styles
  heatmapSection: {
    backgroundColor: "#fff",
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
    color: "#333",
  },
  heatmapGrid: {
    alignItems: "center",
  },
  dayLabels: {
    flexDirection: "row",
    marginBottom: 10,
    width: width - 80,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: width - 80,
  },
  heatmapCell: {
    width: (width - 80) / 7,
    height: (width - 80) / 7,
    margin: 1,
  },
  heatmapDay: {
    flex: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  heatmapDayText: {
    fontSize: 12,
    color: "#333",
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
    color: "#666",
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
  // NEW: Achievements Section Styles
  achievementsSection: {
    backgroundColor: "#fff",
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  achievementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  achievementBadge: {
    width: (width - 80) / 3, // 3 badges per row with margins
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  achievementUnlocked: {
    backgroundColor: "#f8fffe",
    borderWidth: 2,
    borderColor: "#00d4aa",
  },
  achievementLocked: {
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "#e9ecef",
  },
  achievementCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  achievementCircleUnlocked: {
    backgroundColor: "#00d4aa",
  },
  achievementCircleLocked: {
    backgroundColor: "#ccc",
  },
  achievementNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },
  achievementNumberUnlocked: {
    color: "#fff",
  },
  achievementNumberLocked: {
    color: "#999",
  },
  achievementText: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 16,
  },
  achievementTextUnlocked: {
    color: "#00d4aa",
  },
  achievementTextLocked: {
    color: "#999",
  },
  achievementUnlockedDate: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
});
