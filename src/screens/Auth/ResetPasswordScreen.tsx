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
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendResetEmail = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            // Use Supabase's built-in password reset with redirect
            const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                    redirectTo: 'routine://reset-password-confirm'
                }
            );

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            Alert.alert(
                'Reset Email Sent! 📧',
                'Check your email for the reset link. Click it to reset your password.',
                [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
            );

        } catch (error: any) {
            console.error('Reset password error:', error);
            Alert.alert('Error', 'Failed to send reset email. Please try again.');
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
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-closed" size={80} color="#007AFF" />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        Reset Password
                    </Text>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Enter your email address and we'll send you a link to reset your password
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
                            autoComplete="email"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                        onPress={handleSendResetEmail}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Send Reset Email</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('Login')}
                        style={styles.linkButton}
                    >
                        <Text style={[styles.linkText, { color: '#007AFF' }]}>
                            Back to Login
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
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
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
        marginBottom: 20,
        width: '100%',
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        paddingVertical: 15,
        paddingHorizontal: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        marginTop: 10,
    },
    linkText: {
        fontSize: 16,
    },
});