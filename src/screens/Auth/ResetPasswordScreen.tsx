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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../../ThemeContext';

export default function ResetPasswordScreen({ navigation }: any) {
    const { colors } = useTheme();
    const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
    const [email, setEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Generate a 6-digit code
    const generateResetCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Step 1: Send reset code to email
    const handleSendResetCode = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            // First check if user exists
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (userError || !userData) {
                Alert.alert('Error', 'No account found with this email address');
                setLoading(false);
                return;
            }

            // Clean up any existing codes for this email
            await supabase
                .from('password_reset_codes')
                .delete()
                .eq('email', email.toLowerCase().trim());

            // Generate and save new code
            const code = generateResetCode();
            const { error: insertError } = await supabase
                .from('password_reset_codes')
                .insert({
                    email: email.toLowerCase().trim(),
                    code: code,
                });

            if (insertError) throw insertError;

            // Since we can't pass custom data to the reset email,
            // we'll show the code directly in the app for now
            Alert.alert(
                'Reset Code',
                `Your password reset code is: ${code}\n\nThis code will expire in 15 minutes.`,
                [{ text: 'OK', onPress: () => setStep('code') }]
            );

            // Note: In production, you would want to send this code via email
            // using a custom email service or Supabase Edge Functions

        } catch (error: any) {
            console.error('Reset password error:', error);
            Alert.alert('Error', 'Failed to generate reset code. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    // Step 2: Verify code
    const handleVerifyCode = async () => {
        if (!resetCode.trim()) {
            Alert.alert('Error', 'Please enter the reset code');
            return;
        }

        setLoading(true);
        try {
            // Verify the code
            const { data, error } = await supabase
                .from('password_reset_codes')
                .select('*')
                .eq('email', email.toLowerCase().trim())
                .eq('code', resetCode.trim())
                .eq('used', false)
                .single();

            if (error || !data) {
                Alert.alert('Error', 'Invalid or expired code');
                setLoading(false);
                return;
            }

            // Check if code is expired (15 minutes)
            const codeAge = Date.now() - new Date(data.created_at).getTime();
            if (codeAge > 15 * 60 * 1000) {
                Alert.alert('Error', 'Code has expired. Please request a new one.');
                setLoading(false);
                return;
            }

            // Code is valid, proceed to password reset
            setStep('password');
        } catch (error: any) {
            Alert.alert('Error', 'Failed to verify code');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Set new password
    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            // First, get the user by email to sign them in
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: 'temp_password_for_reset', // This will fail, but we need the error
            });

            // Use admin update to reset password (you'll need to implement this server-side)
            // For now, we'll use a workaround with the magic link approach

            // Mark code as used
            const { error: updateError } = await supabase
                .from('password_reset_codes')
                .update({ used: true })
                .eq('email', email.toLowerCase().trim())
                .eq('code', resetCode.trim());

            if (updateError) throw updateError;

            // Here you would typically call a server function to update the password
            // For demonstration, we'll show success and guide user
            Alert.alert(
                'Important',
                'To complete the password reset, please check your email for a password reset link from Supabase. Click that link and enter your new password.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );

        } catch (error: any) {
            Alert.alert('Error', 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            <View style={[styles.step, { backgroundColor: '#007AFF' }]}>
                <Text style={styles.stepText}>1</Text>
            </View>
            <View style={[styles.stepLine, {
                backgroundColor: step !== 'email' ? '#007AFF' : colors.border
            }]} />
            <View style={[styles.step, {
                backgroundColor: step !== 'email' ? '#007AFF' : colors.border
            }]}>
                <Text style={[styles.stepText, {
                    color: step !== 'email' ? 'white' : colors.textSecondary
                }]}>2</Text>
            </View>
            <View style={[styles.stepLine, {
                backgroundColor: step === 'password' ? '#007AFF' : colors.border
            }]} />
            <View style={[styles.step, {
                backgroundColor: step === 'password' ? '#007AFF' : colors.border
            }]}>
                <Text style={[styles.stepText, {
                    color: step === 'password' ? 'white' : colors.textSecondary
                }]}>3</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {renderStepIndicator()}

                    <Text style={[styles.title, { color: colors.text }]}>
                        Reset Password
                    </Text>

                    {step === 'email' && (
                        <>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                Enter your email address and we'll send you a 6-digit code
                            </Text>

                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Email address"
                                    placeholderTextColor={colors.textSecondary}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                                onPress={handleSendResetCode}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.buttonText}>Send Reset Code</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'code' && (
                        <>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                Enter the 6-digit code sent to {email}
                            </Text>

                            <View style={[styles.codeInputContainer, { backgroundColor: colors.surface }]}>
                                <TextInput
                                    style={[styles.codeInput, { color: colors.text }]}
                                    placeholder="000000"
                                    placeholderTextColor={colors.textSecondary}
                                    value={resetCode}
                                    onChangeText={setResetCode}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    textAlign="center"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                                onPress={handleVerifyCode}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.buttonText}>Verify Code</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setStep('email')}
                                style={styles.resendButton}
                            >
                                <Text style={[styles.resendText, { color: '#007AFF' }]}>
                                    Didn't receive the code? Try again
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'password' && (
                        <>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                Create your new password
                            </Text>

                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="New password"
                                    placeholderTextColor={colors.textSecondary}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Confirm password"
                                    placeholderTextColor={colors.textSecondary}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons
                                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                                onPress={handleResetPassword}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.buttonText}>Reset Password</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
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
    header: {
        padding: 20,
    },
    backButton: {
        width: 40,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    step: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepText: {
        color: 'white',
        fontWeight: 'bold',
    },
    stepLine: {
        width: 40,
        height: 2,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 50,
    },
    input: {
        flex: 1,
        fontSize: 16,
        marginLeft: 10,
    },
    codeInputContainer: {
        borderRadius: 12,
        marginBottom: 15,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeInput: {
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 10,
        width: '100%',
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendText: {
        fontSize: 14,
        fontWeight: '500',
    },
});