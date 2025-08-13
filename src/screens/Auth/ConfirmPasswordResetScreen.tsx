// src/screens/Auth/ConfirmPasswordResetScreen.tsx
// NEW FILE - Create this new screen

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../../ThemeContext';

export default function ConfirmPasswordResetScreen({ navigation, route }: any) {
    const { colors } = useTheme();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Get the access token from route params (if using deep linking)
    // or check if user is in password recovery session
    const accessToken = route?.params?.access_token;

    useEffect(() => {
        // Check if user has a valid session for password reset
        checkResetSession();
    }, []);

    const checkResetSession = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert(
                    'Invalid Reset Link',
                    'This password reset link is invalid or has expired. Please request a new one.',
                    [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
                );
            }
        } catch (error) {
            console.error('Error checking reset session:', error);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return;
        }

        setLoading(true);
        try {
            // Update the user's password
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            // Success! Sign out the user so they can log in with new password
            await supabase.auth.signOut();

            Alert.alert(
                'Password Updated Successfully!',
                'Your password has been updated. Please log in with your new password.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );

        } catch (error: any) {
            console.error('Password update error:', error);
            Alert.alert('Error', 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-closed" size={80} color="#007AFF" />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        Set New Password
                    </Text>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Enter your new password below. Make sure it's secure and at least 6 characters long.
                    </Text>

                    {/* New Password Input */}
                    <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="New password"
                            placeholderTextColor={colors.textSecondary}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showPassword}
                            autoComplete="new-password"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Confirm Password Input */}
                    <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="Confirm new password"
                            placeholderTextColor={colors.textSecondary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoComplete="new-password"
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                            <Ionicons
                                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Password Requirements */}
                    <View style={[styles.requirementsContainer, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.requirementsTitle, { color: colors.text }]}>
                            Password Requirements:
                        </Text>
                        <View style={styles.requirement}>
                            <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={newPassword.length >= 6 ? '#4CAF50' : colors.textSecondary}
                            />
                            <Text style={[
                                styles.requirementText,
                                { color: newPassword.length >= 6 ? '#4CAF50' : colors.textSecondary }
                            ]}>
                                At least 6 characters
                            </Text>
                        </View>
                        <View style={styles.requirement}>
                            <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={newPassword && confirmPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textSecondary}
                            />
                            <Text style={[
                                styles.requirementText,
                                { color: newPassword && confirmPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textSecondary }
                            ]}>
                                Passwords match
                            </Text>
                        </View>
                    </View>

                    {/* Update Password Button */}
                    <TouchableOpacity
                        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                        onPress={handlePasswordUpdate}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Update Password</Text>
                        )}
                    </TouchableOpacity>

                    {/* Cancel Button */}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Login')}
                        style={styles.cancelButton}
                    >
                        <Text style={[styles.cancelText, { color: '#007AFF' }]}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 15,
        marginBottom: 15,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
    },
    requirementsContainer: {
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
    },
    requirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    requirement: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
        gap: 8,
    },
    requirementText: {
        fontSize: 14,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 15,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
});