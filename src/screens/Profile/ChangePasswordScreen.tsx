import React, { useState } from 'react';
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
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../../ThemeContext';

export default function ChangePasswordScreen({ navigation }: any) {
    const { colors } = useTheme();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChangePassword = async () => {
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'New password must be at least 6 characters');
            return;
        }

        if (currentPassword === newPassword) {
            Alert.alert('Error', 'New password must be different from current password');
            return;
        }

        setLoading(true);
        try {
            // First, verify the current password by attempting to sign in
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('User not found');

            // Verify current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                Alert.alert('Error', 'Current password is incorrect');
                setLoading(false);
                return;
            }

            // Update to new password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            Alert.alert(
                'Success',
                'Your password has been changed successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack()
                    }
                ]
            );

            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (error: any) {
            console.error('Change password error:', error);
            Alert.alert('Error', error.message || 'Failed to change password');
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
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            Change Password
                        </Text>
                        <View style={styles.placeholder} />
                    </View>

                    <View style={styles.content}>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            Enter your current password and choose a new password for your account
                        </Text>

                        {/* Current Password */}
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                Current Password
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Enter current password"
                                    placeholderTextColor={colors.textSecondary}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    secureTextEntry={!showCurrentPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                                    <Ionicons
                                        name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* New Password */}
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                New Password
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Enter new password"
                                    placeholderTextColor={colors.textSecondary}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showNewPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                    <Ionicons
                                        name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Confirm New Password */}
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                Confirm New Password
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Confirm new password"
                                    placeholderTextColor={colors.textSecondary}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons
                                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Password Requirements */}
                        <View style={[styles.requirementsBox, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.requirementsTitle, { color: colors.text }]}>
                                Password Requirements:
                            </Text>
                            <View style={styles.requirement}>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={newPassword.length >= 6 ? '#4CAF50' : colors.textTertiary}
                                />
                                <Text style={[styles.requirementText, {
                                    color: newPassword.length >= 6 ? '#4CAF50' : colors.textSecondary
                                }]}>
                                    At least 6 characters
                                </Text>
                            </View>
                            <View style={styles.requirement}>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={newPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textTertiary}
                                />
                                <Text style={[styles.requirementText, {
                                    color: newPassword && newPassword === confirmPassword ? '#4CAF50' : colors.textSecondary
                                }]}>
                                    Passwords match
                                </Text>
                            </View>
                            <View style={styles.requirement}>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={newPassword && currentPassword && newPassword !== currentPassword ? '#4CAF50' : colors.textTertiary}
                                />
                                <Text style={[styles.requirementText, {
                                    color: newPassword && currentPassword && newPassword !== currentPassword ? '#4CAF50' : colors.textSecondary
                                }]}>
                                    Different from current password
                                </Text>
                            </View>
                        </View>

                        {/* Change Password Button */}
                        <TouchableOpacity
                            style={[styles.button, {
                                backgroundColor: '#007AFF',
                                opacity: loading ? 0.7 : 1
                            }]}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>Change Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    placeholder: {
        width: 34,
    },
    content: {
        padding: 20,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 30,
    },
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
    },
    input: {
        flex: 1,
        fontSize: 16,
        marginLeft: 10,
    },
    requirementsBox: {
        padding: 16,
        borderRadius: 12,
        marginTop: 10,
        marginBottom: 30,
    },
    requirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    requirement: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    requirementText: {
        fontSize: 13,
        marginLeft: 8,
    },
    button: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});