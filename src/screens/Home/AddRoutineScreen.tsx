import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../../ThemeContext";

interface RoutineTemplate {
  id: string;
  name: string;
  description?: string;
  icon: string;
  category: string;
}

interface AddRoutineScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectedDay?: number;
      isWeekly?: boolean;
      isCalendarMode?: boolean;
      skipPresets?: boolean; // NEW: Skip presets parameter
    };
  };
}

const AddRoutineScreen: React.FC<AddRoutineScreenProps> = ({
  navigation,
  route,
}) => {
  const { colors } = useTheme();

  // NEW: State to control which screen to show
  const [currentScreen, setCurrentScreen] = useState<'templates' | 'custom'>('templates');

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRoutines, setFilteredRoutines] = useState<RoutineTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Calendar mode state
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [pendingRoutine, setPendingRoutine] = useState<RoutineTemplate | null>(null);

  // Get parameters from navigation
  const selectedDay = route?.params?.selectedDay;
  const isWeekly = route?.params?.isWeekly;
  const isCalendarMode = route?.params?.isCalendarMode;
  const skipPresets = route?.params?.skipPresets; // NEW: Extract skipPresets parameter

  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];

  // NEW: Set initial screen based on skipPresets parameter
  useEffect(() => {
    if (skipPresets) {
      setCurrentScreen('custom');
    }
  }, [skipPresets]);

  // Organized routine templates by category
  const routineTemplates: RoutineTemplate[] = [
    // Fitness
    {
      id: "1",
      name: "Workout",
      description: "Physical exercise session",
      icon: "fitness",
      category: "Fitness",
    },
    {
      id: "2",
      name: "Run",
      description: "Go for a run",
      icon: "walk",
      category: "Fitness",
    },
    {
      id: "3",
      name: "Bicycling",
      description: "Bike ride",
      icon: "bicycle",
      category: "Fitness",
    },
    {
      id: "4",
      name: "Yoga",
      description: "Yoga practice",
      icon: "body",
      category: "Fitness",
    },
    {
      id: "5",
      name: "Walk",
      description: "Take a walk",
      icon: "walk",
      category: "Fitness",
    },
    {
      id: "6",
      name: "Stretch",
      description: "Stretching exercises",
      icon: "accessibility",
      category: "Fitness",
    },
    {
      id: "7",
      name: "Swimming",
      description: "Swimming workout",
      icon: "water",
      category: "Fitness",
    },
    {
      id: "8",
      name: "Weightlifting",
      description: "Strength training",
      icon: "barbell",
      category: "Fitness",
    },
    {
      id: "9",
      name: "Cardio",
      description: "Cardiovascular exercise",
      icon: "heart",
      category: "Fitness",
    },

    // Learning
    {
      id: "10",
      name: "Read a Book",
      description: "Reading time",
      icon: "book",
      category: "Learning",
    },
    {
      id: "11",
      name: "Study",
      description: "Study session",
      icon: "school",
      category: "Learning",
    },
    {
      id: "12",
      name: "Music Practice",
      description: "Practice instrument",
      icon: "musical-notes",
      category: "Learning",
    },
    {
      id: "13",
      name: "Language Learning",
      description: "Practice new language",
      icon: "chatbubbles",
      category: "Learning",
    },
    {
      id: "14",
      name: "Online Course",
      description: "Take online classes",
      icon: "laptop",
      category: "Learning",
    },
    {
      id: "15",
      name: "Podcast",
      description: "Listen to educational content",
      icon: "headset",
      category: "Learning",
    },
    {
      id: "16",
      name: "Writing",
      description: "Creative or technical writing",
      icon: "create",
      category: "Learning",
    },

    // Productivity
    {
      id: "17",
      name: "Work",
      description: "Work session",
      icon: "briefcase",
      category: "Productivity",
    },
    {
      id: "18",
      name: "Plan Day",
      description: "Daily planning",
      icon: "calendar",
      category: "Productivity",
    },
    {
      id: "19",
      name: "Email Management",
      description: "Process emails",
      icon: "mail",
      category: "Productivity",
    },
    {
      id: "20",
      name: "Deep Work",
      description: "Focused work session",
      icon: "bulb",
      category: "Productivity",
    },
    {
      id: "21",
      name: "Review Goals",
      description: "Check progress",
      icon: "checkmark-done",
      category: "Productivity",
    },
    {
      id: "22",
      name: "Organize Workspace",
      description: "Clean and organize",
      icon: "file-tray",
      category: "Productivity",
    },

    // Wellness
    {
      id: "23",
      name: "Meditation",
      description: "Mindfulness practice",
      icon: "leaf",
      category: "Wellness",
    },
    {
      id: "24",
      name: "Sleep 8 Hours",
      description: "Get quality sleep",
      icon: "bed",
      category: "Wellness",
    },
    {
      id: "25",
      name: "Drink Water",
      description: "Stay hydrated",
      icon: "water",
      category: "Wellness",
    },
    {
      id: "26",
      name: "Take Vitamins",
      description: "Daily supplements",
      icon: "medical",
      category: "Wellness",
    },
    {
      id: "27",
      name: "Skincare Routine",
      description: "Take care of skin",
      icon: "sparkles",
      category: "Wellness",
    },
    {
      id: "28",
      name: "Gratitude Practice",
      description: "Practice gratitude",
      icon: "heart-outline",
      category: "Wellness",
    },

    // Nutrition
    {
      id: "29",
      name: "Eat Healthy Breakfast",
      description: "Nutritious morning meal",
      icon: "restaurant",
      category: "Nutrition",
    },
    {
      id: "30",
      name: "Meal Prep",
      description: "Prepare healthy meals",
      icon: "nutrition",
      category: "Nutrition",
    },
    {
      id: "31",
      name: "Cook Dinner",
      description: "Prepare evening meal",
      icon: "flame",
      category: "Nutrition",
    },
    {
      id: "32",
      name: "Eat Fruits/Vegetables",
      description: "Get daily servings",
      icon: "leaf-outline",
      category: "Nutrition",
    },
    {
      id: "33",
      name: "Avoid Junk Food",
      description: "Make healthy choices",
      icon: "close-circle",
      category: "Nutrition",
    },

    // Household
    {
      id: "34",
      name: "Clean House",
      description: "Tidy up living space",
      icon: "home",
      category: "Household",
    },
    {
      id: "35",
      name: "Do Laundry",
      description: "Wash and fold clothes",
      icon: "shirt",
      category: "Household",
    },
    {
      id: "36",
      name: "Take Out Trash",
      description: "Empty garbage",
      icon: "trash",
      category: "Household",
    },
    {
      id: "37",
      name: "Grocery Shopping",
      description: "Buy food and supplies",
      icon: "bag",
      category: "Household",
    },
    {
      id: "38",
      name: "Garden Work",
      description: "Tend to plants",
      icon: "flower",
      category: "Household",
    },

    // Social
    {
      id: "39",
      name: "Call Family/Friends",
      description: "Stay connected",
      icon: "call",
      category: "Social",
    },
    {
      id: "40",
      name: "Social Activity",
      description: "Meet with others",
      icon: "people",
      category: "Social",
    },
    {
      id: "41",
      name: "Date Night",
      description: "Spend time with partner",
      icon: "heart",
      category: "Social",
    },
    {
      id: "42",
      name: "Community Service",
      description: "Help others",
      icon: "hand-left",
      category: "Social",
    },

    // Spiritual
    {
      id: "43",
      name: "Prayer",
      description: "Prayer time",
      icon: "rose",
      category: "Spiritual",
    },
    {
      id: "44",
      name: "Bible Study",
      description: "Read scripture",
      icon: "book",
      category: "Spiritual",
    },
    {
      id: "45",
      name: "Church",
      description: "Attend service",
      icon: "home",
      category: "Spiritual",
    },
    {
      id: "46",
      name: "Reflection",
      description: "Spiritual reflection",
      icon: "bulb",
      category: "Spiritual",
    },
    {
      id: "47",
      name: "Devotional",
      description: "Daily devotional",
      icon: "heart",
      category: "Spiritual",
    },

    // Business
    {
      id: "48",
      name: "Networking",
      description: "Build connections",
      icon: "people",
      category: "Business",
    },
    {
      id: "49",
      name: "Skill Development",
      description: "Learn new skills",
      icon: "trending-up",
      category: "Business",
    },
    {
      id: "50",
      name: "Client Calls",
      description: "Talk to clients",
      icon: "call",
      category: "Business",
    },
    {
      id: "51",
      name: "Business Planning",
      description: "Strategic planning",
      icon: "analytics",
      category: "Business",
    },
    {
      id: "52",
      name: "Marketing",
      description: "Promote business",
      icon: "megaphone",
      category: "Business",
    },
  ];

  // Group routines by category
  const routinesByCategory = routineTemplates.reduce((acc, routine) => {
    if (!acc[routine.category]) {
      acc[routine.category] = [];
    }
    acc[routine.category].push(routine);
    return acc;
  }, {} as Record<string, RoutineTemplate[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  useEffect(() => {
    // Filter routines based on search query
    if (searchQuery.trim() === "") {
      setFilteredRoutines([]);
    } else {
      const filtered = routineTemplates.filter(
        (routine) =>
          routine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          routine.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          routine.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRoutines(filtered);
    }
  }, [searchQuery]);

  // Helper functions for calendar mode
  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const scheduleRoutineToTimeSlot = async (routineId: string, hour: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const scheduledTime = `${hour.toString().padStart(2, '0')}:00`;

    const { error } = await supabase
      .from("routine_schedule")
      .insert({
        user_id: user.id,
        routine_id: routineId,
        day_of_week: selectedDay,
        scheduled_time: scheduledTime,
        estimated_duration: 30,
        is_active: true
      });

    if (error) throw error;
  };

  const handleConfirmRoutineWithTime = async (routine: RoutineTemplate, timeSlot: number) => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: routine.name,
          description: routine.description,
          icon: routine.icon,
          is_daily: true,
          is_weekly: false,
          is_active: true,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;

      await scheduleRoutineToTimeSlot(newRoutine.id, timeSlot);

      setPendingRoutine(null);
      setShowTimePickerModal(false);
      setIsCreating(false);
      navigation.goBack();

    } catch (error) {
      console.error("Error creating routine:", error);
      setIsCreating(false);
      setPendingRoutine(null);
      setShowTimePickerModal(false);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    }
  };

  const handleCreateCustomWithTime = async (timeSlot: number) => {
    if (isCreating || !customTitle.trim()) {
      if (!customTitle.trim()) {
        Alert.alert("Error", "Please enter a title for your routine");
      }
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: customTitle.trim(),
          description: customDescription.trim() || null,
          icon: "checkmark-circle",
          is_daily: true,
          is_weekly: false,
          is_active: true,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;

      await scheduleRoutineToTimeSlot(newRoutine.id, timeSlot);

      Alert.alert(
        "Success",
        `${customTitle} scheduled for ${formatTime(timeSlot)} on ${dayNames[selectedDay]}!`
      );

      setShowCreateModal(false);
      setShowTimePickerModal(false);
      setCustomTitle("");
      setCustomDescription("");
      setSelectedTimeSlot(null);
      navigation.goBack();

    } catch (error) {
      console.error("Error creating custom routine:", error);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Time slot picker modal component
  const TimeSlotPickerModal = () => {
    const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

    return (
      <Modal
        visible={showTimePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.timePickerModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Time Slot</Text>
              <TouchableOpacity onPress={() => setShowTimePickerModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.timeSlotsList}>
              {timeSlots.map((hour) => (
                <TouchableOpacity
                  key={hour}
                  style={[
                    styles.timeSlotOption,
                    { backgroundColor: colors.surface, borderBottomColor: colors.separator },
                    selectedTimeSlot === hour && [styles.timeSlotOptionSelected, { backgroundColor: "#007AFF" }]
                  ]}
                  onPress={() => {
                    setSelectedTimeSlot(hour);
                    if (pendingRoutine) {
                      handleConfirmRoutineWithTime(pendingRoutine, hour);
                    } else {
                      setShowTimePickerModal(false);
                    }
                  }}
                >
                  <Text style={[
                    styles.timeSlotText,
                    { color: colors.text },
                    selectedTimeSlot === hour && styles.timeSlotTextSelected
                  ]}>
                    {formatTime(hour)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Handle routine selection with calendar mode support
  const handleSelectRoutine = async (routine: RoutineTemplate) => {
    if (isCreating) return;

    if (isCalendarMode) {
      setPendingRoutine(routine);
      setShowTimePickerModal(true);
    } else {
      setIsCreating(true);
      try {
        await createRoutineDirectly(routine);
      } catch (error) {
        console.error("Error in handleSelectRoutine:", error);
      } finally {
        setIsCreating(false);
      }
    }
  };

  const createRoutineDirectly = async (routine: RoutineTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: existingRoutines } = await supabase
        .from("user_routines")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextSortOrder = existingRoutines && existingRoutines.length > 0
        ? existingRoutines[0].sort_order + 1 : 1;

      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: routine.name,
          description: routine.description,
          icon: routine.icon,
          is_daily: selectedDay !== undefined,
          is_weekly: isWeekly || false,
          is_active: true,
          sort_order: nextSortOrder,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;

      if (selectedDay !== undefined && newRoutine) {
        const { error: dayError } = await supabase
          .from("user_day_routines")
          .insert({
            user_id: user.id,
            routine_id: newRoutine.id,
            day_of_week: selectedDay,
          });

        if (dayError) throw dayError;

        Alert.alert("Success", `${routine.name} added to your ${dayNames[selectedDay]} routine!`);
      } else if (isWeekly) {
        Alert.alert("Success", `${routine.name} added to your weekly goals!`);
      } else {
        Alert.alert("Success", `${routine.name} added to your routines!`);
      }

      navigation.goBack();
    } catch (error) {
      console.error("Error creating routine:", error);
      Alert.alert("Error", `Failed to add routine: ${error.message}`);
    }
  };

  // Handle custom creation with calendar mode support
  const handleCreateCustom = async () => {
    if (isCalendarMode) {
      if (!selectedTimeSlot) {
        Alert.alert("Error", "Please select a time slot for your routine");
        return;
      }
      await handleCreateCustomWithTime(selectedTimeSlot);
    } else {
      await createCustomDirectly();
    }
  };

  const createCustomDirectly = async () => {
    if (isCreating || !customTitle.trim()) {
      if (!customTitle.trim()) {
        Alert.alert("Error", "Please enter a title for your routine");
      }
      return;
    }

    if (customTitle.length > 20 || customDescription.length > 20) {
      Alert.alert("Error", "Title and description must be 20 characters or less");
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: existingRoutines } = await supabase
        .from("user_routines")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextSortOrder = existingRoutines && existingRoutines.length > 0
        ? existingRoutines[0].sort_order + 1 : 1;

      const routineData = {
        user_id: user.id,
        name: customTitle.trim(),
        description: customDescription.trim() || null,
        icon: "checkmark-circle",
        is_daily: selectedDay !== undefined && !isWeekly,
        is_weekly: isWeekly === true,
        is_active: true,
        sort_order: nextSortOrder,
      };

      const { data: newRoutine, error } = await supabase
        .from("user_routines")
        .insert(routineData)
        .select("id")
        .single();

      if (error) throw error;

      if (selectedDay !== undefined && !isWeekly) {
        const { error: dayError } = await supabase
          .from("user_day_routines")
          .insert({
            user_id: user.id,
            routine_id: newRoutine.id,
            day_of_week: selectedDay,
          });

        if (dayError) throw dayError;
        Alert.alert("Success", `${customTitle} added to your ${dayNames[selectedDay]} routine!`);
      } else if (isWeekly) {
        Alert.alert("Success", `${customTitle} added to your weekly goals!`);
      } else {
        Alert.alert("Success", `${customTitle} added to your routines!`);
      }

      setShowCreateModal(false);
      setCustomTitle("");
      setCustomDescription("");
      navigation.goBack();
    } catch (error) {
      console.error("Error creating custom routine:", error);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const renderCategorySection = (category: string, routines: RoutineTemplate[]) => {
    const isExpanded = expandedCategories.has(category);

    return (
      <View key={category} style={[styles.categorySection, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.categoryHeader, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}
          onPress={() => toggleCategory(category)}
        >
          <View style={styles.categoryHeaderLeft}>
            <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
            <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>({routines.length})</Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={[
                  styles.routineItemInCategory,
                  { backgroundColor: colors.surface },
                  isCreating && { opacity: 0.6 }
                ]}
                onPress={() => handleSelectRoutine(routine)}
                disabled={isCreating}
              >
                <View style={[styles.routineIcon, { backgroundColor: colors.background }]}>
                  <Ionicons name={routine.icon as any} size={20} color="#007AFF" />
                </View>
                <View style={styles.routineInfo}>
                  <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
                  {routine.description && (
                    <Text style={[styles.routineDescription, { color: colors.textSecondary }]}>
                      {routine.description}
                    </Text>
                  )}
                </View>
                <Ionicons name="add-circle" size={20} color="#007AFF" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // NEW: Dynamic header title based on context
  const getHeaderTitle = () => {
    if (skipPresets) {
      return `Create Routine for ${dayNames[selectedDay || 0]}`;
    } else if (currentScreen === 'custom') {
      return "Create Custom Routine";
    } else if (isWeekly) {
      return "Add Weekly Goal";
    } else if (selectedDay !== undefined) {
      return `Add ${dayNames[selectedDay]} Routine`;
    } else {
      return "Add Routine";
    }
  };

  // NEW: Handle back button based on current state
  const handleBackButton = () => {
    if (skipPresets || currentScreen === 'templates') {
      navigation.goBack();
    } else {
      setCurrentScreen('templates');
    }
  };

  // NEW: Custom creation screen component
  const renderCustomCreationScreen = () => (
    <View style={[styles.customContainer, { backgroundColor: colors.background }]}>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Title *</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Enter routine title..."
          placeholderTextColor={colors.placeholder}
          value={customTitle}
          onChangeText={setCustomTitle}
          maxLength={20}
        />
        <Text style={[styles.charCount, { color: colors.textSecondary }]}>{customTitle.length}/20</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Enter description..."
          placeholderTextColor={colors.placeholder}
          value={customDescription}
          onChangeText={setCustomDescription}
          maxLength={20}
          multiline
          numberOfLines={3}
        />
        <Text style={[styles.charCount, { color: colors.textSecondary }]}>
          {customDescription.length}/20
        </Text>
      </View>

      {/* Time slot selector for calendar mode */}
      {isCalendarMode && (
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Time Slot *</Text>
          <TouchableOpacity
            style={[
              styles.timeSlotSelector,
              { backgroundColor: colors.surface, borderColor: colors.border },
              !selectedTimeSlot && styles.timeSlotSelectorEmpty
            ]}
            onPress={() => setShowTimePickerModal(true)}
          >
            <Text style={[
              styles.timeSlotSelectorText,
              { color: colors.text },
              !selectedTimeSlot && [styles.timeSlotSelectorTextEmpty, { color: colors.placeholder }]
            ]}>
              {selectedTimeSlot ? formatTime(selectedTimeSlot) : "Select time slot..."}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.createSubmitButton,
          {
            backgroundColor: (!customTitle.trim() || (isCalendarMode && !selectedTimeSlot)) ? colors.border : "#007AFF",
            opacity: (!customTitle.trim() || (isCalendarMode && !selectedTimeSlot)) ? 0.6 : 1
          }
        ]}
        onPress={handleCreateCustom}
        disabled={!customTitle.trim() || (isCalendarMode && !selectedTimeSlot) || isCreating}
      >
        <Text style={[
          styles.createSubmitButtonText,
          { color: (!customTitle.trim() || (isCalendarMode && !selectedTimeSlot)) ? colors.textTertiary : "white" }
        ]}>
          {isCreating ? "Creating..." : "Create Routine"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBackButton}
        >
          <Ionicons
            name={skipPresets || currentScreen === 'templates' ? "close" : "arrow-back"}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {getHeaderTitle()}
        </Text>
        {/* NEW: Show create button only when in templates view and not skipPresets */}
        {!skipPresets && currentScreen === 'templates' ? (
          <TouchableOpacity
            style={styles.headerCreateButton}
            onPress={() => setCurrentScreen('custom')}
          >
            <Text style={styles.headerCreateText}>Create</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Content based on current screen */}
      {skipPresets || currentScreen === 'custom' ? (
        renderCustomCreationScreen()
      ) : (
        <>
          {/* Search Container */}
          <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search routines..."
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Templates Content */}
          <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
            {searchQuery.trim() ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Search Results ({filteredRoutines.length})
                </Text>
                <FlatList
                  data={filteredRoutines}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.routineItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleSelectRoutine(item)}
                      disabled={isCreating}
                    >
                      <View style={[styles.routineIcon, { backgroundColor: colors.background }]}>
                        <Ionicons name={item.icon as any} size={24} color="#007AFF" />
                      </View>
                      <View style={styles.routineInfo}>
                        <Text style={[styles.routineName, { color: colors.text }]}>{item.name}</Text>
                        {item.description && (
                          <Text style={[styles.routineDescription, { color: colors.textSecondary }]}>
                            {item.description}
                          </Text>
                        )}
                        <Text style={styles.routineCategory}>{item.category}</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  style={styles.routinesList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Category</Text>
                <ScrollView
                  style={styles.categoriesContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {Object.entries(routinesByCategory).map(([category, routines]) =>
                    renderCategorySection(category, routines)
                  )}
                </ScrollView>
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Time Slot Picker Modal */}
      {showTimePickerModal && <TimeSlotPickerModal />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  headerCreateButton: {
    padding: 8,
  },
  headerCreateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginVertical: 16,
  },
  categoriesContainer: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  categoryCount: {
    fontSize: 14,
  },
  categoryContent: {
    padding: 8,
  },
  routineItemInCategory: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  routinesList: {
    flex: 1,
  },
  routineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
  },
  routineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  routineDescription: {
    fontSize: 14,
  },
  routineCategory: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
    marginTop: 2,
  },
  // Custom creation screen styles
  customContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  timeSlotSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  timeSlotSelectorEmpty: {},
  timeSlotSelectorText: {
    fontSize: 16,
  },
  timeSlotSelectorTextEmpty: {},
  createSubmitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  createSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  timePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    width: "100%",
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
  timeSlotsList: {
    maxHeight: 400,
    paddingBottom: 20,
  },
  timeSlotOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  timeSlotOptionSelected: {},
  timeSlotText: {
    fontSize: 16,
    textAlign: "center",
  },
  timeSlotTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default AddRoutineScreen;