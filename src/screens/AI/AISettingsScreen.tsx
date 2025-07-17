// ============================================
// AI SETTINGS SCREEN - SAVE AS src/screens/AI/AISettingsScreen.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../ThemeContext';
import { supabase } from '../../services/supabase';
import { chatService } from '../../services/chatService';
import { aiService } from '../../services/aiService';
import { ChatSession } from '../../types/database';

interface AISettingsScreenProps {
    navigation: any;
}

const AISettingsScreen: React.FC<AISettingsScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();

    // State
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    /**
     * Load initial data and settings
     */
    const loadData = async () => {
        try {
            setLoading(true);

            // Load saved API key from environment
            const savedApiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '';
            setApiKey(savedApiKey);

            // Test connection if API key exists
            if (savedApiKey) {
                await checkConnection();
            }

            // Load chat sessions
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const sessions = await chatService.getChatSessions(user.id);
                setChatSessions(sessions);
            }

        } catch (error) {
            console.error('Error loading AI settings:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Check AI connection
     */
    const checkConnection = async () => {
        try {
            const connected = await aiService.testConnection();
            setIsConnected(connected);
        } catch (error) {
            console.error('Connection check failed:', error);
            setIsConnected(false);
        }
    };

    /**
     * Test connection with current API key
     */
    const testConnection = async () => {
        if (!apiKey.trim()) {
            Alert.alert('Error', 'Please enter an API key first.');
            return;
        }

        try {
            setLoading(true);

            // Update service with current API key
            aiService.updateApiKey(apiKey);

            const connected = await aiService.testConnection();

            if (connected) {
                Alert.alert('Success!', 'Connected to DeepSeek API successfully!');
                setIsConnected(true);
            } else {
                Alert.alert('Connection Failed', 'Could not connect to the API. Please check your API key.');
                setIsConnected(false);
            }
        } catch (error) {
            Alert.alert('Error', `Connection test failed: ${error.message}`);
            setIsConnected(false);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Clear all chat history
     */
    const clearAllChats = () => {
        Alert.alert(
            'Clear All Chats',
            'Are you sure you want to delete all chat history? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);

                            for (const session of chatSessions) {
                                await chatService.deleteChatSession(session.id);
                            }

                            setChatSessions([]);
                            Alert.alert('Success', 'All chat history has been cleared.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear chat history.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    /**
     * Delete individual chat session
     */
    const deleteChat = (session: ChatSession) => {
        Alert.alert(
            'Delete Chat',
            `Delete "${session.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await chatService.deleteChatSession(session.id);
                            setChatSessions(prev => prev.filter(s => s.id !== session.id));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete chat.');
                        }
                    },
                },
            ]
        );
    };

    /**
     * Render header
     */
    const renderHeader = () => (
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
                AI Settings
            </Text>
            <View style={styles.headerRight} />
        </View>
    );

    /**
     * Render connection status
     */
    const renderConnectionStatus = () => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <Ionicons name="cloud" size={20} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Connection Status
                </Text>
            </View>

            <View style={[styles.statusCard, {
                backgroundColor: isConnected ? '#00FF7F10' : '#FF000010',
                borderColor: isConnected ? '#00FF7F' : '#FF0000',
            }]}>
                <View style={styles.statusHeader}>
                    <Ionicons
                        name={isConnected ? "checkmark-circle" : "close-circle"}
                        size={24}
                        color={isConnected ? '#00FF7F' : '#FF0000'}
                    />
                    <View style={styles.statusTextContainer}>
                        <Text style={[styles.statusText, { color: colors.text }]}>
                            {isConnected ? 'Connected to DeepSeek' : 'Not Connected'}
                        </Text>
                        <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
                            {isConnected
                                ? 'AI assistant is ready to use'
                                : 'Enter API key to connect'
                            }
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    /**
     * Render API configuration
     */
    const renderConfiguration = () => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <Ionicons name="key" size={20} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    API Configuration
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://platform.deepseek.com/')}>
                    <Text style={[styles.getKeyText, { color: '#007AFF' }]}>
                        Get Key
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.configItem}>
                <Text style={[styles.configLabel, { color: colors.text }]}>
                    DeepSeek API Key
                </Text>
                <TextInput
                    style={[styles.configInput, {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                    }]}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="sk-..."
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={true}
                />
                <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                    Get your API key from platform.deepseek.com
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#007AFF' }]}
                onPress={testConnection}
                disabled={loading || !apiKey.trim()}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <>
                        <Ionicons name="wifi" size={20} color="#FFFFFF" />
                        <Text style={styles.testButtonText}>Test Connection</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    /**
     * Render chat history section
     */
    const renderChatHistory = () => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles" size={20} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Chat History ({chatSessions.length})
                </Text>
                {chatSessions.length > 0 && (
                    <TouchableOpacity onPress={clearAllChats}>
                        <Text style={[styles.clearAllText, { color: '#FF3B30' }]}>
                            Clear All
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {chatSessions.length === 0 ? (
                <View style={styles.emptyChatHistory}>
                    <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No chat history yet
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                        Start a conversation with your AI assistant
                    </Text>
                </View>
            ) : (
                <View style={styles.chatList}>
                    {chatSessions.map((session) => (
                        <View key={session.id} style={[styles.chatItem, { borderBottomColor: colors.border }]}>
                            <View style={styles.chatInfo}>
                                <Text style={[styles.chatTitle, { color: colors.text }]} numberOfLines={1}>
                                    {session.title}
                                </Text>
                                <Text style={[styles.chatDate, { color: colors.textSecondary }]}>
                                    {new Date(session.updated_at).toLocaleDateString()}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => deleteChat(session)}
                                style={styles.deleteButton}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    /**
     * Render setup help
     */
    const renderHelp = () => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <Ionicons name="help-circle" size={20} color="#007AFF" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Setup Guide
                </Text>
            </View>

            <View style={styles.helpContent}>
                <View style={styles.helpStep}>
                    <Text style={[styles.helpStepNumber, { backgroundColor: '#007AFF' }]}>1</Text>
                    <Text style={[styles.helpStepText, { color: colors.text }]}>
                        Visit platform.deepseek.com and create an account
                    </Text>
                </View>

                <View style={styles.helpStep}>
                    <Text style={[styles.helpStepNumber, { backgroundColor: '#007AFF' }]}>2</Text>
                    <Text style={[styles.helpStepText, { color: colors.text }]}>
                        Generate an API key from your dashboard
                    </Text>
                </View>

                <View style={styles.helpStep}>
                    <Text style={[styles.helpStepNumber, { backgroundColor: '#007AFF' }]}>3</Text>
                    <Text style={[styles.helpStepText, { color: colors.text }]}>
                        Paste the API key above and test the connection
                    </Text>
                </View>

                <Text style={[styles.helpNote, { color: colors.textSecondary }]}>
                    💰 DeepSeek is very affordable at only $0.14 per 1M tokens. Perfect for daily routine advice!
                </Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading settings...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {renderHeader()}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderConnectionStatus()}
                {renderConfiguration()}
                {renderChatHistory()}
                {renderHelp()}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    headerRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    getKeyText: {
        fontSize: 14,
        fontWeight: '500',
    },
    clearAllText: {
        fontSize: 14,
        fontWeight: '500',
    },
    statusCard: {
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusTextContainer: {
        marginLeft: 12,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '500',
    },
    statusSubtext: {
        fontSize: 14,
        marginTop: 2,
    },
    configItem: {
        marginBottom: 16,
    },
    configLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    configInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
    },
    helpText: {
        fontSize: 12,
        marginTop: 4,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    testButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
    emptyChatHistory: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 4,
    },
    chatList: {
        marginTop: 8,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    chatInfo: {
        flex: 1,
    },
    chatTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    chatDate: {
        fontSize: 14,
    },
    deleteButton: {
        padding: 8,
    },
    helpContent: {
        marginTop: 8,
    },
    helpStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    helpStepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 24,
    },
    helpStepText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    helpNote: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 16,
        fontStyle: 'italic',
    },
});

export default AISettingsScreen;