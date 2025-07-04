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
    } catch (error) {
      console.error("Error loading stats:", error);
      Alert.alert("Error", "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const calculateStreaks = async (userId: string) => {
    try {
      // FIXED: Simplified streak calculation - get all completion dates first
      const { data: completions, error } = await supabase
        .from("routine_completions")
        .select("completion_date")
        .eq("user_id", userId)
        .order("completion_date", { ascending: false });

      if (error) throw error;

      if (!completions || completions.length === 0) {
        setCurrentStreak(0);
        setLongestStreak({
          length: 0,
          startDate: "",
          endDate: "",
          isOngoing: false,
        });
        return;
      }

      // Get unique completion dates and sort them
      const uniqueDates = [
        ...new Set(completions.map((c) => c.completion_date)),
      ].sort();

      // RESTORED: Original current streak calculation that was working
      let currentStreakCount = 0;
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Check if there's activity today or yesterday to start counting
      if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
        let currentDate = uniqueDates.includes(today) ? today : yesterday;
        let currentIndex = uniqueDates.indexOf(currentDate);

        // Count consecutive days backwards
        while (currentIndex >= 0) {
          const expectedDate = new Date(currentDate);
          if (
            uniqueDates[currentIndex] ===
            expectedDate.toISOString().split("T")[0]
          ) {
            currentStreakCount++;
            currentIndex--;
            expectedDate.setDate(expectedDate.getDate() - 1);
            currentDate = expectedDate.toISOString().split("T")[0];
          } else {
            break;
          }
        }
      }

      setCurrentStreak(currentStreakCount);

      // RESTORED: Original longest streak calculation that was working
      let maxStreak = 0;
      let maxStreakStart = "";
      let maxStreakEnd = "";
      let isMaxStreakOngoing = false;

      if (uniqueDates.length > 0) {
        let tempStreak = 1;
        let tempStart = uniqueDates[0];

        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDate = new Date(uniqueDates[i - 1]);
          const currDate = new Date(uniqueDates[i]);
          const dayDiff =
            (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            // Consecutive day
            tempStreak++;
          } else {
            // Streak broken, check if it's the longest
            if (tempStreak > maxStreak) {
              maxStreak = tempStreak;
              maxStreakStart = tempStart;
              maxStreakEnd = uniqueDates[i - 1];
              isMaxStreakOngoing = false;
            }
            // Start new streak
            tempStreak = 1;
            tempStart = uniqueDates[i];
          }
        }

        // Check final streak
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
          maxStreakStart = tempStart;
          maxStreakEnd = uniqueDates[uniqueDates.length - 1];
          // Check if this streak is ongoing (ends today or yesterday)
          isMaxStreakOngoing =
            maxStreakEnd === today || maxStreakEnd === yesterday;
        }
      }

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
});
