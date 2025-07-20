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

  // Get parameters from navigation
  const selectedDay = route?.params?.selectedDay;
  const isWeekly = route?.params?.isWeekly;
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

  const handleSelectRoutine = async (routine: RoutineTemplate) => {
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

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) {
      Alert.alert("Error", "Please enter a title for your routine");
      return;
    }

    if (customTitle.length > 20) {
      Alert.alert("Error", "Title must be 20 characters or less");
      return;
    }

    if (customDescription.length > 35) {
      Alert.alert("Error", "Description must be 35 characters or less");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check if this routine name already exists for this user
      const { data: existingRoutine, error: checkError } = await supabase
        .from("user_routines")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", customTitle.trim())
        .eq("is_active", true)
        .single();

      let routineId: string;

      if (existingRoutine) {
        // Use existing routine
        routineId = existingRoutine.id;
      } else {
        // Create new routine
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

        const { data: newRoutine, error } = await supabase
          .from("user_routines")
          .insert({
            user_id: user.id,
            name: customTitle.trim(),
            description: customDescription.trim() || null,
            icon: "checkmark-circle",
            is_daily: selectedDay !== undefined,
            is_weekly: isWeekly || false,
            is_active: true,
            sort_order: nextSortOrder,
          })
          .select("id")
          .single();

        if (error) throw error;
        routineId = newRoutine.id;
      }

      // If we have a selected day, assign it to that day
      if (selectedDay !== undefined) {
        // Check if already assigned to this day
        const { data: existingAssignment } = await supabase
          .from("user_day_routines")
          .select("id")
          .eq("user_id", user.id)
          .eq("routine_id", routineId)
          .eq("day_of_week", selectedDay)
          .single();

        if (!existingAssignment) {
          const { error: dayError } = await supabase
            .from("user_day_routines")
            .insert({
              user_id: user.id,
              routine_id: routineId,
              day_of_week: selectedDay,
            });

          if (dayError) throw dayError;
        }

        Alert.alert(
          "Success",
          `${customTitle} added to your ${dayNames[selectedDay]} routine!`
        );
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
    }
  };

  const renderCategorySection = (
    category: string,
    routines: RoutineTemplate[]
  ) => {
    const isExpanded = expandedCategories.has(category);

    return (
      <View key={category} style={styles.categorySection}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
        >
          <View style={styles.categoryHeaderLeft}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <Text style={styles.categoryCount}>({routines.length})</Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={styles.routineItemInCategory}
                onPress={() => handleSelectRoutine(routine)}
              >
                <View style={styles.routineIcon}>
                  <Ionicons
                    name={routine.icon as any}
                    size={20}
                    color="#007AFF"
                  />
                </View>
                <View style={styles.routineInfo}>
                  <Text style={styles.routineName}>{routine.name}</Text>
                  {routine.description && (
                    <Text style={styles.routineDescription}>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search routines..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#007AFF" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {searchQuery.trim() ? (
          // Show search results
          <>
            <Text style={styles.sectionTitle}>
              Search Results ({filteredRoutines.length})
            </Text>
            <FlatList
              data={filteredRoutines}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.routineItem}
                  onPress={() => handleSelectRoutine(item)}
                >
                  <View style={styles.routineIcon}>
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color="#007AFF"
                    />
                  </View>
                  <View style={styles.routineInfo}>
                    <Text style={styles.routineName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.routineDescription}>
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
            <Text style={styles.sectionTitle}>Browse by Category</Text>
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

      {/* Create Custom Routine Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Custom Routine</Text>
            <TouchableOpacity onPress={handleCreateCustom}>
              <Text style={styles.modalSaveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter routine title..."
                value={customTitle}
                onChangeText={setCustomTitle}
                maxLength={20}
              />
              <Text style={styles.charCount}>{customTitle.length}/20</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Enter description..."
                value={customDescription}
                onChangeText={setCustomDescription}
                maxLength={35}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.charCount}>
                {customDescription.length}/35
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#007AFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginVertical: 16,
  },
  categoriesContainer: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  categoryCount: {
    fontSize: 14,
    color: "#666",
  },
  categoryContent: {
    padding: 8,
  },
  routineItemInCategory: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  routineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  routineDescription: {
    fontSize: 14,
    color: "#666",
  },
  routineCategory: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
    marginTop: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalCancelButton: {
    fontSize: 16,
    color: "#666",
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
    color: "#333",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e9ecef",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
});

export default AddRoutineScreen;
