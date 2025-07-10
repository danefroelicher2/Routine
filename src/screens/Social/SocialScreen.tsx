import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../../ThemeContext";
import SocialStatsCard from "./SocialStatsCard";

const { width } = Dimensions.get("window");

// Types for our leaderboard data
interface LeaderboardUser {
  id: string;
  display_name: string;
  current_streak: number;
  longest_streak: number;
  rank: number;
  join_date: string;
}

interface UserProfile {
  id: string;
  display_name?: string;
  show_in_leaderboard: boolean;
  current_streak: number;
  longest_streak: number;
}

export default function SocialScreen() {
  // State management
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // NEW: Community stats
  const [communityStats, setCommunityStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    averageStreak: 0,
    topStreak: 0,
  });

  // Theme
  const { colors } = useTheme();

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSocialData();
    }, [])
  );

  // Main data loading function
  const loadSocialData = async () => {
    try {
      await Promise.all([
        loadLeaderboard(),
        loadUserProfile(),
        updateUserStreaks(),
        loadCommunityStats(), // NEW: Load community stats
      ]);
    } catch (error) {
      console.error("Error loading social data:", error);
      Alert.alert("Error", "Failed to load social data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // NEW: Load community statistics
  const loadCommunityStats = async () => {
    try {
      // Get total users count
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("show_in_leaderboard", true);

      // Get users active today (have current_streak > 0)
      const { count: activeToday } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("current_streak", 0)
        .eq("show_in_leaderboard", true);

      // Get average and top streak from leaderboard
      const { data: streakData } = await supabase
        .from("profiles")
        .select("current_streak, longest_streak")
        .eq("show_in_leaderboard", true)
        .gt("current_streak", 0);

      let averageStreak = 0;
      let topStreak = 0;

      if (streakData && streakData.length > 0) {
        const totalStreak = streakData.reduce((sum, user) => sum + (user.current_streak || 0), 0);
        averageStreak = Math.round(totalStreak / streakData.length);
        topStreak = Math.max(...streakData.map(user => user.longest_streak || 0));
      }

      setCommunityStats({
        totalUsers: totalUsers || 0,
        activeToday: activeToday || 0,
        averageStreak,
        topStreak,
      });

    } catch (error) {
      console.error("Error loading community stats:", error);
    }

  // Load leaderboard data from our view
  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from("leaderboard_view")
        .select("*")
        .limit(50); // Top 50 users

      if (error) throw error;

      setLeaderboard(data || []);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  };

  // Load current user's profile and settings
  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, show_in_leaderboard, current_streak, longest_streak")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setUserProfile(data);
      setDisplayName(data?.display_name || "");
      setShowInLeaderboard(data?.show_in_leaderboard ?? true);

      // Find user's rank in leaderboard
      if (data?.show_in_leaderboard) {
        const { data: rankData, error: rankError } = await supabase
          .from("leaderboard_view")
          .select("rank")
          .eq("id", user.id)
          .single();

        if (!rankError && rankData) {
          setUserRank(rankData.rank);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  // Update user's streak data based on their actual performance
  const updateUserStreaks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate streaks using the same logic as StatsScreen
      const [completionsResult, userRoutinesResult, dayRoutinesResult] = await Promise.all([
        supabase
          .from("routine_completions")
          .select("completion_date, routine_id")
          .eq("user_id", user.id)
          .order("completion_date", { ascending: false }),
        supabase
          .from("user_routines")
          .select("id, is_weekly")
          .eq("user_id", user.id),
        supabase
          .from("user_day_routines")
          .select("routine_id, day_of_week")
          .eq("user_id", user.id),
      ]);

      if (completionsResult.error || userRoutinesResult.error || dayRoutinesResult.error) {
        throw new Error("Failed to fetch streak data");
      }

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayRoutines = dayRoutinesResult.data || [];

      // Calculate streaks (same logic as StatsScreen)
      const { currentStreak, longestStreak } = calculateStreaks(completions, userRoutines, dayRoutines);

      // Update the profile with calculated streaks
      const { error: updateError } = await supabase
        .rpc("update_user_streaks", {
          user_id: user.id,
          new_current_streak: currentStreak,
          new_longest_streak: longestStreak,
        });

      if (updateError) {
        console.error("Error updating streaks:", updateError);
      }

    } catch (error) {
      console.error("Error updating user streaks:", error);
    }
  };

  // Calculate streaks helper function (adapted from StatsScreen logic)
  const calculateStreaks = (completions: any[], userRoutines: any[], dayRoutines: any[]) => {
    const successDays = new Set<string>();
    const today = new Date().toISOString().split("T")[0];

    // Group day routines by day
    const routinesByDay: { [key: number]: string[] } = {};
    dayRoutines.forEach((dr) => {
      if (!routinesByDay[dr.day_of_week]) {
        routinesByDay[dr.day_of_week] = [];
      }
      routinesByDay[dr.day_of_week].push(dr.routine_id);
    });

    // Check each day going back
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const dayOfWeek = checkDate.getDay();

      const completedRoutineIds = completions
        .filter((c) => c.completion_date === dateStr)
        .map((c) => c.routine_id);

      const dailyRoutineIds = routinesByDay[dayOfWeek] || [];
      const dailyRoutines = userRoutines.filter(
        (routine) => !routine.is_weekly && dailyRoutineIds.includes(routine.id)
      );

      const allCompleted = dailyRoutines.length > 0 && 
        dailyRoutines.every((routine) => completedRoutineIds.includes(routine.id));

      if (allCompleted) {
        successDays.add(dateStr);
      }
    }

    const successDatesArray = Array.from(successDays).sort();

    // Calculate current streak
    let currentStreak = 0;
    const todayDate = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(todayDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split("T")[0];

      if (successDays.has(checkDateStr)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    if (successDatesArray.length > 0) {
      let currentLength = 1;

      for (let i = 1; i < successDatesArray.length; i++) {
        const prevDate = new Date(successDatesArray[i - 1]);
        const currDate = new Date(successDatesArray[i]);
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

        if (dayDiff === 1) {
          currentLength++;
        } else {
          longestStreak = Math.max(longestStreak, currentLength);
          currentLength = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentLength);
    }

    return { currentStreak, longestStreak };
  };

  // Handle profile settings update
  const updateProfile = async () => {
    if (updating) return;
    
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          show_in_leaderboard: showInLeaderboard,
        })
        .eq("id", user.id);

      if (error) throw error;

      setShowSettings(false);
      await loadSocialData(); // Refresh data
      Alert.alert("Success", "Profile updated successfully!");

    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadSocialData();
  };

  // Get trophy color based on rank
  const getTrophyColor = (rank: number) => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#C0C0C0"; // Silver
    if (rank === 3) return "#CD7F32"; // Bronze
    return colors.textTertiary;
  };

  // Get rank display (with emoji for top 3)
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  // Render individual leaderboard item
  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const isCurrentUser = userProfile?.id === item.id;
    const streakDiff = item.current_streak - item.longest_streak;

    return (
      <View
        style={[
          styles.leaderboardItem,
          {
            backgroundColor: isCurrentUser ? `${colors.primary}15` : colors.surface,
            borderColor: isCurrentUser ? colors.primary : colors.border,
            borderWidth: isCurrentUser ? 2 : 1,
          },
        ]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, { color: getTrophyColor(item.rank) }]}>
            {getRankDisplay(item.rank)}
          </Text>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text
            style={[
              styles.displayName,
              { color: colors.text },
              isCurrentUser && { fontWeight: "bold" },
            ]}
            numberOfLines={1}
          >
            {item.display_name}
            {isCurrentUser && " (You)"}
          </Text>
          <Text style={[styles.joinDate, { color: colors.textSecondary }]}>
            Member since {new Date(item.join_date).toLocaleDateString()}
          </Text>
        </View>

        {/* Streak Info */}
        <View style={styles.streakInfo}>
          <View style={styles.streakContainer}>
            <Ionicons name="flame" size={16} color="#ff6b35" />
            <Text style={[styles.currentStreak, { color: "#ff6b35" }]}>
              {item.current_streak}
            </Text>
          </View>
          <Text style={[styles.longestStreak, { color: colors.textSecondary }]}>
            Best: {item.longest_streak}
          </Text>
        </View>
      </View>
    );
  };

  // Render header with user's rank and quick stats
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.headerTop}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Leaderboard
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            See how you rank against other users
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: colors.background }]}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* User's current position */}
      {userProfile?.show_in_leaderboard && userRank && (
        <View style={[styles.userRankCard, { backgroundColor: colors.background }]}>
          <View style={styles.userRankLeft}>
            <Text style={[styles.yourRankLabel, { color: colors.textSecondary }]}>
              Your Rank
            </Text>
            <Text style={[styles.yourRank, { color: getTrophyColor(userRank) }]}>
              {getRankDisplay(userRank)}
            </Text>
          </View>
          <View style={styles.userRankRight}>
            <View style={styles.userStreakContainer}>
              <Ionicons name="flame" size={18} color="#ff6b35" />
              <Text style={[styles.userCurrentStreak, { color: "#ff6b35" }]}>
                {userProfile.current_streak} days
              </Text>
            </View>
            <Text style={[styles.userLongestStreak, { color: colors.textSecondary }]}>
              Best: {userProfile.longest_streak} days
            </Text>
          </View>
        </View>
      )}

      {!userProfile?.show_in_leaderboard && (
        <View style={[styles.hiddenCard, { backgroundColor: colors.background }]}>
          <Ionicons name="eye-off" size={24} color={colors.textSecondary} />
          <Text style={[styles.hiddenText, { color: colors.textSecondary }]}>
            You're hidden from the leaderboard
          </Text>
          <TouchableOpacity
            style={[styles.showButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.showButtonText}>Show me</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Community Stats Card */}
      <SocialStatsCard
        totalUsers={communityStats.totalUsers}
        activeToday={communityStats.activeToday}
        averageStreak={communityStats.averageStreak}
        topStreak={communityStats.topStreak}
      />
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading leaderboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={leaderboard}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Social Settings
            </Text>
            <TouchableOpacity onPress={updateProfile} disabled={updating}>
              {updating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Display Name Setting */}
            <View style={styles.settingSection}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Display Name
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                This is how other users will see you on the leaderboard
              </Text>
              <TextInput
                style={[
                  styles.settingInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name (optional)"
                placeholderTextColor={colors.textSecondary}
                maxLength={30}
              />
            </View>

            {/* Leaderboard Visibility Setting */}
            <View style={styles.settingSection}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Show on Leaderboard
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Let other users see your ranking and streaks
                  </Text>
                </View>
                <Switch
                  value={showInLeaderboard}
                  onValueChange={setShowInLeaderboard}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={showInLeaderboard ? "#fff" : colors.textSecondary}
                />
              </View>
            </View>

            {/* Privacy Notice */}
            <View style={[styles.privacyNotice, { backgroundColor: colors.surface }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                Your email and personal information are never shared. Only your display name and streak counts are visible to other users.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  userRankCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  userRankLeft: {
    flex: 1,
  },
  yourRankLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  yourRank: {
    fontSize: 24,
    fontWeight: "bold",
  },
  userRankRight: {
    alignItems: "flex-end",
  },
  userStreakContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userCurrentStreak: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 4,
  },
  userLongestStreak: {
    fontSize: 14,
  },
  hiddenCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  hiddenText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  showButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  showButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
  },
  rankContainer: {
    width: 50,
    alignItems: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  joinDate: {
    fontSize: 12,
  },
  streakInfo: {
    alignItems: "flex-end",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  currentStreak: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
  },
  longestStreak: {
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  modalSave: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  settingInput: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  privacyNotice: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
});