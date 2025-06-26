import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { Profile, UserSettings } from '../../types/database';

interface ProfileScreenProps {
    navigation: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );

    const loadProfileData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                throw profileError;
            }

            // Load settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                throw settingsError;
            }

            setProfile(profileData);
            setSettings(settingsData);
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.auth.signOut();
                            if (error) throw error;
                        } catch (error) {
                            console.error('Error signing out:', error);
                            Alert.alert('Error', 'Failed to sign out');
                        }
                    },
                },
            ]
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadProfileData();
    };

    const menuItems = [
        {
            title: 'Manage Routines',
            subtitle: 'Add, edit, or remove your daily and weekly routines',
            icon: 'list',
            onPress: () => navigation.navigate('RoutineManager'),
        },
        {
            title: 'Settings',
            subtitle: 'App preferences, notifications, and account settings',
            icon: 'settings',
            onPress: () => navigation.navigate('Settings'),
        },
        {
            title: 'Change Password',
            subtitle: 'Update your account password',
            icon: 'key',
            onPress: () => {
                Alert.alert(
                    'Change Password',
                    'You will receive an email with instructions to reset your password.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Send Email',
                            onPress: async () => {
                                try {
                                    if (!profile?.email) {
                                        Alert.alert('Error', 'No email found');
                                        return;
                                    }

                                    const { error } = await supabase.auth.resetPasswordForEmail(
                                        profile.email,
                                        {
                                            redirectTo: 'your-app://reset-password',
                                        }
                                    );

                                    if (error) throw error;

                                    Alert.alert(
                                        'Email Sent',
                                        'Check your email for password reset instructions.'
                                    );
                                } catch (error) {
                                    console.error('Error sending reset email:', error);
                                    Alert.alert('Error', 'Failed to send reset email');
                                }
                            },
                        },
                    ]
                );
            },
        },
        {
            title: 'Privacy & Security',
            subtitle: 'Manage your data and security preferences',
            icon: 'shield-checkmark',
            onPress: () => {
                Alert.alert(
                    'Privacy & Security',
                    'Your data is encrypted and stored securely. You can delete your account and all associated data at any time.',
                    [{ text: 'OK' }]
                );
            },
        },
        {
            title: 'Help & Support',
            subtitle: 'Get help with using the app',
            icon: 'help-circle',
            onPress: () => {
                Alert.alert(
                    'Help & Support',
                    'For support, please contact us at support@routineapp.com',
                    [{ text: 'OK' }]
                );
            },
        },
        {
            title: 'About',
            subtitle: 'App version and information',
            icon: 'information-circle',
            onPress: () => {
                Alert.alert(
                    'About Routine',
                    'Version 1.0.0\n\nBuild better habits, one day at a time.',
                    [{ text: 'OK' }]
                );
            },
        },
    ];

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
                    <Text style={styles.userName}>
                        {profile?.full_name || 'User'}
                    </Text>
                    <Text style={styles.userEmail}>
                        {profile?.email || 'No email'}
                    </Text>
                    <Text style={styles.joinDate}>
                        Member since {profile?.created_at ?
                            new Date(profile.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric'
                            }) : 'Unknown'
                        }
                    </Text>
                </View>

                {/* Quick Stats */}
                <View style={styles.statsSection}>
                    <Text style={styles.sectionTitle}>Quick Stats</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>0</Text>
                            <Text style={styles.statLabel}>Total Routines</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>0</Text>
                            <Text style={styles.statLabel}>Completed Today</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>0</Text>
                            <Text style={styles.statLabel}>Current Streak</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>0</Text>
                            <Text style={styles.statLabel}>Total Notes</Text>
                        </View>
                    </View>
                </View>

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
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
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
    userSection: {
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingVertical: 30,
        marginTop: 15,
    },
    avatarContainer: {
        marginBottom: 15,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    userEmail: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    joinDate: {
        fontSize: 14,
        color: '#999',
    },
    statsSection: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginTop: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    statItem: {
        width: '50%',
        alignItems: 'center',
        paddingVertical: 15,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    menuSection: {
        backgroundColor: '#fff',
        marginTop: 15,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0f8ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    menuItemSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    signOutSection: {
        paddingHorizontal: 20,
        paddingVertical: 30,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ff6b6b',
    },
    signOutButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff6b6b',
        marginLeft: 8,
    },
});