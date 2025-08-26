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
import { useTheme } from "../../../ThemeContext"; // ✅ ADDED: Import useTheme hook

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
      isCalendarMode?: boolean;  // ✅ NEW
    };
  };
}

const AddRoutineScreen: React.FC<AddRoutineScreenProps> = ({
  navigation,
  route,
}) => {
  // ✅ ADDED: Use theme colors
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRoutines, setFilteredRoutines] = useState<RoutineTemplate[]>(
    []
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // ✅ NEW: Calendar mode state
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [pendingRoutine, setPendingRoutine] = useState<RoutineTemplate | null>(null);

  // Get parameters from navigation
  const selectedDay = route?.params?.selectedDay;
  const isWeekly = route?.params?.isWeekly;
  const isCalendarMode = route?.params?.isCalendarMode; // ✅ NEW
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

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

  // ✅ NEW: Helper functions for calendar mode
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Create the routine first
      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: routine.name,
          description: routine.description,
          icon: routine.icon,
          is_daily: true,  // Calendar mode is daily
          is_weekly: false,
          is_active: true,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;

      // Schedule it to the time slot
      await scheduleRoutineToTimeSlot(newRoutine.id, timeSlot);

      Alert.alert(
        "Success",
        `${routine.name} scheduled for ${formatTime(timeSlot)} on ${dayNames[selectedDay]}!`
      );

      setPendingRoutine(null);
      navigation.goBack();
    } catch (error) {
      console.error("Error creating scheduled routine:", error);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    }
  };

  const handleCreateCustomWithTime = async (timeSlot: number) => {
    if (!customTitle.trim()) {
      Alert.alert("Error", "Please enter a title for your routine");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Create the routine
      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: customTitle.trim(),
          description: customDescription.trim() || null,
          icon: "checkmark-circle",
          is_daily: true,  // Calendar mode is daily
          is_weekly: false,
          is_active: true,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;

      // Schedule it to the time slot
      await scheduleRoutineToTimeSlot(newRoutine.id, timeSlot);

      Alert.alert(
        "Success",
        `${customTitle} scheduled for ${formatTime(timeSlot)} on ${dayNames[selectedDay]}!`
      );

      setShowCreateModal(false);
      setCustomTitle("");
      setCustomDescription("");
      navigation.goBack();
    } catch (error) {
      console.error("Error creating custom scheduled routine:", error);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    }
  };

  // ✅ NEW: Time slot picker modal component
  const TimeSlotPickerModal = () => {
    const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

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
                      // For pre-loaded routines - create and schedule immediately
                      handleConfirmRoutineWithTime(pendingRoutine, hour);
                    } else {
                      // For custom creation - just close modal and update form
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

  // ✅ UPDATED: Handle routine selection with calendar mode support
  const handleSelectRoutine = async (routine: RoutineTemplate) => {
    if (isCalendarMode) {
      // ✅ NEW: In calendar mode, show time picker first
      setPendingRoutine(routine);
      setShowTimePickerModal(true);
    } else {
      // ✅ EXISTING: Direct creation for daily/weekly modes
      await createRoutineDirectly(routine);
    }
  };

  const createRoutineDirectly = async (routine: RoutineTemplate) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      console.log("=== STARTING ROUTINE CREATION ===");
      console.log("User ID:", user.id);
      console.log("Selected day:", selectedDay);
      console.log("Is weekly:", isWeekly);
      console.log("Routine name:", routine.name);

      // Get next sort order
      const { data: existingRoutines } = await supabase
        .from("user_routines")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextSortOrder =
        existingRoutines && existingRoutines.length > 0
          ? existingRoutines[0].sort_order + 1
          : 1;

      console.log("Creating routine with sort order:", nextSortOrder);

      const { data: newRoutine, error: routineError } = await supabase
        .from("user_routines")
        .insert({
          user_id: user.id,
          name: routine.name,
          description: routine.description,
          icon: routine.icon,
          is_daily: selectedDay !== undefined, // Daily if has selectedDay
          is_weekly: isWeekly || false, // Weekly if isWeekly flag is true
          is_active: true,
          sort_order: nextSortOrder,
        })
        .select("id")
        .single();

      if (routineError) {
        console.error("Routine creation error:", routineError);
        throw routineError;
      }

      console.log("Routine created successfully:", newRoutine);

      // If we have a selected day, assign it to that day (daily routine)
      if (selectedDay !== undefined && newRoutine) {
        console.log("Assigning routine to day:", selectedDay);

        const { data: dayAssignment, error: dayError } = await supabase
          .from("user_day_routines")
          .insert({
            user_id: user.id,
            routine_id: newRoutine.id,
            day_of_week: selectedDay,
          })
          .select();

        if (dayError) {
          console.error("Day assignment error:", dayError);
          throw dayError;
        }

        console.log("Day assignment created successfully:", dayAssignment);
        Alert.alert(
          "Success",
          `${routine.name} added to your ${dayNames[selectedDay]} routine!`
        );
      } else if (isWeekly) {
        console.log("Weekly routine created without day assignment");
        Alert.alert("Success", `${routine.name} added to your weekly goals!`);
      } else {
        console.log("No selected day - routine created without day assignment");
        Alert.alert("Success", `${routine.name} added to your routines!`);
      }

      console.log("=== ROUTINE CREATION COMPLETED ===");
      navigation.goBack();
    } catch (error) {
      console.error("=== ERROR IN ROUTINE CREATION ===");
      console.error("Full error:", error);
      console.error("Error message:", error.message);
      Alert.alert("Error", `Failed to add routine: ${error.message}`);
    }
  };

  // ✅ UPDATED: Handle custom creation with calendar mode support
  const handleCreateCustom = async () => {
    if (isCalendarMode) {
      // ✅ NEW: In calendar mode, check if time slot is selected first
      if (!selectedTimeSlot) {
        Alert.alert("Error", "Please select a time slot for your routine");
        return;
      }
      // Create and schedule with selected time slot
      await handleCreateCustomWithTime(selectedTimeSlot);
    } else {
      // ✅ EXISTING: Direct creation for daily/weekly modes  
      await createCustomDirectly();
    }
  };

  const createCustomDirectly = async () => {
    if (!customTitle.trim()) {
      Alert.alert("Error", "Please enter a title for your routine");
      return;
    }

    if (customTitle.length > 20) {
      Alert.alert("Error", "Title must be 20 characters or less");
      return;
    }

    if (customDescription.length > 20) {
      Alert.alert("Error", "Description must be 20 characters or less");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      console.log("=== CREATING CUSTOM ROUTINE ===");
      console.log("User ID:", user.id);
      console.log("Selected day:", selectedDay);
      console.log("Is weekly:", isWeekly);
      console.log("Custom title:", customTitle.trim());

      // Get next sort order
      const { data: existingRoutines } = await supabase
        .from("user_routines")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextSortOrder =
        existingRoutines && existingRoutines.length > 0
          ? existingRoutines[0].sort_order + 1
          : 1;

      const routineData = {
        user_id: user.id,
        name: customTitle.trim(),
        description: customDescription.trim() || null,
        icon: "checkmark-circle",
        is_daily: selectedDay !== undefined && !isWeekly, // Explicit logic
        is_weekly: isWeekly === true, // Explicit boolean
        is_active: true,
        sort_order: nextSortOrder,
      };

      console.log("Routine data to insert:", routineData);

      const { data: newRoutine, error } = await supabase
        .from("user_routines")
        .insert(routineData)
        .select("id")
        .single();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("New routine created:", newRoutine);

      // If we have a selected day, assign it to that day (daily routine only)
      if (selectedDay !== undefined && !isWeekly) {
        console.log("Assigning routine to specific day:", selectedDay);

        const { error: dayError } = await supabase
          .from("user_day_routines")
          .insert({
            user_id: user.id,
            routine_id: newRoutine.id,
            day_of_week: selectedDay,
          });

        if (dayError) {
          console.error("Day assignment error:", dayError);
          throw dayError;
        }

        Alert.alert(
          "Success",
          `${customTitle} added to your ${dayNames[selectedDay]} routine!`
        );
      } else if (isWeekly) {
        console.log("Weekly routine created - no day assignment needed");
        Alert.alert("Success", `${customTitle} added to your weekly goals!`);
      } else {
        console.log("Generic routine created");
        Alert.alert("Success", `${customTitle} added to your routines!`);
      }

      console.log("=== CUSTOM ROUTINE CREATION COMPLETED ===");

      setShowCreateModal(false);
      setCustomTitle("");
      setCustomDescription("");
      navigation.goBack();
    } catch (error) {
      console.error("=== ERROR IN CUSTOM ROUTINE CREATION ===");
      console.error("Full error:", error);
      Alert.alert("Error", "Failed to create routine. Please try again.");
    }
  };
  const renderCategorySection = (
    category: string,
    routines: RoutineTemplate[]
  ) => {
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
                style={[styles.routineItemInCategory, { backgroundColor: colors.surface }]}
                onPress={() => handleSelectRoutine(routine)}
              >
                <View style={[styles.routineIcon, { backgroundColor: colors.background }]}>
                  <Ionicons
                    name={routine.icon as any}
                    size={20}
                    color="#007AFF"
                  />
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

  const getHeaderTitle = () => {
    if (isWeekly) {
      return "Add Weekly Goal";
    } else if (selectedDay !== undefined) {
      return `Add ${dayNames[selectedDay]} Routine`;
    } else {
      return "Add Routine";
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{getHeaderTitle()}</Text>
        <View style={{ width: 24 }} />
      </View>

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
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.background, borderColor: "#007AFF" }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#007AFF" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {searchQuery.trim() ? (
          // Show search results
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
                >
                  <View style={[styles.routineIcon, { backgroundColor: colors.background }]}>
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color="#007AFF"
                    />
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
          // Show categorized routines
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

      {/* ✅ NEW: Time Slot Picker Modal - Only for pre-loaded routines */}
      {showTimePickerModal && pendingRoutine && <TimeSlotPickerModal />}

      {/* Create Custom Routine Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={[styles.modalCancelButton, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Custom Routine</Text>
            <TouchableOpacity onPress={handleCreateCustom}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
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

            {/* ✅ NEW: Time slot selector for calendar mode */}
            {isCalendarMode && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Time Slot *</Text>
                <TouchableOpacity
                  style={[
                    styles.timeSlotSelector,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    !selectedTimeSlot && styles.timeSlotSelectorEmpty
                  ]}
                  onPress={() => {
                    console.log("Time slot dropdown clicked"); // Debug log
                    setShowTimePickerModal(true);
                  }}
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

                {/* ✅ NEW: Inline time slots dropdown */}
                {showTimePickerModal && !pendingRoutine && (
                  <View style={[styles.inlineTimeSlots, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={styles.inlineTimeSlotsList} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.inlineTimeSlotOption,
                            { borderBottomColor: colors.separator },
                            selectedTimeSlot === hour && [styles.inlineTimeSlotOptionSelected, { backgroundColor: "#007AFF" }]
                          ]}
                          onPress={() => {
                            console.log("Time selected:", hour); // Debug log
                            setSelectedTimeSlot(hour);
                            setShowTimePickerModal(false);
                          }}
                        >
                          <Text style={[
                            styles.inlineTimeSlotText,
                            { color: colors.text },
                            selectedTimeSlot === hour && styles.inlineTimeSlotTextSelected
                          ]}>
                            {formatTime(hour)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // ✅ REMOVED: backgroundColor: "#f5f5f5", - NOW USES THEME
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderBottomWidth: 1,
    // ✅ REMOVED: borderBottomColor: "#e9ecef", - NOW USES THEME
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    // ✅ REMOVED: backgroundColor: "#f8f9fa", - NOW USES THEME
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#e9ecef", - NOW USES THEME
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    // ✅ REMOVED: backgroundColor: "#f0f8ff", - NOW USES THEME
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#007AFF", - KEPT AS IS
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#007AFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    // ✅ REMOVED: backgroundColor: "#f5f5f5", - NOW USES THEME
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    // ✅ REMOVED: color: "#333", - NOW USES THEME
    marginVertical: 16,
  },
  categoriesContainer: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 16,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderRadius: 12,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    // ✅ REMOVED: backgroundColor: "#f8f9fa", - NOW USES THEME
    borderBottomWidth: 1,
    // ✅ REMOVED: borderBottomColor: "#f0f0f0", - NOW USES THEME
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  categoryCount: {
    fontSize: 14,
    // ✅ REMOVED: color: "#666", - NOW USES THEME
  },
  categoryContent: {
    padding: 8,
  },
  routineItemInCategory: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
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
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#e9ecef", - NOW USES THEME
  },
  routineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // ✅ REMOVED: backgroundColor: "#f0f8ff", - NOW USES THEME
    alignItems: "center",
    justifyContent: "center",
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: "500",
    // ✅ REMOVED: color: "#333", - NOW USES THEME
    marginBottom: 2,
  },
  routineDescription: {
    fontSize: 14,
    // ✅ REMOVED: color: "#666", - NOW USES THEME
  },
  routineCategory: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
    marginTop: 2,
  },
  // ✅ NEW: Time Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  timePickerModal: {
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    width: "100%",
  },
  timeSlotsList: {
    maxHeight: 400,
    paddingBottom: 20,
  },
  timeSlotOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    // ✅ REMOVED: borderBottomColor: "#f0f0f0", - NOW USES THEME
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
  },
  timeSlotOptionSelected: {
    // backgroundColor: "#007AFF", - KEPT AS IS (blue selection)
  },
  timeSlotText: {
    fontSize: 16,
    // ✅ REMOVED: color: "#333", - NOW USES THEME
    textAlign: "center",
  },
  timeSlotTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    // ✅ REMOVED: backgroundColor: "#f5f5f5", - NOW USES THEME
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderBottomWidth: 1,
    // ✅ REMOVED: borderBottomColor: "#e9ecef", - NOW USES THEME
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  modalCancelButton: {
    fontSize: 16,
    // ✅ REMOVED: color: "#666", - NOW USES THEME
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  modalContent: {
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
    // ✅ REMOVED: color: "#333", - NOW USES THEME
    marginBottom: 8,
  },
  textInput: {
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#e9ecef", - NOW USES THEME
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    // ✅ REMOVED: color: "#666", - NOW USES THEME
    textAlign: "right",
    marginTop: 4,
  },
  // ✅ NEW: Time slot selector styles
  timeSlotSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#e9ecef", - NOW USES THEME
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  timeSlotSelectorEmpty: {
    // ✅ REMOVED: borderColor: "#ddd", - NOW USES THEME (inherits from timeSlotSelector)
  },
  timeSlotSelectorText: {
    fontSize: 16,
    // ✅ REMOVED: color: "#333", - NOW USES THEME
  },
  timeSlotSelectorTextEmpty: {
    // ✅ REMOVED: color: "#999", - NOW USES THEME
  },
  // ✅ NEW: Inline time slots dropdown styles
  inlineTimeSlots: {
    marginTop: 8,
    // ✅ REMOVED: backgroundColor: "#fff", - NOW USES THEME
    borderWidth: 1,
    // ✅ REMOVED: borderColor: "#e9ecef", - NOW USES THEME
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineTimeSlotsList: {
    maxHeight: 200,
  },
  inlineTimeSlotOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    // ✅ REMOVED: borderBottomColor: "#f0f0f0", - NOW USES THEME
  },
  inlineTimeSlotOptionSelected: {
    // backgroundColor: "#007AFF", - KEPT AS IS (blue selection)
  },
  inlineTimeSlotText: {
    fontSize: 16,
    // ✅ REMOVED: color: "#333", - NOW USES THEME
    textAlign: "center",
  },
  inlineTimeSlotTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default AddRoutineScreen;