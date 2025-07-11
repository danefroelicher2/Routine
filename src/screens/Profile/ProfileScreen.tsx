import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../services/supabase";
import { Profile, UserSettings, UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";

const { width } = Dimensions.get("window");

interface ProfileScreenProps {
  navigation: any;
}

// Same achievement interface as StatsScreen
interface Achievement {
  id: string;
  name: string;
  target: number;
  unlocked: boolean;
  unlockedDate?: string;
}

// NEW: Interface for daily routines by day
interface DayRoutines {
  [key: number]: UserRoutine[];
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Help popup state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // NEW: Profile picture states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // NEW: Daily routines state
  const [dayRoutines, setDayRoutines] = useState<DayRoutines>({});
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // NEW: Theme context
  const { colors } = useTheme();

  // Achievement targets (same as StatsScreen)
  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 100, 150, 200, 250, 300, 365,
  ];

  // NEW: Days of the week mapping
  const DAYS_OF_WEEK = [
    { id: 0, name: "Sunday", short: "Sun" },
    { id: 1, name: "Monday", short: "Mon" },
    { id: 2, name: "Tuesday", short: "Tue" },
    { id: 3, name: "Wednesday", short: "Wed" },
    { id: 4, name: "Thursday", short: "Thu" },
    { id: 5, name: "Friday", short: "Fri" },
    { id: 6, name: "Saturday", short: "Sat" },
  ];

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      requestPermissions();
    }, [])
  );

  // NEW: Request camera and media library permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || mediaStatus !== "granted") {
      console.log("Camera or media library permissions not granted");
    }
  };

  // NEW: Function to load daily routines by day
  const loadDailyRoutines = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get all user routines and day assignments
      const [routinesResult, dayAssignmentsResult] = await Promise.all([
        supabase
          .from("user_routines")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_weekly", false)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("user_day_routines")
          .select("routine_id, day_of_week")
          .eq("user_id", user.id),
      ]);

      if (routinesResult.error) throw routinesResult.error;
      if (dayAssignmentsResult.error) throw dayAssignmentsResult.error;

      const routines = routinesResult.data || [];
      const dayAssignments = dayAssignmentsResult.data || [];

      // Group routines by day
      const routinesByDay: DayRoutines = {};

      // Initialize all days with empty arrays
      for (let i = 0; i < 7; i++) {
        routinesByDay[i] = [];
      }

      // Map routines to their assigned days
      dayAssignments.forEach((assignment) => {
        const routine = routines.find((r) => r.id === assignment.routine_id);
        if (routine) {
          routinesByDay[assignment.day_of_week].push(routine);
        }
      });

      setDayRoutines(routinesByDay);
    } catch (error) {
      console.error("Error loading daily routines:", error);
    }
  };

  const loadProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      setProfile(profileData);
      setSettings(settingsData);

      // Load achievements
      await calculateAchievements(user.id);

      // NEW: Load daily routines
      await loadDailyRoutines();
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Achievement calculation logic (same as before)
  const calculateAchievements = async (userId: string) => {
    try {
      const { data: completions, error } = await supabase
        .from("routine_completions")
        .select("completion_date")
        .eq("user_id", userId)
        .order("completion_date");

      if (error) throw error;

      if (!completions || completions.length === 0) {
        const emptyAchievements = ACHIEVEMENT_TARGETS.map((target, index) => ({
          id: `achievement-${index}`,
          name: `${target} Day${target === 1 ? "" : "s"}`,
          target,
          unlocked: false,
        }));
        setAchievements(emptyAchievements);
        return;
      }

      const completionDates = completions.map((c) => c.completion_date);
      const streaks = calculateStreaks(completionDates);
      const maxStreak = Math.max(...streaks.map((s) => s.length));

      const achievementList = ACHIEVEMENT_TARGETS.map((target, index) => {
        const isUnlocked = maxStreak >= target;
        let unlockedDate: string | undefined;

        if (isUnlocked) {
          const qualifyingStreak = streaks.find((s) => s.length >= target);
          if (qualifyingStreak) {
            const streakEndIndex = completionDates.indexOf(
              qualifyingStreak.endDate
            );
            const targetDateIndex = Math.max(0, streakEndIndex - target + 1);
            unlockedDate = completionDates[targetDateIndex + target - 1];
          }
        }

        return {
          id: `achievement-${index}`,
          name: `${target} Day${target === 1 ? "" : "s"}`,
          target,
          unlocked: isUnlocked,
          unlockedDate,
        };
      });

      setAchievements(achievementList);
    } catch (error) {
      console.error("Error calculating achievements:", error);
    }
  };

  const calculateStreaks = (completionDates: string[]) => {
    if (completionDates.length === 0) return [];

    const sortedDates = [...new Set(completionDates)].sort();
    const streaks: Array<{
      length: number;
      startDate: string;
      endDate: string;
    }> = [];
    let currentStreak = {
      length: 1,
      startDate: sortedDates[0],
      endDate: sortedDates[0],
    };

    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const prevDate = new Date(sortedDates[i - 1]);
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak.length++;
        currentStreak.endDate = sortedDates[i];
      } else {
        streaks.push({ ...currentStreak });
        currentStreak = {
          length: 1,
          startDate: sortedDates[i],
          endDate: sortedDates[i],
        };
      }
    }

    streaks.push(currentStreak);
    return streaks;
  };

  // NEW: Profile picture functions
  const handleProfilePicturePress = () => {
    setShowImagePicker(true);
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      let result;

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setShowImagePicker(false);
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadProfilePicture = async (imageUri: string) => {
    try {
      setUploadingImage(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const fileExt = "jpg";
      const fileName = `${user.id}/avatar.${fileExt}`;

      console.log("🔄 Starting upload with filename:", fileName);

      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("❌ Upload error:", uploadError);
        throw uploadError;
      }

      console.log("✅ Upload successful:", uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      console.log("🔗 Public URL generated:", urlData.publicUrl);

      // Add timestamp for cache busting
      const timestampedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL (clean URL in database)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: urlData.publicUrl, // Store clean URL in DB
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("❌ Profile update error:", updateError);
        throw updateError;
      }

      console.log("✅ Profile updated successfully");

      // Update local state with timestamped URL for immediate display
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              avatar_url: timestampedUrl, // Use timestamped URL for immediate display
              updated_at: new Date().toISOString(),
            }
          : null
      );

      // Wait a moment for the image to be fully processed
      setTimeout(async () => {
        await loadProfileData();
      }, 1000);

      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("❌ Error uploading profile picture:", error);
      Alert.alert("Error", "Failed to upload profile picture");
    } finally {
      setUploadingImage(false);
    }
  };

  // NEW: Toggle day expansion
  const toggleDay = (dayId: number) => {
    const newExpandedDays = new Set(expandedDays);
    if (newExpandedDays.has(dayId)) {
      newExpandedDays.delete(dayId);
    } else {
      newExpandedDays.add(dayId);
    }
    setExpandedDays(newExpandedDays);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
  };

  const showHelpSupport = () => {
    setShowHelpModal(true);
  };

  const handleContactSupport = () => {
    const email = "support@example.com";
    const subject = "Support Request";
    const body = "Hi, I need help with...";
    const mailto = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    Linking.openURL(mailto);
  };

  const getBadgeStyle = (achievement: Achievement) => {
    if (!achievement.unlocked) {
      return {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      };
    }

    const tierIndex = ACHIEVEMENT_TARGETS.indexOf(achievement.target);
    const badgeDesigns = [
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887", tier: "Bronze" },
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887", tier: "Bronze" },
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887", tier: "Bronze" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8", tier: "Silver" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8", tier: "Silver" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8", tier: "Silver" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500", tier: "Gold" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500", tier: "Gold" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500", tier: "Gold" },
      { backgroundColor: "#E0BBE4", borderColor: "#D8BFD8", tier: "Platinum" },
      { backgroundColor: "#E0BBE4", borderColor: "#D8BFD8", tier: "Platinum" },
      { backgroundColor: "#FFB6C1", borderColor: "#FF69B4", tier: "Diamond" },
    ];

    return {
      backgroundColor: badgeDesigns[tierIndex]?.backgroundColor || "#f3f4f6",
      borderColor: badgeDesigns[tierIndex]?.borderColor || "#e5e7eb",
    };
  };

  const getBadgeDesign = (achievement: Achievement) => {
    const tierIndex = ACHIEVEMENT_TARGETS.indexOf(achievement.target);
    const badgeDesigns = [
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Platinum", emoji: "💎" },
      { tier: "Platinum", emoji: "💎" },
      { tier: "Diamond", emoji: "👑" },
    ];

    return badgeDesigns[tierIndex] || { tier: "Bronze", emoji: "🏅" };
  };

  // NEW: Render daily routines section
  const renderDailyRoutinesSection = () => {
    return (
      <View
        style={[
          styles.dailyRoutinesSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color="#007AFF" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Daily Routines Schedule
          </Text>
        </View>

        {DAYS_OF_WEEK.map((day) => {
          const isExpanded = expandedDays.has(day.id);
          const routinesForDay = dayRoutines[day.id] || [];

          return (
            <View key={day.id} style={styles.dayContainer}>
              <TouchableOpacity
                style={[styles.dayHeader, { borderColor: colors.border }]}
                onPress={() => toggleDay(day.id)}
              >
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.dayName, { color: colors.text }]}>
                    {day.name}
                  </Text>
                  <Text
                    style={[
                      styles.routineCount,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {routinesForDay.length} routine
                    {routinesForDay.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View
                  style={[
                    styles.dayContent,
                    { backgroundColor: colors.background },
                  ]}
                >
                  {routinesForDay.length === 0 ? (
                    <Text
                      style={[
                        styles.noRoutinesText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      No routines scheduled for {day.name}
                    </Text>
                  ) : (
                    routinesForDay.map((routine) => (
                      <View
                        key={routine.id}
                        style={[
                          styles.routineItem,
                          { borderColor: colors.border },
                        ]}
                      >
                        <Ionicons
                          name={(routine.icon as any) || "checkmark-circle"}
                          size={20}
                          color="#007AFF"
                        />
                        <View style={styles.routineInfo}>
                          <Text
                            style={[styles.routineName, { color: colors.text }]}
                          >
                            {routine.name}
                          </Text>
                          {routine.description && (
                            <Text
                              style={[
                                styles.routineDescription,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {routine.description}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderAchievementsSection = () => {
    const accomplishedAchievements = achievements.filter((a) => a.unlocked);

    if (accomplishedAchievements.length === 0) {
      return (
        <View style={styles.emptyAchievements}>
          <Ionicons name="trophy" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyAchievementsText, { color: colors.text }]}>
            No achievements yet
          </Text>
          <Text
            style={[
              styles.emptyAchievementsSubtext,
              { color: colors.textSecondary },
            ]}
          >
            Complete daily routines to earn your first achievement!
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementsScrollContainer}
      >
        {accomplishedAchievements.map((achievement) => {
          const badgeStyle = getBadgeStyle(achievement);
          const badgeDesign = getBadgeDesign(achievement);

          return (
            <View
              key={achievement.id}
              style={styles.accomplishedAchievementCard}
            >
              <View style={[styles.accomplishedBadge, badgeStyle]}>
                <Text style={styles.accomplishedBadgeEmoji}>
                  {badgeDesign.emoji}
                </Text>
                <View style={styles.accomplishedBadgeNumber}>
                  <Text style={styles.accomplishedBadgeNumberText}>
                    {achievement.target}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.accomplishedAchievementTitle,
                  { color: colors.text },
                ]}
              >
                {achievement.target} Day{achievement.target === 1 ? "" : "s"}
              </Text>
              <Text
                style={[
                  styles.accomplishedAchievementTier,
                  { color: colors.textSecondary },
                ]}
              >
                {badgeDesign.tier}
              </Text>
              {achievement.unlockedDate && (
                <Text
                  style={[
                    styles.accomplishedAchievementDate,
                    { color: colors.textTertiary },
                  ]}
                >
                  {new Date(achievement.unlockedDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const menuItems = [
    {
      title: "Settings",
      subtitle: "Notifications, preferences, and more",
      icon: "settings",
      onPress: () => navigation.navigate("Settings"),
    },
    {
      title: "Help & Support",
      subtitle: "Get help or contact us",
      icon: "help-circle",
      onPress: showHelpSupport,
    },
  ];

  if (loading) {
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
            Profile
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Profile
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Section */}
        <View
          style={[
            styles.userSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleProfilePicturePress}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.border },
                ]}
              >
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            ) : profile?.avatar_url ? (
              <Image
                source={{
                  uri: profile.avatar_url.includes("?")
                    ? profile.avatar_url
                    : `${profile.avatar_url}?t=${Date.now()}`,
                }}
                style={styles.avatarImage}
                onError={(error) => {
                  console.log(
                    "❌ Error loading avatar image:",
                    error.nativeEvent.error
                  );
                  console.log("❌ Failed URL:", profile.avatar_url);
                }}
                onLoad={() => {
                  console.log("✅ Avatar image loaded successfully");
                }}
                onLoadStart={() => {
                  console.log("🔄 Started loading avatar image...");
                }}
                onLoadEnd={() => {
                  console.log("🏁 Finished loading avatar image");
                }}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.border },
                ]}
              >
                <Ionicons
                  name="person"
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.text }]}>
            {profile?.display_name || profile?.full_name || "User"}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {profile?.email}
          </Text>
          <Text style={[styles.joinDate, { color: colors.textTertiary }]}>
            Joined{" "}
            {new Date(profile?.created_at || "").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* NEW: Daily Routines Section */}
        {renderDailyRoutinesSection()}

        {/* Achievements Section */}
        <View
          style={[
            styles.achievementsSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.achievementsHeader}>
            <Ionicons name="trophy" size={20} color="#007AFF" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Achievements
            </Text>
            <View
              style={[
                styles.achievementCount,
                { backgroundColor: "#007AFF20" },
              ]}
            >
              <Text style={[styles.achievementCountText, { color: "#007AFF" }]}>
                {achievements.filter((a) => a.unlocked).length}/
                {achievements.length}
              </Text>
            </View>
          </View>
          {renderAchievementsSection()}
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIconContainer,
                    { backgroundColor: "#007AFF20" },
                  ]}
                >
                  <Ionicons name={item.icon as any} size={18} color="#007AFF" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.menuItemSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.imagePickerOverlay}>
          <View
            style={[
              styles.imagePickerContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.imagePickerTitle, { color: colors.text }]}>
              Change Profile Picture
            </Text>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => pickImage(true)}
            >
              <Ionicons name="camera" size={24} color="#007AFF" />
              <Text
                style={[styles.imagePickerOptionText, { color: colors.text }]}
              >
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => pickImage(false)}
            >
              <Ionicons name="images" size={24} color="#007AFF" />
              <Text
                style={[styles.imagePickerOptionText, { color: colors.text }]}
              >
                Choose from Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imagePickerCancel,
                { borderTopColor: colors.border },
              ]}
              onPress={() => setShowImagePicker(false)}
            >
              <Text
                style={[
                  styles.imagePickerCancelText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Help & Support
            </Text>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                Contact Support
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleContactSupport}
              >
                <Text style={styles.modalButtonText}>Send Email</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                Privacy
              </Text>
              <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                Only your display name and streak counts are visible to other
                users.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  userSection: {
    alignItems: "center",
    paddingVertical: 30,
    marginTop: 15,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 15,
    position: "relative",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 10,
  },
  joinDate: {
    fontSize: 14,
  },

  // NEW: Daily Routines Section Styles
  dailyRoutinesSection: {
    marginTop: 15,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  dayContainer: {
    marginBottom: 8,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  routineCount: {
    fontSize: 12,
  },
  dayContent: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  noRoutinesText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  routineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  routineInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routineName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  routineDescription: {
    fontSize: 12,
  },

  // Achievements Section Styles
  achievementsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 15,
    borderBottomWidth: 1,
  },
  achievementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 8,
  },
  achievementCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  achievementCountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  achievementsScrollContainer: {
    paddingRight: 20,
    gap: 16,
  },
  accomplishedAchievementCard: {
    alignItems: "center",
    width: 100,
  },
  accomplishedBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  accomplishedBadgeEmoji: {
    fontSize: 24,
  },
  accomplishedBadgeNumber: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
    minWidth: 20,
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  accomplishedBadgeNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#333",
  },
  accomplishedAchievementTitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  accomplishedAchievementTier: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  accomplishedAchievementDate: {
    fontSize: 9,
    textAlign: "center",
  },
  emptyAchievements: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyAchievementsText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyAchievementsSubtext: {
    fontSize: 14,
    textAlign: "center",
  },

  // Menu styles
  menuSection: {
    marginTop: 15,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
  },

  // Image Picker Modal Styles
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  imagePickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area padding
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  imagePickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  imagePickerOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  imagePickerCancel: {
    borderTopWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: "500",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
