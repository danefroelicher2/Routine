// Updated SignupScreen.tsx - REPLACE YOUR EXISTING SignupScreen.tsx WITH THIS
// src/screens/Auth/SignupScreen.tsx

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

interface SignupScreenProps {
    navigation: any;
}

export default function SignupScreen({ navigation }: SignupScreenProps) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // NEW: Terms acceptance state
    const [termsAccepted, setTermsAccepted] = useState(false);

    const validateForm = () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Please enter your full name');
            return false;
        }
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email');
            return false;
        }
        if (!password) {
            Alert.alert('Error', 'Please enter a password');
            return false;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return false;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return false;
        }
        // NEW: Check terms acceptance
        if (!termsAccepted) {
            Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue');
            return false;
        }
        return true;
    };

    const handleSignup = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        terms_accepted: true, // Record that user accepted terms
                        terms_accepted_at: new Date().toISOString(),
                    },
                },
            });

            if (error) {
                Alert.alert('Signup Failed', error.message);
            } else {
                Alert.alert(
                    'Success!',
                    'Account created successfully! Please check your email to verify your account.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('Login'),
                        },
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    // NEW: Handle opening legal documents
    const openPrivacyPolicy = () => {
        // Option 1: Open within app (recommended)
        navigation.navigate('Privacy');

        // Option 2: Open in browser (alternative)
        // Linking.openURL('https://danefroelicher2.github.io/routine-app-legal/privacy-policy.html');
    };

    const openTermsOfService = () => {
        // Option 1: Open within app (recommended)
        navigation.navigate('Terms');

        // Option 2: Open in browser (alternative)
        // Linking.openURL('https://danefroelicher2.github.io/routine-app-legal/terms-of-service.html');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Ionicons name="checkmark-circle" size={80} color="#007AFF" />
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Start building better habits today</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor="#999"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Confirm Password"
                            placeholderTextColor="#999"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            style={styles.eyeIcon}
                        >
                            <Ionicons
                                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* NEW: Terms and Privacy Agreement Section */}
                    <View style={styles.termsContainer}>
                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setTermsAccepted(!termsAccepted)}
                        >
                            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                                {termsAccepted && (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                )}
                            </View>
                            <View style={styles.termsTextContainer}>
                                <Text style={styles.termsText}>
                                    I agree to the{' '}
                                    <Text style={styles.termsLink} onPress={openTermsOfService}>
                                        Terms of Service
                                    </Text>
                                    {' '}and{' '}
                                    <Text style={styles.termsLink} onPress={openPrivacyPolicy}>
                                        Privacy Policy
                                    </Text>
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.signupButton,
                            (loading || !termsAccepted) && styles.disabledButton
                        ]}
                        onPress={handleSignup}
                        disabled={loading || !termsAccepted}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.signupButtonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginLink}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: '#333',
    },
    eyeIcon: {
        padding: 5,
    },
    // NEW: Terms acceptance styles
    termsContainer: {
        marginBottom: 20,
        marginTop: 10,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#ddd',
        marginRight: 12,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    termsTextContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    termsLink: {
        color: '#007AFF',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    signupButton: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.6,
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    loginText: {
        fontSize: 16,
        color: '#666',
    },
    loginLink: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
});