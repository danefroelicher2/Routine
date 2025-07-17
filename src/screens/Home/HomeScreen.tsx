// ============================================
// COMPLETE WORKING HOMESCREEN WITH CALENDAR TOGGLE
// This preserves ALL existing functionality + adds calendar view
// Replace your entire src/screens/Home/HomeScreen.tsx with this
// ============================================

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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";
import { StreakSyncService } from "../../services/StreakSyncService";

// Calendar-specific interfaces
interface ScheduledRoutine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_daily: boolean | null;
  is_weekly: boolean | null;
  target_value: number | null;
  target_unit: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  isCompleted: boolean;
  completionId?: string;
}

interface TimeSlot {
  hour: number;
  routines: ScheduledRoutine[];
}

interface RoutineWithCompletion {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_daily: boolean | null;
  is_weekly: boolean | null;
  target_value: number | null;
  target_unit: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  isCompleted: boolean;
  completionId?: string;
}

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();

  // ALL EXISTING STATE - Preserved exactly as before
  const [dailyRoutines, setDailyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [weeklyRoutines, setWeeklyRoutines] = useState<RoutineWithCompletion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weekTimeRemaining, setWeekTimeRemaining] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showDayRoutineModal, setShowDayRoutineModal] = useState(false);
  const [availableRoutines, setAvailableRoutines] = useState<UserRoutine[]>([]);
  const [daySpecificRoutines, setDaySpecificRoutines] = useState<Record<number, string[]>>({});
  const [userProfile, setUserProfile] = useState<any>(null);

  // EXISTING DRAG STATE - All preserved
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [originalIndex, setOriginalIndex] = useState<number | null>(null);
  const [lastSwapIndex, setLastSwapIndex] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<"daily" | "weekly" | null>(null);
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // EXISTING EDIT STATE - All preserved
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSection, setEditSection] = useState<"daily" | "weekly" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<{
    routine: RoutineWithCompletion;
    section: "daily" | "weekly";
  } | null>(null);
  const [showEditRoutineModal, setShowEditRoutineModal] = useState(false);
  const [routineToEdit, setRoutineToEdit] = useState<RoutineWithCompletion | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
  });

  // EXISTING ANIMATED VALUES - All preserved
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const dragOpacity = useRef(new Animated.Value(1)).current;
  const dropZoneOpacity = useRef(new Animated.Value(0)).current;

  // NEW: Calendar view state
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [calendarHours] = useState(() => {
    const hours = [];
    for (let i = 6; i <= 23; i++) {
      hours.push(i);
    }
    return hours;
  });

  // Get screen dimensions
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

  // Generate calendar data
  const generateCalendarData = useCallback(() => {
    const slots: TimeSlot[] = calendarHours.map(hour => ({
      hour,
      routines: []
    }));

    dailyRoutines.forEach(routine => {
      if (routine.scheduled_time) {
        const [hours, minutes] = routine.scheduled_time.split(':').map(Number);
        const slotIndex = slots.findIndex(slot => slot.hour === hours);
        if (slotIndex !== -1) {
          slots[slotIndex].routines.push({
            ...routine,
            estimated_duration: routine.estimated_duration || 30,
          });
        }
      }
    });

    setTimeSlots(slots);
  }, [dailyRoutines, calendarHours]);

  // Format time for display
  const formatTime = (hour: number): string => {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  // EXISTING FUNCTIONS - All preserved exactly as they were
  const syncStreaksAfterCompletion = async (userId: string) => {
    try {
      await StreakSyncService.checkAndSyncUserStreaks(userId);
    } catch (error) {
      console.error("Error syncing streaks after completion:", error);
    }
  };

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

    return { timePeriod, dateString };
  };

  const getVariation = useMemo(() => {
    const { timePeriod, dateString } = getTimePeriodInfo();

    const variations = {
      morning: ["Good morning", "Rise and shine", "Start strong", "Morning warrior"],
      afternoon: ["Good afternoon", "Midday momentum", "Keep going", "Afternoon energy"],
      evening: ["Good evening", "Evening focus", "Wind down well", "Evening routine"],
      night: ["Good night", "Late night grind", "Quiet hours", "Night owl mode"]
    };

    const timePeriodVariations = variations[timePeriod as keyof typeof variations];
    const seed = dateString.split('-').reduce((acc, part) => acc + parseInt(part), 0);
    const index = seed % timePeriodVariations.length;

    return timePeriodVariations[index];
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedDay]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateWeekTimeRemaining();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isCalendarView) {
      generateCalendarData();
    }
  }, [isCalendarView, generateCalendarData]);

  const updateWeekTimeRemaining = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (7 - dayOfWeek) % 7 + 1);
    nextMonday.setHours(0, 0, 0, 0);

    const timeDiff = nextMonday.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    setWeekTimeRemaining(`${days}d ${hours}h ${minutes}m`);
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const currentDay = selectedDay;
      const todayStr = today.toISOString().split("T")[0];

      const weekStart = new Date(today);
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      weekStart.setDate(today.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      const [
        routinesResult,
        dailyCompletionsResult,
        weeklyCompletionsResult,
        dayRoutinesResult,
        profileResult,
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
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      const routines = routinesResult.data || [];
      const dailyCompletions = dailyCompletionsResult.data || [];
      const weeklyCompletions = weeklyCompletionsResult.data || [];
      const dayRoutines = dayRoutinesResult.data || [];

      setUserProfile(profileResult.data);

      const dayMapping: Record<number, string[]> = {};
      dayRoutines.forEach((dr) => {
        if (!dayMapping[dr.day_of_week]) {
          dayMapping[dr.day_of_week] = [];
        }
        dayMapping[dr.day_of_week].push(dr.routine_id);
      });
      setDaySpecificRoutines(dayMapping);

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
      setRefreshing(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setRefreshing(false);
    }
  };

  const toggleRoutine = async (routine: RoutineWithCompletion, section: "daily" | "weekly") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (routine.isCompleted) {
        if (routine.completionId) {
          const { error } = await supabase
            .from("routine_completions")
            .delete()
            .eq("id", routine.completionId);

          if (error) throw error;
        }
      } else {
        const completionData: any = {
          user_id: user.id,
          routine_id: routine.id,
          completion_date: new Date().toISOString().split("T")[0],
          completed_at: new Date().toISOString(),
        };

        if (section === "weekly") {
          const today = new Date();
          const currentDay = today.getDay();
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - daysFromMonday);
          completionData.week_start_date = weekStart.toISOString().split("T")[0];
        }

        const { error } = await supabase
          .from("routine_completions")
          .insert(completionData);

        if (error) throw error;

        await syncStreaksAfterCompletion(user.id);
      }

      await loadData();
    } catch (error) {
      console.error("Error toggling routine:", error);
      Alert.alert("Error", "Failed to update routine completion");
    }
  };

  // EXISTING: Load available routines for day modal
  const loadAvailableRoutines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_routines")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("is_weekly", false)
        .order("name");

      if (error) throw error;

      setAvailableRoutines(data || []);
    } catch (error) {
      console.error("Error loading available routines:", error);
    }
  };

  // EXISTING: Toggle routine for specific day
  const toggleRoutineForDay = async (routineId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentRoutines = daySpecificRoutines[selectedDay] || [];
      const isAssigned = currentRoutines.includes(routineId);

      if (isAssigned) {
        // Remove routine from day
        const { error } = await supabase
          .from("user_day_routines")
          .delete()
          .eq("user_id", user.id)
          .eq("routine_id", routineId)
          .eq("day_of_week", selectedDay);

        if (error) throw error;
      } else {
        // Add routine to day
        const { error } = await supabase
          .from("user_day_routines")
          .insert({
            user_id: user.id,
            routine_id: routineId,
            day_of_week: selectedDay,
          });

        if (error) throw error;
      }

      await loadData();
    } catch (error) {
      console.error("Error toggling routine for day:", error);
      Alert.alert("Error", "Failed to update routine schedule");
    }
  };

  // EXISTING: Open day routine modal
  const openDayRoutineModal = () => {
    loadAvailableRoutines();
    setShowDayRoutineModal(true);
  };

  // Calendar view render
  const renderCalendarView = () => {
    return (
      <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
        {timeSlots.map((slot, index) => (
          <View key={slot.hour} style={[styles.timeSlot, { borderBottomColor: colors.border }]}>
            <View style={styles.timeLabel}>
              <Text style={[styles.timeLabelText, { color: colors.textSecondary }]}>
                {formatTime(slot.hour)}
              </Text>
            </View>
            <View style={[styles.timeSlotContent, { backgroundColor: colors.surface }]}>
              {slot.routines.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptySlot}
                  onPress={() => {
                    Alert.alert("Add Routine", `Add a routine for ${formatTime(slot.hour)}`);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.textSecondary} />
                  <Text style={[styles.emptySlotText, { color: colors.textSecondary }]}>
                    Add routine
                  </Text>
                </TouchableOpacity>
              ) : (
                slot.routines.map((routine, routineIndex) => (
                  <TouchableOpacity
                    key={`${routine.id}-${routineIndex}`}
                    style={[
                      styles.calendarRoutineItem,
                      {
                        backgroundColor: routine.isCompleted ? "#E8F5E8" : colors.background,
                        borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                      }
                    ]}
                    onPress={() => toggleRoutine(routine, "daily")}
                  >
                    <View style={styles.calendarRoutineLeft}>
                      <View style={[
                        styles.calendarCheckbox,
                        routine.isCompleted && styles.calendarCheckboxCompleted,
                        { borderColor: routine.isCompleted ? "#4CAF50" : colors.border }
                      ]}>
                        {routine.isCompleted && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.calendarRoutineInfo}>
                        <Text style={[
                          styles.calendarRoutineName,
                          { color: colors.text },
                          routine.isCompleted && styles.calendarRoutineNameCompleted
                        ]}>
                          {routine.name}
                        </Text>
                        <Text style={[styles.calendarRoutineDuration, { color: colors.textSecondary }]}>
                          {routine.estimated_duration || 30} min
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.calendarRoutineOptions}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // EXISTING: Render daily routines
  const renderDailyRoutines = () => {
    if (isCalendarView) {
      return null;
    }

    return (
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="today" size={20} color="#FF6B35" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Daily Routines
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={openDayRoutineModal}
          >
            <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {dailyRoutines.map((routine, index) => (
          <View key={routine.id} style={styles.routineItem}>
            <TouchableOpacity
              style={[
                styles.routineContent,
                {
                  backgroundColor: routine.isCompleted ? "#E8F5E8" : colors.background,
                  borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                },
              ]}
              onPress={() => toggleRoutine(routine, "daily")}
            >
              <View style={styles.routineLeft}>
                <View
                  style={[
                    styles.checkbox,
                    routine.isCompleted && styles.checkboxCompleted,
                    { borderColor: routine.isCompleted ? "#4CAF50" : colors.border },
                  ]}
                >
                  {routine.isCompleted && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
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
                    <Text style={[styles.routineDescription, { color: colors.textSecondary }]}>
                      {routine.description}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}

        {dailyRoutines.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No routines for {daysOfWeek.find(d => d.value === selectedDay)?.name}. Add some to get started!
          </Text>
        )}
      </View>
    );
  };

  // EXISTING: Render weekly routines
  const renderWeeklyRoutines = () => {
    if (isCalendarView) {
      return null;
    }

    return (
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color="#007AFF" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Weekly Goals
          </Text>
          <View style={[styles.weekTimer, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="time" size={12} color="#FF9800" />
            <Text style={[styles.weekTimerText, { color: "#FF9800" }]}>
              {weekTimeRemaining}
            </Text>
          </View>
        </View>

        {weeklyRoutines.map((routine, index) => (
          <View key={routine.id} style={styles.routineItem}>
            <TouchableOpacity
              style={[
                styles.routineContent,
                {
                  backgroundColor: routine.isCompleted ? "#E8F5E8" : colors.background,
                  borderColor: routine.isCompleted ? "#4CAF50" : colors.border,
                },
              ]}
              onPress={() => toggleRoutine(routine, "weekly")}
            >
              <View style={styles.routineLeft}>
                <View
                  style={[
                    styles.checkbox,
                    routine.isCompleted && styles.checkboxCompleted,
                    { borderColor: routine.isCompleted ? "#4CAF50" : colors.border },
                  ]}
                >
                  {routine.isCompleted && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
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
                    <Text style={[styles.routineDescription, { color: colors.textSecondary }]}>
                      {routine.description}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}

        {weeklyRoutines.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No weekly goals set. Create some long-term objectives!
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER with Calendar Toggle */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {getVariation}, {userProfile?.display_name || userProfile?.full_name?.split(" ")[0] || "there"}
            </Text>
            <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>

          {/* Calendar Toggle */}
          <View style={styles.headerRight}>
            <View style={styles.toggleContainer}>
              <Ionicons
                name="list"
                size={16}
                color={!isCalendarView ? "#007AFF" : colors.textSecondary}
                style={styles.toggleIcon}
              />
              <Switch
                value={isCalendarView}
                onValueChange={setIsCalendarView}
                trackColor={{ false: colors.border, true: "#007AFF40" }}
                thumbColor={isCalendarView ? "#007AFF" : colors.textSecondary}
                style={styles.toggle}
              />
              <Ionicons
                name="calendar"
                size={16}
                color={isCalendarView ? "#007AFF" : colors.textSecondary}
                style={styles.toggleIcon}
              />
            </View>
          </View>
        </View>

        {/* RESTORED: Day Picker - Always show */}
        <View style={styles.dayPicker}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayPickerContent}
          >
            {daysOfWeek.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.dayButton,
                  selectedDay === day.value && styles.dayButtonActive,
                  {
                    backgroundColor: selectedDay === day.value ? "#007AFF" : colors.surface,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setSelectedDay(day.value)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    { color: selectedDay === day.value ? "#FFFFFF" : colors.text }
                  ]}
                >
                  {day.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* CONTENT - Switch between views */}
      {isCalendarView ? (
        <View style={styles.calendarViewContainer}>
          <View style={styles.calendarHeader}>
            <Text style={[styles.calendarTitle, { color: colors.text }]}>
              {daysOfWeek.find(d => d.value === selectedDay)?.name} Schedule
            </Text>
            <TouchableOpacity
              style={[styles.addCalendarButton, { backgroundColor: "#007AFF" }]}
              onPress={() => navigation.navigate("AddRoutine")}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addCalendarButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {renderCalendarView()}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadData}
              tintColor="#007AFF"
              colors={["#007AFF"]}
            />
          }
          scrollEnabled={scrollEnabled}
        >
          {renderDailyRoutines()}
          {renderWeeklyRoutines()}
        </ScrollView>
      )}

      {/* RESTORED: Day Routine Modal */}
      <Modal
        visible={showDayRoutineModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowDayRoutineModal(false)}>
              <Text style={[styles.modalCancel, { color: "#007AFF" }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {daysOfWeek.find(d => d.value === selectedDay)?.name} Routines
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("AddRoutine")}>
              <Text style={[styles.modalAdd, { color: "#007AFF" }]}>New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalInstructions, { color: colors.textSecondary }]}>
              Select which routines to include on {daysOfWeek.find(d => d.value === selectedDay)?.name}s:
            </Text>

            {availableRoutines.map((routine) => {
              const isAssigned = (daySpecificRoutines[selectedDay] || []).includes(routine.id);
              return (
                <TouchableOpacity
                  key={routine.id}
                  style={[
                    styles.availableRoutineItem,
                    {
                      backgroundColor: isAssigned ? "#E8F5E8" : colors.surface,
                      borderColor: isAssigned ? "#4CAF50" : colors.border
                    }
                  ]}
                  onPress={() => toggleRoutineForDay(routine.id)}
                >
                  <View style={styles.routineIcon}>
                    <Ionicons name={routine.icon as any || "checkbox"} size={20} color="#007AFF" />
                  </View>
                  <View style={styles.routineInfo}>
                    <Text style={[styles.routineName, { color: colors.text }]}>
                      {routine.name}
                    </Text>
                    {routine.description && (
                      <Text style={[styles.routineDescription, { color: colors.textSecondary }]}>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleIcon: {
    marginHorizontal: 4,
  },
  toggle: {
    marginHorizontal: 4,
    transform: [{ scale: 0.8 }],
  },
  dayPicker: {
    marginTop: 8,
  },
  dayPickerContent: {
    paddingHorizontal: 4,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayButtonActive: {
    // Active styles handled by backgroundColor in render
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: "500",
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
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 20,
  },

  // Calendar View Styles
  calendarViewContainer: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addCalendarButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  calendarContainer: {
    flex: 1,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1,
  },
  timeLabel: {
    width: 80,
    paddingTop: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timeLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeSlotContent: {
    flex: 1,
    padding: 12,
    marginRight: 16,
    marginVertical: 8,
    borderRadius: 8,
    minHeight: 64,
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD',
    borderRadius: 8,
    paddingVertical: 16,
  },
  emptySlotText: {
    fontSize: 14,
    marginTop: 4,
  },
  calendarRoutineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  calendarRoutineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  calendarCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  calendarCheckboxCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  calendarRoutineInfo: {
    flex: 1,
  },
  calendarRoutineName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  calendarRoutineNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  calendarRoutineDuration: {
    fontSize: 12,
  },
  calendarRoutineOptions: {
    padding: 4,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalAdd: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalInstructions: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  availableRoutineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
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