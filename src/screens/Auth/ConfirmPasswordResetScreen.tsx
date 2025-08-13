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

export default function ConfirmPasswordResetScreen({ navigation }: any) {
    const { colors } = useTheme();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [sessionValid, setSessionValid] = useState(false);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSessionValid(true);
            } else {
                Alert.alert(
                    'Session Expired',
                    'Your reset session has expired. Please request a new reset email.',
                    [{ text: 'OK', onPress: () => navigation.navigate('ResetPassword') }]
                );
            }
        } catch (error) {
            console.error('Session check error:', error);
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
                setLoading(false);
                return;
            }

            // Sign out and redirect to login
            await supabase.auth.signOut();

            Alert.alert(
                'Success! 🎉',
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

    if (!sessionValid) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Validating session...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

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
                        Create a strong password that you haven't used before
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
                            placeholder="Confirm password"
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
                    <View style={[styles.requirementsBox, { backgroundColor: colors.surface }]}>
                        <View style={styles.requirement}>
                            <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={newPassword.length >= 6 ? '#4CAF50' : colors.textTertiary}
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
                                color={newPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textTertiary}
                            />
                            <Text style={[
                                styles.requirementText,
                                { color: newPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textSecondary }
                            ]}>
                                Passwords match
                            </Text>
                        </View>
                    </View>

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
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    iconContainer: {
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        width: '100%',
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    requirementsBox: {
        width: '100%',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
    },
    requirement: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    requirementText: {
        marginLeft: 8,
        fontSize: 14,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        paddingVertical: 15,
        paddingHorizontal: 30,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
    },
});