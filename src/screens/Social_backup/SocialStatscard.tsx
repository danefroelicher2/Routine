import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../ThemeContext";

interface SocialStatsCardProps {
  totalUsers: number;
  activeToday: number;
  averageStreak: number;
  topStreak: number;
}

export default function SocialStatsCard({
  totalUsers,
  activeToday,
  averageStreak,
  topStreak,
}: SocialStatsCardProps) {
  const { colors } = useTheme();

  const stats = [
    {
      icon: "people",
      label: "Total Users",
      value: totalUsers.toLocaleString(),
      color: "#007AFF",
    },
    {
      icon: "flash",
      label: "Active Today",
      value: activeToday.toLocaleString(),
      color: "#34C759",
    },
    {
      icon: "analytics",
      label: "Avg Streak",
      value: `${averageStreak} days`,
      color: "#FF9500",
    },
    {
      icon: "trophy",
      label: "Top Streak",
      value: `${topStreak} days`,
      color: "#FFD700",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Community Stats
      </Text>
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${stat.color}20` },
              ]}
            >
              <Ionicons name={stat.icon as any} size={20} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
  },
});
