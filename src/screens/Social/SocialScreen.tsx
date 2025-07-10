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
// import SocialStatsCard from "./SocialStatsCard"; // Commented out until created

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

  // **FIXED: Load leaderboard data from our view - moved to component level**
  const loadLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          display_name,
          full_name,
          current_streak,
          longest_streak,
          created_at,
          show_in_leaderboard
        `
        )
        .eq("show_in_leaderboard", true)
        .order("current_streak", { ascending: false })
        .order("longest_streak", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Create leaderboard with rankings
      const leaderboardData = (data || []).map((user, index) => ({
        id: user.id,
        display_name: user.display_name || user.full_name || "Anonymous User",
        current_streak: user.current_streak || 0,
        longest_streak: user.longest_streak || 0,
        rank: index + 1,
        join_date: user.created_at,
      }));

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  }, []);

  // **FIXED: Load current user's profile and settings - moved to component level**
  const loadUserProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, full_name, show_in_leaderboard, current_streak, longest_streak"
        )
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const userProfileData = {
        id: data.id,
        display_name: data.display_name,
        show_in_leaderboard: data.show_in_leaderboard ?? true,
        current_streak: data.current_streak || 0,
        longest_streak: data.longest_streak || 0,
      };

      setUserProfile(userProfileData);
      setDisplayName(data?.display_name || data?.full_name || "");
      setShowInLeaderboard(data?.show_in_leaderboard ?? true);

      // Find user's rank in leaderboard
      if (data?.show_in_leaderboard) {
        const { data: rankData, error: rankError } = await supabase
          .from("profiles")
          .select("id")
          .eq("show_in_leaderboard", true)
          .gte("current_streak", data.current_streak || 0)
          .order("current_streak", { ascending: false });

        if (!rankError && rankData) {
          setUserRank(rankData.length);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }, []);

  // **FIXED: Update user's streak data - moved to component level**
  const updateUserStreaks = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // For now, we'll skip the complex streak calculation since we don't have StreakSyncService
      // This can be added later when the service is properly implemented
      console.log("Streak sync would happen here for user:", user.id);
    } catch (error) {
      console.error("Error updating user streaks:", error);
    }
  }, []);

  // **FIXED: Load community statistics - cleaned up and moved to component level**
  const loadCommunityStats = useCallback(async () => {
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
        const totalStreak = streakData.reduce(
          (sum, user) => sum + (user.current_streak || 0),
          0
        );
        averageStreak = Math.round(totalStreak / streakData.length);
        topStreak = Math.max(
          ...streakData.map((user) => user.longest_streak || 0)
        );
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
  }, []);

  // **FIXED: Main data loading function - now all functions are accessible**
  const loadSocialData = async () => {
    try {
      await Promise.all([
        loadLeaderboard(),
        loadUserProfile(),
        updateUserStreaks(),
        loadCommunityStats(),
      ]);
    } catch (error) {
      console.error("Error loading social data:", error);
      Alert.alert("Error", "Failed to load social data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSocialData();
    }, [])
  );

  // Handle profile settings update
  const updateProfile = async () => {
    if (updating) return;

    setUpdating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
  const renderLeaderboardItem = ({
    item,
    index,
  }: {
    item: LeaderboardUser;
    index: number;
  }) => {
    const isCurrentUser = userProfile?.id === item.id;
    const streakDiff = item.current_streak - item.longest_streak;

    return (
      <View
        style={[
          styles.leaderboardItem,
          {
            backgroundColor: isCurrentUser ? "#007AFF15" : colors.surface,
            borderColor: isCurrentUser ? "#007AFF" : colors.border,
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
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            See how you rank against other users
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.settingsButton,
            { backgroundColor: colors.background },
          ]}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* User's current position */}
      {userProfile?.show_in_leaderboard && userRank && (
        <View
          style={[styles.userRankCard, { backgroundColor: colors.background }]}
        >
          <View style={styles.userRankLeft}>
            <Text
              style={[styles.yourRankLabel, { color: colors.textSecondary }]}
            >
              Your Rank
            </Text>
            <Text
              style={[styles.yourRank, { color: getTrophyColor(userRank) }]}
            >
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
            <Text
              style={[
                styles.userLongestStreak,
                { color: colors.textSecondary },
              ]}
            >
              Best: {userProfile.longest_streak} days
            </Text>
          </View>
        </View>
      )}

      {!userProfile?.show_in_leaderboard && (
        <View
          style={[styles.hiddenCard, { backgroundColor: colors.background }]}
        >
          <Ionicons name="eye-off" size={24} color={colors.textSecondary} />
          <Text style={[styles.hiddenText, { color: colors.textSecondary }]}>
            You're hidden from the leaderboard
          </Text>
          <TouchableOpacity
            style={[styles.showButton, { backgroundColor: "#007AFF" }]}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.showButtonText}>Show me</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Community Stats Card */}
      {/* Temporarily comment out until SocialStatsCard is created */}
      {/*
      <SocialStatsCard
        totalUsers={communityStats.totalUsers}
        activeToday={communityStats.activeToday}
        averageStreak={communityStats.averageStreak}
        topStreak={communityStats.topStreak}
      />
      */}
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading leaderboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={leaderboard}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
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
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={[styles.modalCancel, { color: "#007AFF" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Social Settings
            </Text>
            <TouchableOpacity onPress={updateProfile} disabled={updating}>
              {updating ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={[styles.modalSave, { color: "#007AFF" }]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Display Name Setting */}
            <View style={styles.settingSection}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Display Name
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.textSecondary },
                ]}
              >
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
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Let other users see your ranking and streaks
                  </Text>
                </View>
                <Switch
                  value={showInLeaderboard}
                  onValueChange={setShowInLeaderboard}
                  trackColor={{ false: colors.border, true: "#007AFF" }}
                  thumbColor={showInLeaderboard ? "#fff" : colors.textSecondary}
                />
              </View>
            </View>

            {/* Privacy Notice */}
            <View
              style={[
                styles.privacyNotice,
                { backgroundColor: colors.surface },
              ]}
            >
              <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
              <Text
                style={[styles.privacyText, { color: colors.textSecondary }]}
              >
                Your email and personal information are never shared. Only your
                display name and streak counts are visible to other users.
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
