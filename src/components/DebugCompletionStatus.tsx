// src/components/DebugCompletionStatus.tsx
// ✅ TEMPORARY DEBUG COMPONENT - Add this to HomeScreen to verify the fix

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../services/supabase';
import { useTheme } from '../../ThemeContext';

// ✅ Same utility function as HomeScreen and StatsScreen
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DebugCompletionStatus: React.FC = () => {
    const [completionStatus, setCompletionStatus] = useState<{
        isComplete: boolean;
        requiredRoutines: string[];
        completedRoutines: string[];
        lastChecked: string;
    } | null>(null);

    const { colors } = useTheme();

    const checkCompletionStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date();
            const todayStr = getLocalDateString(today);
            const dayOfWeek = today.getDay();

            const [completionsResult, userRoutinesResult, dayRoutinesResult] = await Promise.all([
                supabase
                    .from("routine_completions")
                    .select("completion_date, routine_id")
                    .eq("user_id", user.id)
                    .eq("completion_date", todayStr),
                supabase
                    .from("user_routines")
                    .select("id, name, is_weekly")
                    .eq("user_id", user.id),
                supabase
                    .from("user_day_routines")
                    .select("routine_id, day_of_week")
                    .eq("user_id", user.id)
                    .eq("day_of_week", dayOfWeek),
            ]);

            const todayCompletions = completionsResult.data || [];
            const userRoutines = userRoutinesResult.data || [];
            const todayRoutineAssignments = dayRoutinesResult.data || [];

            const todayDailyRoutineIds = todayRoutineAssignments.map((a) => a.routine_id);
            const todayDailyRoutines = userRoutines.filter(
                (routine) => !routine.is_weekly && todayDailyRoutineIds.includes(routine.id)
            );

            const completedRoutineIds = todayCompletions.map((c) => c.routine_id);

            const allCompleted =
                todayDailyRoutines.length > 0 &&
                todayDailyRoutines.every((routine) =>
                    completedRoutineIds.includes(routine.id)
                );

            setCompletionStatus({
                isComplete: allCompleted,
                requiredRoutines: todayDailyRoutines.map(r => r.name),
                completedRoutines: completedRoutineIds,
                lastChecked: new Date().toLocaleTimeString()
            });

        } catch (error) {
            console.error("Debug: Error checking completion status:", error);
        }
    };

    useEffect(() => {
        checkCompletionStatus();
    }, []);

    if (!completionStatus) return null;

    return (
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Debug: Today's Completion Status</Text>

            <View style={styles.statusRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Status:</Text>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: completionStatus.isComplete ? '#4CAF50' : '#ff9800' }
                ]}>
                    <Text style={styles.statusText}>
                        {completionStatus.isComplete ? 'COMPLETE ✅' : 'INCOMPLETE ⏳'}
                    </Text>
                </View>
            </View>

            <View style={styles.statusRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Required:</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                    {completionStatus.requiredRoutines.length} routines
                </Text>
            </View>

            <View style={styles.statusRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Completed:</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                    {completionStatus.completedRoutines.length} routines
                </Text>
            </View>

            <View style={styles.statusRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Last checked:</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                    {completionStatus.lastChecked}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: '#007AFF' }]}
                onPress={checkCompletionStatus}
            >
                <Text style={styles.refreshButtonText}>Refresh Status</Text>
            </TouchableOpacity>

            <Text style={[styles.note, { color: colors.textTertiary }]}>
                This should match the Stats calendar color
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 16,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
    },
    value: {
        fontSize: 14,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    refreshButton: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
    },
    refreshButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    note: {
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default DebugCompletionStatus;