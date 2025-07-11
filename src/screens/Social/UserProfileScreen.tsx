import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { Profile, UserRoutine } from "../../types/database";
import { useTheme } from "../../../ThemeContext";

const { width } = Dimensions.get("window");

interface UserProfileScreenProps {
  navigation: any;
  route: {
    params: {
      userId: string;
      displayName: string;
    };
  };
}

interface Achievement {
  id: string;
  name: string;
  target: number;
  unlocked: boolean;
  unlockedDate?: string;
}

interface DayRoutines {
  [key: number]: UserRoutine[];
}

export default function UserProfileScreen({
  navigation,
  route,
}: UserProfileScreenProps) {
  const { userId, displayName } = route.params;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dayRoutines, setDayRoutines] = useState<DayRoutines>({});
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [avatarData, setAvatarData] = useState<string | null>(null);

  const { colors } = useTheme();

  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 100, 150, 200, 250, 300, 365,
  ];

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
      loadUserProfile();
    }, [userId])
  );

  // Load user profile data
  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(data);
      loadAchievements(data.current_streak, data.longest_streak);
      loadUserRoutines();
      loadAvatarAsBase64(data.avatar_url);
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load avatar image
  const loadAvatarAsBase64 = async (avatarUrl: string | null) => {
    if (!avatarUrl) {
      setAvatarData(null);
      return;
    }

    try {
      const { data } = await supabase.storage
        .from("avatars")
        .download(avatarUrl);
      if (data) {
        const reader = new FileReader();
        reader.onload = () => {
          setAvatarData(reader.result as string);
        };
        reader.readAsDataURL(data);
      }
    } catch (error) {
      console.error("Error loading avatar:", error);
      setAvatarData(null);
    }
  };

  // Generate achievements based on streak data
  const loadAchievements = (currentStreak: number, longestStreak: number) => {
    const achievementsList = ACHIEVEMENT_TARGETS.map((target) => ({
      id: target.toString(),
      name: `${target} Day${target > 1 ? "s" : ""}`,
      target,
      unlocked: longestStreak >= target,
      unlockedDate:
        longestStreak >= target ? new Date().toISOString() : undefined,
    }));

    setAchievements(achievementsList);
  };

  // Load user's routines (public routines only)
  const loadUserRoutines = async () => {
    try {
      const { data, error } = await supabase
        .from("user_routines")
        .select(
          `
          id,
          name,
          description,
          category,
          emoji,
          is_public,
          scheduled_days
        `
        )
        .eq("user_id", userId)
        .eq("is_public", true)
        .eq("is_active", true);

      if (error) throw error;

      // Group routines by day of week
      const groupedRoutines: DayRoutines = {};

      data?.forEach((routine) => {
        const scheduledDays = routine.scheduled_days || [];
        scheduledDays.forEach((day: number) => {
          if (!groupedRoutines[day]) {
            groupedRoutines[day] = [];
          }
          groupedRoutines[day].push(routine);
        });
      });

      setDayRoutines(groupedRoutines);
    } catch (error) {
      console.error("Error loading user routines:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserProfile();
  };

  const toggleDay = (dayId: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayId)) {
      newExpanded.delete(dayId);
    } else {
      newExpanded.add(dayId);
    }
    setExpandedDays(newExpanded);
  };

  const getBadgeDesign = (target: number) => {
    if (target <= 7) return { emoji: "🌱", tier: "Beginner" };
    if (target <= 30) return { emoji: "🌿", tier: "Growing" };
    if (target <= 100) return { emoji: "🌳", tier: "Strong" };
    if (target <= 200) return { emoji: "🏆", tier: "Elite" };
    return { emoji: "👑", tier: "Legendary" };
  };

  const renderAvatar = () => {
    if (avatarData) {
      return <Image source={{ uri: avatarData }} style={styles.avatarImage} />;
    }
    return (
      <View
        style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="person" size={40} color={colors.textSecondary} />
      </View>
    );
  };

  const renderAchievements = () => {
    if (achievements.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.achievementsScroll}
        contentContainerStyle={styles.achievementsContainer}
      >
        {achievements.map((achievement) => {
          const badgeDesign = getBadgeDesign(achievement.target);
          return (
            <View
              key={achievement.id}
              style={[
                styles.achievementBadge,
                {
                  backgroundColor: achievement.unlocked
                    ? "#FFD700"
                    : colors.surface,
                  borderColor: achievement.unlocked ? "#FFD700" : colors.border,
                },
              ]}
            >
              <Text style={styles.achievementEmoji}>{badgeDesign.emoji}</Text>
              <Text
                style={[
                  styles.achievementTarget,
                  {
                    color: achievement.unlocked ? "#000" : colors.text,
                    fontWeight: achievement.unlocked ? "bold" : "600",
                  },
                ]}
              >
                {achievement.target} Day{achievement.target > 1 ? "s" : ""}
              </Text>
              <Text
                style={[
                  styles.accomplishedAchievementTier,
                  {
                    color: achievement.unlocked ? "#000" : colors.textSecondary,
                  },
                ]}
              >
                {badgeDesign.tier}
              </Text>
              {achievement.unlockedDate && (
                <Text
                  style={[
                    styles.accomplishedAchievementDate,
                    { color: "#000" },
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {displayName}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            User Profile
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Profile not found
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {profile.display_name || profile.full_name || "User"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={[
            styles.userSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.avatarContainer}>{renderAvatar()}</View>

          <Text style={[styles.userName, { color: colors.text }]}>
            {profile.display_name || profile.full_name || "User"}
          </Text>
          <Text style={[styles.joinDate, { color: colors.textTertiary }]}>
            Joined{" "}
            {new Date(profile.created_at || "").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>

          <View style={styles.streakContainer}>
            <View style={styles.streakItem}>
              <View style={styles.streakIconContainer}>
                <Ionicons name="flame" size={20} color="#FF6B35" />
              </View>
              <Text style={[styles.streakNumber, { color: colors.text }]}>
                {profile.current_streak || 0}
              </Text>
              <Text
                style={[styles.streakLabel, { color: colors.textSecondary }]}
              >
                Current
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.streakItem}>
              <View style={styles.streakIconContainer}>
                <Ionicons name="trophy" size={20} color="#FFD700" />
              </View>
              <Text style={[styles.streakNumber, { color: colors.text }]}>
                {profile.longest_streak || 0}
              </Text>
              <Text
                style={[styles.streakLabel, { color: colors.textSecondary }]}
              >
                Longest
              </Text>
            </View>
          </View>
        </View>

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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Achievements
          </Text>
          {renderAchievements()}
        </View>

        {/* Public Routines Section */}
        <View
          style={[
            styles.dailyRoutinesSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Public Routines
          </Text>

          {Object.keys(dayRoutines).length === 0 ? (
            <Text
              style={[styles.noRoutinesText, { color: colors.textSecondary }]}
            >
              No public routines shared
            </Text>
          ) : (
            DAYS_OF_WEEK.map((day) => {
              const dayRoutinesList = dayRoutines[day.id] || [];
              if (dayRoutinesList.length === 0) return null;

              const isExpanded = expandedDays.has(day.id);

              return (
                <View key={day.id} style={styles.dayContainer}>
                  <TouchableOpacity
                    style={styles.dayHeader}
                    onPress={() => toggleDay(day.id)}
                  >
                    <Text style={[styles.dayName, { color: colors.text }]}>
                      {day.name}
                    </Text>
                    <View style={styles.dayHeaderRight}>
                      <Text
                        style={[
                          styles.routineCount,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {dayRoutinesList.length} routine
                        {dayRoutinesList.length !== 1 ? "s" : ""}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.routinesList}>
                      {dayRoutinesList.map((routine) => (
                        <View
                          key={routine.id}
                          style={[
                            styles.routineItem,
                            { backgroundColor: colors.background },
                          ]}
                        >
                          <Text style={styles.routineEmoji}>
                            {routine.emoji || "📋"}
                          </Text>
                          <View style={styles.routineInfo}>
                            <Text
                              style={[
                                styles.routineName,
                                { color: colors.text },
                              ]}
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
                            <Text
                              style={[
                                styles.routineCategory,
                                { color: colors.textTertiary },
                              ]}
                            >
                              {routine.category}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  userSection: {
    alignItems: "center",
    paddingVertical: 30,
    marginTop: 15,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 15,
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
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  joinDate: {
    fontSize: 14,
    marginBottom: 20,
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  streakItem: {
    alignItems: "center",
    flex: 1,
  },
  streakIconContainer: {
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 14,
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 20,
  },
  achievementsSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  achievementsScroll: {
    paddingLeft: 20,
  },
  achievementsContainer: {
    paddingRight: 20,
  },
  achievementBadge: {
    alignItems: "center",
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 80,
  },
  achievementEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  achievementTarget: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 2,
  },
  accomplishedAchievementTier: {
    fontSize: 10,
    textAlign: "center",
  },
  accomplishedAchievementDate: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 2,
  },
  dailyRoutinesSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  noRoutinesText: {
    textAlign: "center",
    fontSize: 16,
    fontStyle: "italic",
    marginTop: 10,
  },
  dayContainer: {
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  dayName: {
    fontSize: 18,
    fontWeight: "600",
  },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  routineCount: {
    fontSize: 14,
    marginRight: 8,
  },
  routinesList: {
    paddingLeft: 15,
  },
  routineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  routineEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  routineDescription: {
    fontSize: 14,
    marginBottom: 2,
  },
  routineCategory: {
    fontSize: 12,
    textTransform: "uppercase",
  },
});
