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

    // Step 1: Send reset code to email
    const handleSendResetCode = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

            if (error) throw error;

            Alert.alert(
                'Code Sent',
                'We\'ve sent a 6-digit code to your email. Please check your inbox.',
                [{ text: 'OK', onPress: () => setStep('code') }]
            );
        } catch (error: any) {
            console.error('Reset password error:', error);
            Alert.alert('Error', error.message || 'Failed to send reset code');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify code (Note: Supabase doesn't have built-in OTP for password reset,
    // so we'll use the magic link approach but guide users through it)
    const handleVerifyCode = () => {
        Alert.alert(
            'Check Your Email',
            'Please click the reset link in your email. Once you\'ve clicked it, press Continue.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => setStep('password') }
            ]
        );
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
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Alert.alert(
                'Success',
                'Your password has been reset successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );
        } catch (error: any) {
            Alert.alert(
                'Error',
                'Failed to reset password. Please make sure you clicked the link in your email first.'
            );
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
                                Enter your email address and we'll send you a reset code
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
                                Check your email for the reset link
                            </Text>

                            <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
                                <Ionicons name="mail" size={40} color="#007AFF" />
                                <Text style={[styles.infoText, { color: colors.text }]}>
                                    We've sent a password reset link to:
                                </Text>
                                <Text style={[styles.emailText, { color: '#007AFF' }]}>
                                    {email}
                                </Text>
                                <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                                    Click the link in your email, then press Continue below
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleVerifyCode}
                            >
                                <Text style={styles.buttonText}>Continue</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setStep('email')}
                                style={styles.resendButton}
                            >
                                <Text style={[styles.resendText, { color: '#007AFF' }]}>
                                    Didn't receive the email? Try again
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
    infoBox: {
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    infoText: {
        fontSize: 16,
        marginTop: 15,
        marginBottom: 5,
    },
    emailText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
    },
    instructionText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
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