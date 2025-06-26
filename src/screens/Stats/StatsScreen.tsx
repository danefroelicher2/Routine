import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { RoutineCompletion } from '../../types/database';

const { width } = Dimensions.get('window');

interface CompletionData {
    date: string;
    completionCount: number;
}

export default function StatsScreen() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [completionData, setCompletionData] = useState<CompletionData[]>([]);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadStatsData();
        }, [currentDate])
    );

    const loadStatsData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get first and last day of current month
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            // Fetch completions for the current month
            const { data: completions, error } = await supabase
                .from('routine_completions')
                .select('completion_date')
                .eq('user_id', user.id)
                .gte('completion_date', firstDay.toISOString().split('T')[0])
                .lte('completion_date', lastDay.toISOString().split('T')[0])
                .order('completion_date');

            if (error) throw error;

            // Process completion data for heatmap
            const completionMap = new Map<string, number>();
            completions?.forEach(completion => {
                const date = completion.completion_date;
                completionMap.set(date, (completionMap.get(date) || 0) + 1);
            });

            const data: CompletionData[] = [];
            for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                data.push({
                    date: dateStr,
                    completionCount: completionMap.get(dateStr) || 0,
                });
            }

            setCompletionData(data);

            // Calculate current streak
            await calculateCurrentStreak(user.id);
        } catch (error) {
            console.error('Error loading stats:', error);
            Alert.alert('Error', 'Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    const calculateCurrentStreak = async (userId: string) => {
        try {
            // Get all completion dates for the user, ordered by date descending
            const { data: completions, error } = await supabase
                .from('routine_completions')
                .select('completion_date')
                .eq('user_id', userId)
                .order('completion_date', { ascending: false });

            if (error) throw error;

            if (!completions || completions.length === 0) {
                setCurrentStreak(0);
                return;
            }

            // Get unique completion dates
            const uniqueDates = [...new Set(completions.map(c => c.completion_date))].sort().reverse();

            let streak = 0;
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Check if there's activity today or yesterday to start counting
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                let currentDate = uniqueDates[0] === today ? today : yesterday;
                let dateIndex = uniqueDates[0] === today ? 0 : (uniqueDates[0] === yesterday ? 0 : -1);

                if (dateIndex >= 0) {
                    // Count consecutive days
                    while (dateIndex < uniqueDates.length) {
                        if (uniqueDates[dateIndex] === currentDate) {
                            streak++;
                            dateIndex++;
                            // Move to previous day
                            const prevDate = new Date(currentDate);
                            prevDate.setDate(prevDate.getDate() - 1);
                            currentDate = prevDate.toISOString().split('T')[0];
                        } else {
                            break;
                        }
                    }
                }
            }

            setCurrentStreak(streak);
        } catch (error) {
            console.error('Error calculating streak:', error);
        }
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (direction === 'prev') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentDate(newDate);
    };

    const getIntensityColor = (count: number) => {
        if (count === 0) return '#ebedf0';
        if (count === 1) return '#c6e48b';
        if (count === 2) return '#7bc96f';
        if (count === 3) return '#239a3b';
        return '#196127';
    };

    const renderHeatmapCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Get first day of week (Sunday = 0)
        const startingDayOfWeek = firstDay.getDay();

        // Calculate total cells needed
        const daysInMonth = lastDay.getDate();
        const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;

        const cells = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            cells.push(
                <View key={`empty-${i}`} style={styles.heatmapCell} />
            );
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const dayData = completionData.find(d => d.date === dateStr);
            const count = dayData?.completionCount || 0;

            cells.push(
                <TouchableOpacity
                    key={day}
                    style={[
                        styles.heatmapCell,
                        styles.heatmapDay,
                        { backgroundColor: getIntensityColor(count) }
                    ]}
                >
                    <Text style={[
                        styles.heatmapDayText,
                        count > 0 && styles.heatmapDayTextActive
                    ]}>
                        {day}
                    </Text>
                </TouchableOpacity>
            );
        }

        // Add empty cells to complete the grid
        const remaining = totalCells - cells.length;
        for (let i = 0; i < remaining; i++) {
            cells.push(
                <View key={`empty-end-${i}`} style={styles.heatmapCell} />
            );
        }

        return (
            <View style={styles.heatmapGrid}>
                {/* Day labels */}
                <View style={styles.dayLabels}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <Text key={index} style={styles.dayLabel}>{day}</Text>
                    ))}
                </View>

                {/* Calendar grid */}
                <View style={styles.calendarGrid}>
                    {cells}
                </View>
            </View>
        );
    };

    const getMonthName = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    };

    const getStreakMessage = () => {
        if (currentStreak === 0) {
            return "C'mon, start today!";
        } else if (currentStreak === 1) {
            return "Great start! Keep going!";
        } else if (currentStreak < 7) {
            return "Building momentum!";
        } else if (currentStreak < 30) {
            return "You're on fire! 🔥";
        } else {
            return "Incredible dedication! 🌟";
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Statistics</Text>
            </View>

            <ScrollView style={styles.scrollView}>
                {/* Streak Widget */}
                <View style={styles.streakWidget}>
                    <View style={styles.streakContent}>
                        <Text style={styles.streakTitle}>Current Streak</Text>
                        <Text style={styles.streakNumber}>{currentStreak}</Text>
                        <Text style={styles.streakUnit}>day{currentStreak !== 1 ? 's' : ''} in a row</Text>
                        <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
                    </View>
                    <View style={styles.streakIcon}>
                        <Ionicons
                            name={currentStreak > 0 ? "flame" : "flame-outline"}
                            size={40}
                            color={currentStreak > 0 ? "#ff6b35" : "#ccc"}
                        />
                    </View>
                </View>

                {/* Monthly Heatmap */}
                <View style={styles.heatmapSection}>
                    <View style={styles.heatmapHeader}>
                        <TouchableOpacity
                            style={styles.navButton}
                            onPress={() => navigateMonth('prev')}
                        >
                            <Ionicons name="chevron-back" size={24} color="#007AFF" />
                        </TouchableOpacity>

                        <Text style={styles.monthTitle}>{getMonthName(currentDate)}</Text>

                        <TouchableOpacity
                            style={styles.navButton}
                            onPress={() => navigateMonth('next')}
                        >
                            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
                        </TouchableOpacity>
                    </View>

                    {renderHeatmapCalendar()}

                    {/* Legend */}
                    <View style={styles.legend}>
                        <Text style={styles.legendLabel}>Less</Text>
                        <View style={styles.legendColors}>
                            {[0, 1, 2, 3, 4].map(level => (
                                <View
                                    key={level}
                                    style={[
                                        styles.legendColor,
                                        { backgroundColor: getIntensityColor(level) }
                                    ]}
                                />
                            ))}
                        </View>
                        <Text style={styles.legendLabel}>More</Text>
                    </View>
                </View>

                {/* Achievements Section */}
                <View style={styles.achievementsSection}>
                    <Text style={styles.sectionTitle}>Achievements</Text>

                    <View style={styles.achievementsList}>
                        <View style={[
                            styles.achievement,
                            currentStreak >= 3 && styles.achievementUnlocked
                        ]}>
                            <Ionicons
                                name="medal"
                                size={24}
                                color={currentStreak >= 3 ? "#ffb347" : "#ccc"}
                            />
                            <View style={styles.achievementInfo}>
                                <Text style={[
                                    styles.achievementTitle,
                                    currentStreak >= 3 && styles.achievementTitleUnlocked
                                ]}>
                                    Getting Started
                                </Text>
                                <Text style={styles.achievementDescription}>
                                    Complete routines for 3 days in a row
                                </Text>
                            </View>
                            {currentStreak >= 3 && (
                                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                            )}
                        </View>

                        <View style={[
                            styles.achievement,
                            currentStreak >= 7 && styles.achievementUnlocked
                        ]}>
                            <Ionicons
                                name="trophy"
                                size={24}
                                color={currentStreak >= 7 ? "#ffb347" : "#ccc"}
                            />
                            <View style={styles.achievementInfo}>
                                <Text style={[
                                    styles.achievementTitle,
                                    currentStreak >= 7 && styles.achievementTitleUnlocked
                                ]}>
                                    Week Warrior
                                </Text>
                                <Text style={styles.achievementDescription}>
                                    Complete routines for 7 days in a row
                                </Text>
                            </View>
                            {currentStreak >= 7 && (
                                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                            )}
                        </View>

                        <View style={[
                            styles.achievement,
                            currentStreak >= 30 && styles.achievementUnlocked
                        ]}>
                            <Ionicons
                                name="star"
                                size={24}
                                color={currentStreak >= 30 ? "#ffb347" : "#ccc"}
                            />
                            <View style={styles.achievementInfo}>
                                <Text style={[
                                    styles.achievementTitle,
                                    currentStreak >= 30 && styles.achievementTitleUnlocked
                                ]}>
                                    Habit Master
                                </Text>
                                <Text style={styles.achievementDescription}>
                                    Complete routines for 30 days in a row
                                </Text>
                            </View>
                            {currentStreak >= 30 && (
                                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    scrollView: {
        flex: 1,
    },
    streakWidget: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 20,
        alignItems: 'center',
    },
    streakContent: {
        flex: 1,
    },
    streakTitle: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    streakNumber: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#007AFF',
        marginVertical: 5,
    },
    streakUnit: {
        fontSize: 16,
        color: '#666',
    },
    streakMessage: {
        fontSize: 14,
        color: '#ff6b35',
        marginTop: 5,
        fontWeight: '500',
    },
    streakIcon: {
        marginLeft: 20,
    },
    heatmapSection: {
        backgroundColor: '#fff',
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    heatmapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    navButton: {
        padding: 8,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    heatmapGrid: {
        alignItems: 'center',
    },
    dayLabels: {
        flexDirection: 'row',
        marginBottom: 10,
        width: width - 40,
    },
    dayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: width - 40,
    },
    heatmapCell: {
        width: (width - 40) / 7,
        height: (width - 40) / 7,
        margin: 1,
    },
    heatmapDay: {
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heatmapDayText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    heatmapDayTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
    },
    legendLabel: {
        fontSize: 12,
        color: '#666',
        marginHorizontal: 8,
    },
    legendColors: {
        flexDirection: 'row',
    },
    legendColor: {
        width: 12,
        height: 12,
        marginHorizontal: 1,
        borderRadius: 2,
    },
    achievementsSection: {
        backgroundColor: '#fff',
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    achievementsList: {
        gap: 15,
    },
    achievement: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        opacity: 0.6,
    },
    achievementUnlocked: {
        opacity: 1,
        backgroundColor: '#e3f2fd',
    },
    achievementInfo: {
        flex: 1,
        marginLeft: 12,
    },
    achievementTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#666',
    },
    achievementTitleUnlocked: {
        color: '#333',
    },
    achievementDescription: {
        fontSize: 14,
        color: '#999',
        marginTop: 2,
    },
});