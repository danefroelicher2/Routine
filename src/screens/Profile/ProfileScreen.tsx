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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { Profile, UserSettings } from "../../types/database";

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

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // NEW: Achievement state (same as StatsScreen)
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // NEW: Achievement targets (same as StatsScreen)
  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 100, 150, 200, 250, 300, 365,
  ];

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

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

      // NEW: Load achievements
      await calculateAchievements(user.id);
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // NEW: Achievement calculation logic (same as StatsScreen)
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  // NEW: Get badge design for profile display (compact version)
  const getBadgeDesign = (target: number, isUnlocked: boolean) => {
    if (target <= 30) {
      return {
        type: "basic",
        backgroundColor: isUnlocked ? "#10b981" : "#d1d5db",
        borderColor: isUnlocked ? "#059669" : "#9ca3af",
        icon: "star",
        iconColor: isUnlocked ? "#fff" : "#6b7280",
        ribbonColor: isUnlocked ? "#059669" : "#9ca3af",
        tier: "STARTER",
      };
    } else if (target <= 150) {
      return {
        type: "shield",
        backgroundColor: isUnlocked ? "#3b82f6" : "#d1d5db",
        borderColor: isUnlocked ? "#2563eb" : "#9ca3af",
        icon: "shield-checkmark",
        iconColor: isUnlocked ? "#fff" : "#6b7280",
        ribbonColor: isUnlocked ? "#2563eb" : "#9ca3af",
        tier: "BUILDER",
      };
    } else if (target <= 300) {
      return {
        type: "premium",
        backgroundColor: isUnlocked ? "#8b5cf6" : "#d1d5db",
        borderColor: isUnlocked ? "#7c3aed" : "#9ca3af",
        icon: "diamond",
        iconColor: isUnlocked ? "#fff" : "#6b7280",
        ribbonColor: isUnlocked ? "#7c3aed" : "#9ca3af",
        tier: "CHAMPION",
      };
    } else {
      return {
        type: "ultimate",
        backgroundColor: isUnlocked ? "#f59e0b" : "#d1d5db",
        borderColor: isUnlocked ? "#d97706" : "#9ca3af",
        icon: "trophy",
        iconColor: isUnlocked ? "#fff" : "#6b7280",
        ribbonColor: isUnlocked ? "#d97706" : "#9ca3af",
        tier: "LEGEND",
      };
    }
  };

  // NEW: Render accomplished achievements section
  const renderAccomplishedAchievements = () => {
    const unlockedAchievements = achievements.filter((a) => a.unlocked);

    if (unlockedAchievements.length === 0) {
      return (
        <View style={styles.achievementsSection}>
          <View style={styles.achievementsHeader}>
            <Ionicons name="trophy" size={20} color="#ffd700" />
            <Text style={styles.sectionTitle}>Accomplished Achievements</Text>
          </View>
          <View style={styles.emptyAchievements}>
            <Ionicons name="medal-outline" size={48} color="#ccc" />
            <Text style={styles.emptyAchievementsText}>
              No achievements yet
            </Text>
            <Text style={styles.emptyAchievementsSubtext}>
              Complete your daily routines to start earning badges!
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.achievementsSection}>
        <View style={styles.achievementsHeader}>
          <Ionicons name="trophy" size={20} color="#ffd700" />
          <Text style={styles.sectionTitle}>Accomplished Achievements</Text>
          <Text style={styles.achievementCount}>
            {unlockedAchievements.length}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.achievementsScrollContainer}
        >
          {unlockedAchievements.map((achievement) => {
            const badgeDesign = getBadgeDesign(achievement.target, true);

            return (
              <View
                key={achievement.id}
                style={styles.accomplishedAchievementCard}
              >
                {/* Badge */}
                <View
                  style={[
                    styles.accomplishedBadge,
                    {
                      backgroundColor: badgeDesign.backgroundColor,
                      borderColor: badgeDesign.borderColor,
                    },
                  ]}
                >
                  <Ionicons
                    name={badgeDesign.icon as any}
                    size={24}
                    color={badgeDesign.iconColor}
                  />
                  <View style={styles.accomplishedBadgeNumber}>
                    <Text style={styles.accomplishedBadgeNumberText}>
                      {achievement.target}
                    </Text>
                  </View>
                </View>

                {/* Info */}
                <Text style={styles.accomplishedAchievementTitle}>
                  {achievement.target} Day{achievement.target > 1 ? "s" : ""}
                </Text>
                <Text style={styles.accomplishedAchievementTier}>
                  {badgeDesign.tier}
                </Text>
                {achievement.unlockedDate && (
                  <Text style={styles.accomplishedAchievementDate}>
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
      </View>
    );
  };

  const menuItems = [
    {
      title: "Manage Routines",
      subtitle: "Add, edit, or remove your routines",
      icon: "list",
      onPress: () => navigation.navigate("RoutineManager"),
    },
    {
      title: "Settings",
      subtitle: "Notifications, preferences, and more",
      icon: "settings",
      onPress: () => navigation.navigate("Settings"),
    },
    {
      title: "View Statistics",
      subtitle: "See your progress and achievements",
      icon: "stats-chart",
      onPress: () => navigation.navigate("Stats"),
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Info Section */}
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#007AFF" />
          </View>
          <Text style={styles.userName}>{profile?.full_name || "User"}</Text>
          <Text style={styles.userEmail}>
            {profile?.email || "user@example.com"}
          </Text>
          <Text style={styles.joinDate}>
            Member since{" "}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : "Unknown"}
          </Text>
        </View>

        {/* NEW: Accomplished Achievements Section (replaces Quick Stats) */}
        {renderAccomplishedAchievements()}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon as any} size={20} color="#007AFF" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
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
    color: "#666",
  },
  userSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 30,
    marginTop: 15,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
  },
  joinDate: {
    fontSize: 14,
    color: "#999",
  },
  // NEW: Accomplished Achievements Styles
  achievementsSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 15,
  },
  achievementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  achievementCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
    color: "#333",
    textAlign: "center",
    marginBottom: 2,
  },
  accomplishedAchievementTier: {
    fontSize: 10,
    fontWeight: "700",
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
  },
  accomplishedAchievementDate: {
    fontSize: 9,
    color: "#999",
    textAlign: "center",
  },
  emptyAchievements: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyAchievementsText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyAchievementsSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  // Existing menu styles
  menuSection: {
    backgroundColor: "#fff",
    marginTop: 15,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
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
    backgroundColor: "#f0f8ff",
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
    color: "#333",
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  signOutSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ff6b6b",
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff6b6b",
    marginLeft: 8,
  },
});
