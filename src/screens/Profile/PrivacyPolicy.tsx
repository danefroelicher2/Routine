// PrivacyScreen.tsx - NEW FILE
// Place this in: src/screens/Profile/PrivacyScreen.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../ThemeContext';

export default function PrivacyScreen({ navigation }: any) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const PRIVACY_URL = 'https://danefroelicher2.github.io/routine-app-legal/privacy-policy.html';

    const handleError = () => {
        setError(true);
        setLoading(false);
    };

    const handleLoad = () => {
        setLoading(false);
        setError(false);
    };

    const openInBrowser = () => {
        Linking.openURL(PRIVACY_URL).catch(() => {
            Alert.alert('Error', 'Could not open privacy policy in browser');
        });
    };

    const retry = () => {
        setError(false);
        setLoading(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Privacy Policy
                </Text>
                <TouchableOpacity
                    onPress={openInBrowser}
                    style={styles.browserButton}
                >
                    <Ionicons name="open-outline" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Loading Privacy Policy...
                        </Text>
                    </View>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="warning-outline" size={48} color="#FF3B30" />
                        <Text style={[styles.errorTitle, { color: colors.text }]}>
                            Unable to Load Privacy Policy
                        </Text>
                        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
                            Please check your internet connection and try again.
                        </Text>
                        <View style={styles.errorButtons}>
                            <TouchableOpacity
                                style={[styles.retryButton, { backgroundColor: '#007AFF' }]}
                                onPress={retry}
                            >
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.browserButton2, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.separator
                                }]}
                                onPress={openInBrowser}
                            >
                                <Text style={[styles.browserButtonText, { color: colors.text }]}>
                                    Open in Browser
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!error && (
                    <WebView
                        source={{ uri: PRIVACY_URL }}
                        style={styles.webview}
                        onLoadEnd={handleLoad}
                        onError={handleError}
                        startInLoadingState={true}
                        scalesPageToFit={true}
                        showsVerticalScrollIndicator={false}
                        backgroundColor={colors.background}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
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
    browserButton: {
        padding: 5,
    },
    content: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    errorButtons: {
        width: '100%',
        gap: 12,
    },
    retryButton: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    browserButton2: {
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    browserButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
});