// File: src/services/StreakSyncService.ts
import { supabase } from "./supabase";

export class StreakSyncService {
  // Sync user's streak data to profile for leaderboard
  static async syncUserStreaks(userId: string): Promise<void> {
    try {
      // Calculate current streaks using the same logic as StatsScreen
      const { currentStreak, longestStreak } = await this.calculateUserStreaks(
        userId
      );

      // Update profile with calculated streaks
      const { error } = await supabase.rpc("update_user_streaks", {
        user_id: userId,
        new_current_streak: currentStreak,
        new_longest_streak: longestStreak,
      });

      if (error) {
        console.error("Error updating user streaks:", error);
        throw error;
      }

      console.log(
        `✅ Synced streaks for user ${userId}: Current=${currentStreak}, Longest=${longestStreak}`
      );
    } catch (error) {
      console.error("Error syncing user streaks:", error);
      throw error;
    }
  }

  // Calculate streaks for a specific user
  private static async calculateUserStreaks(
    userId: string
  ): Promise<{ currentStreak: number; longestStreak: number }> {
    try {
      // Get user's completion data
      const [completionsResult, userRoutinesResult, dayRoutinesResult] =
        await Promise.all([
          supabase
            .from("routine_completions")
            .select("completion_date, routine_id")
            .eq("user_id", userId)
            .order("completion_date", { ascending: false }),
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
        throw new Error("Failed to fetch user data for streak calculation");
      }

      const completions = completionsResult.data || [];
      const userRoutines = userRoutinesResult.data || [];
      const dayRoutines = dayRoutinesResult.data || [];

      // Use the same calculation logic as StatsScreen
      return this.calculateStreaksFromData(
        completions,
        userRoutines,
        dayRoutines
      );
    } catch (error) {
      console.error("Error calculating user streaks:", error);
      return { currentStreak: 0, longestStreak: 0 };
    }
  }

  // Core streak calculation logic (mirrors StatsScreen)
  private static calculateStreaksFromData(
    completions: any[],
    userRoutines: any[],
    dayRoutines: any[]
  ): { currentStreak: number; longestStreak: number } {
    const successDays = new Set<string>();

    // Group day routines by day
    const routinesByDay: { [key: number]: string[] } = {};
    dayRoutines.forEach((dr) => {
      if (!routinesByDay[dr.day_of_week]) {
        routinesByDay[dr.day_of_week] = [];
      }
      routinesByDay[dr.day_of_week].push(dr.routine_id);
    });

    // Check each day going back 365 days
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

      const allCompleted =
        dailyRoutines.length > 0 &&
        dailyRoutines.every((routine) =>
          completedRoutineIds.includes(routine.id)
        );

      if (allCompleted) {
        successDays.add(dateStr);
      }
    }

    const successDatesArray = Array.from(successDays).sort();

    // Calculate current streak (working backwards from today)
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

    // Calculate longest streak by finding consecutive sequences
    let longestStreak = 0;
    if (successDatesArray.length > 0) {
      let currentLength = 1;

      for (let i = 1; i < successDatesArray.length; i++) {
        const prevDate = new Date(successDatesArray[i - 1]);
        const currDate = new Date(successDatesArray[i]);
        const dayDiff =
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

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
  }

  // Sync all users' streaks (for admin/maintenance use)
  static async syncAllUserStreaks(): Promise<void> {
    try {
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("show_in_leaderboard", true);

      if (error) throw error;

      console.log(`🔄 Starting streak sync for ${users?.length || 0} users...`);

      // Sync in batches of 10 to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < (users?.length || 0); i += batchSize) {
        const batch = users?.slice(i, i + batchSize) || [];

        await Promise.all(batch.map((user) => this.syncUserStreaks(user.id)));

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("✅ Completed streak sync for all users");
    } catch (error) {
      console.error("Error syncing all user streaks:", error);
      throw error;
    }
  }

  // Check if user's streak data needs updating (call this from HomeScreen)
  static async checkAndSyncUserStreaks(userId: string): Promise<void> {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("last_streak_update")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error checking last streak update:", error);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const lastUpdate = profile?.last_streak_update;

      // Sync if never updated or last update was not today
      if (!lastUpdate || lastUpdate !== today) {
        await this.syncUserStreaks(userId);
      }
    } catch (error) {
      console.error("Error checking and syncing user streaks:", error);
    }
  }
}
