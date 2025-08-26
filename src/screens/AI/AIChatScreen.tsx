// ============================================
// AI CHAT SCREEN WITH CLAUDE-LIKE UI + PREMIUM CHECK
// Replace your entire src/screens/AI/AIChatScreen.tsx with this
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    SafeAreaView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../../ThemeContext';
import { chatService } from '../../services/chatService';
import { aiService } from '../../services/aiService';
import { ChatSession, ChatMessage, ScheduleContext } from '../../types/database';
import { usePremium } from '../../contexts/PremiumContext';

const { width } = Dimensions.get('window');

interface AIChatScreenProps {
    navigation: any;
}

interface ChatMessageWithLoading extends ChatMessage {
    isLoading?: boolean;
}

const AIChatScreen: React.FC<AIChatScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();
    const { isPremium, checkPremiumFeature } = usePremium();

    // State management
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessageWithLoading[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [scheduleContext, setScheduleContext] = useState<ScheduleContext | null>(null);
    const [showQuickActions, setShowQuickActions] = useState(true);

    // Refs
    const flatListRef = useRef<FlatList>(null);

    // 🔒 AI ACCESS CHECK - Redirect users without AI access
    useEffect(() => {
        const hasAIAccess = checkPremiumFeature("ai_assistant");
        if (!hasAIAccess) {
            console.log('🚫 User without AI access - redirecting to paywall');
            navigation.navigate('Premium', { source: 'ai_tab' });
            return;
        }
    }, [isPremium, navigation]);

    // Load data when screen focuses
    useFocusEffect(
        useCallback(() => {
            if (isPremium) { // Only initialize if premium
                initializeChat();
                checkAIConnection();
            }
        }, [isPremium])
    );

    /**
     * Initialize chat session and load user context
     */
    const initializeChat = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please log in to use the AI assistant');
                return;
            }

            // Load user schedule context
            const context = await chatService.getUserScheduleContext(user.id);
            setScheduleContext(context);

            // Get or create current chat session
            const sessions = await chatService.getChatSessions(user.id);

            if (sessions.length > 0) {
                // Use most recent session
                const latestSession = sessions[0];
                setCurrentSession(latestSession);

                // Load messages for this session
                const sessionMessages = await chatService.getChatMessages(latestSession.id);
                setMessages(sessionMessages);
            } else {
                // Create new session
                const newSession = await chatService.createChatSession(user.id, 'AI Assistant');
                setCurrentSession(newSession);
                setMessages([]);

                // Add welcome message
                const welcomeMessage = await chatService.addMessage(
                    newSession.id,
                    user.id,
                    'assistant',
                    `Hello ${context.user_profile.display_name}! 🤖 I'm your AI routine assistant. I can help you optimize your schedule, analyze your routines, and provide personalized productivity advice.\n\nWhat would you like to work on today?`
                );
                setMessages([welcomeMessage]);
            }

        } catch (error) {
            console.error('Error initializing chat:', error);
            Alert.alert('Error', 'Failed to initialize chat. Please try again.');
        }
    };

    /**
     * Check AI connection status
     */
    const checkAIConnection = async () => {
        try {
            const connected = await aiService.testConnection();
            setIsConnected(connected);
        } catch (error) {
            console.error('Error checking AI connection:', error);
            setIsConnected(false);
        }
    };

    /**
     * Send message to AI
     */
    const sendMessage = async (messageText?: string) => {
        const textToSend = messageText || inputText.trim();
        if (!textToSend || !currentSession) return;

        if (!isConnected) {
            Alert.alert('AI Not Connected', 'Please check your API key in settings.');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setIsLoading(true);
            setInputText('');
            setShowQuickActions(false);

            // Add user message to UI immediately
            const userMessage = await chatService.addMessage(
                currentSession.id,
                user.id,
                'user',
                textToSend
            );

            setMessages(prev => [...prev, userMessage]);

            // Add loading indicator for AI response
            const loadingMessage: ChatMessageWithLoading = {
                id: 'loading',
                session_id: currentSession.id,
                user_id: user.id,
                role: 'assistant',
                content: '',
                metadata: {},
                created_at: new Date().toISOString(),
                isLoading: true,
            };

            setMessages(prev => [...prev, loadingMessage]);

            // Get AI response
            const conversationHistory = messages
                .filter(m => !m.isLoading)
                .map(m => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content,
                }));

            conversationHistory.push({ role: 'user', content: textToSend });

            const aiResponse = await aiService.sendMessage(
                conversationHistory,
                scheduleContext || undefined
            );

            // Remove loading message and add real AI response
            setMessages(prev => prev.filter(m => m.id !== 'loading'));

            const assistantMessage = await chatService.addMessage(
                currentSession.id,
                user.id,
                'assistant',
                aiResponse
            );

            setMessages(prev => [...prev, assistantMessage]);

            // Update session title if this is the first user message
            if (messages.filter(m => m.role === 'user').length === 0) {
                const title = chatService.generateChatTitle(textToSend);
                await chatService.updateChatSessionTitle(currentSession.id, title);
                setCurrentSession(prev => prev ? { ...prev, title } : null);
            }

        } catch (error) {
            console.error('Error sending message:', error);

            // Remove loading message
            setMessages(prev => prev.filter(m => m.id !== 'loading'));

            Alert.alert(
                'Error',
                'Failed to get response from AI. Please check your connection and try again.'
            );
        } finally {
            setIsLoading(false);

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    };

    /**
     * Quick action buttons
     */
    const quickActions = [
        {
            title: 'Optimize Today',
            subtitle: 'Improve today\'s schedule',
            icon: 'today',
            onPress: () => sendMessage(`Based on my ${getDayName(new Date().getDay())} schedule, how can I improve my routine for maximum productivity?`),
        },
        {
            title: 'Analyze Routines',
            subtitle: 'Review my current habits',
            icon: 'analytics',
            onPress: () => sendMessage('Please analyze my current routines and suggest improvements.'),
        },
        {
            title: 'Motivation Boost',
            subtitle: 'Get encouragement',
            icon: 'flame',
            onPress: () => sendMessage('I need some motivation to keep up with my routines. Can you help?'),
        },
        {
            title: 'Weekly Planning',
            subtitle: 'Plan the week ahead',
            icon: 'calendar',
            onPress: () => sendMessage('Help me plan an effective weekly routine structure.'),
        },
    ];

    /**
     * Render individual message with Claude-like styling
     */
    const renderMessage = ({ item }: { item: ChatMessageWithLoading }) => {
        const isUser = item.role === 'user';
        const isLoading = item.isLoading;

        return (
            <View style={[
                styles.messageRow,
                isUser ? styles.userMessageRow : styles.assistantMessageRow,
            ]}>
                {/* Avatar */}
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                            <Ionicons name="sparkles" size={16} color="#007AFF" />
                        </View>
                    </View>
                )}

                {/* Message Content */}
                <View style={[
                    styles.messageContent,
                    isUser ? styles.userMessageContent : styles.assistantMessageContent,
                ]}>
                    <View style={[
                        styles.messageBubble,
                        {
                            backgroundColor: isUser ? '#007AFF' : colors.surface,
                            borderColor: isUser ? '#007AFF' : colors.border,
                        },
                    ]}>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#007AFF" />
                                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                    AI is thinking...
                                </Text>
                            </View>
                        ) : (
                            <Markdown
                                style={{
                                    body: {
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        fontSize: 16,
                                        lineHeight: 24,
                                        margin: 0,
                                    },
                                    paragraph: {
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        fontSize: 16,
                                        lineHeight: 24,
                                        marginTop: 0,
                                        marginBottom: 12,
                                    },
                                    code_inline: {
                                        backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : colors.border,
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        paddingHorizontal: 4,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        fontSize: 14,
                                        fontFamily: 'Courier',
                                    },
                                    code_block: {
                                        backgroundColor: isUser ? 'rgba(255,255,255,0.1)' : colors.border,
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        padding: 12,
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontFamily: 'Courier',
                                        marginVertical: 8,
                                    },
                                    bullet_list: {
                                        marginVertical: 4,
                                    },
                                    ordered_list: {
                                        marginVertical: 4,
                                    },
                                    list_item: {
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        fontSize: 16,
                                        lineHeight: 24,
                                        marginBottom: 4,
                                    },
                                    blockquote: {
                                        backgroundColor: isUser ? 'rgba(255,255,255,0.1)' : colors.border,
                                        borderLeftWidth: 4,
                                        borderLeftColor: isUser ? '#FFFFFF' : '#007AFF',
                                        paddingLeft: 12,
                                        paddingVertical: 8,
                                        marginVertical: 8,
                                        borderRadius: 4,
                                    },
                                    heading1: {
                                        fontSize: 20,
                                        fontWeight: 'bold',
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        marginBottom: 8,
                                        marginTop: 16,
                                    },
                                    heading2: {
                                        fontSize: 18,
                                        fontWeight: '600',
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        marginBottom: 6,
                                        marginTop: 12,
                                    },
                                    heading3: {
                                        fontSize: 16,
                                        fontWeight: '600',
                                        color: isUser ? '#FFFFFF' : colors.text,
                                        marginBottom: 4,
                                        marginTop: 8,
                                    },
                                    strong: {
                                        fontWeight: 'bold',
                                        color: isUser ? '#FFFFFF' : colors.text,
                                    },
                                    em: {
                                        fontStyle: 'italic',
                                        color: isUser ? '#FFFFFF' : colors.text,
                                    },
                                }}
                            >
                                {item.content}
                            </Markdown>
                        )}
                    </View>
                </View>

                {/* User Avatar */}
                {isUser && (
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatar, { backgroundColor: '#007AFF' }]}>
                            <Ionicons name="person" size={16} color="#FFFFFF" />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    /**
     * Render quick actions
     */
    const renderQuickActions = () => {
        if (!showQuickActions || messages.length > 1) return null;

        return (
            <View style={styles.quickActionsContainer}>
                <Text style={[styles.quickActionsTitle, { color: colors.text }]}>
                    Quick Actions
                </Text>
                <View style={styles.quickActionsGrid}>
                    {quickActions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.quickActionButton,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={action.onPress}
                        >
                            <Ionicons name={action.icon as any} size={24} color="#007AFF" />
                            <Text style={[styles.quickActionTitle, { color: colors.text }]}>
                                {action.title}
                            </Text>
                            <Text style={[styles.quickActionSubtitle, { color: colors.textSecondary }]}>
                                {action.subtitle}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // 🔒 Show loading screen while redirecting non-premium users
    if (!isPremium) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.premiumLoadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={[styles.premiumLoadingText, { color: colors.text }]}>
                        Loading AI...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerContent}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.aiIcon, { backgroundColor: '#007AFF' }]}>
                            <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                        </View>
                        <View>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>
                                AI Assistant
                            </Text>
                            <Text style={[styles.headerSubtitle, { color: isConnected ? '#34C759' : '#FF3B30' }]}>
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => navigation.navigate('AISettings')}
                    >
                        <Ionicons name="settings" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Container */}
            <KeyboardAvoidingView
                style={styles.chatContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={renderQuickActions}
                    onContentSizeChange={() => {
                        if (messages.length > 0) {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                />

                {/* Input Container */}
                <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.text,
                            },
                        ]}
                        placeholder="Ask about your routines, schedule, or productivity..."
                        placeholderTextColor={colors.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        textAlignVertical="top"
                        onSubmitEditing={() => sendMessage()}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            {
                                backgroundColor: inputText.trim() && isConnected ? '#007AFF' : colors.border,
                                opacity: isLoading ? 0.5 : 1,
                            }
                        ]}
                        onPress={() => sendMessage()}
                        disabled={!inputText.trim() || isLoading || !isConnected}
                    >
                        <Ionicons
                            name="send"
                            size={20}
                            color={inputText.trim() && isConnected ? '#FFFFFF' : colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

/**
 * Helper function to get day name
 */
const getDayName = (dayIndex: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
        paddingTop: 10,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    aiIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    settingsButton: {
        padding: 8,
    },
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        paddingVertical: 16,
    },
    // Claude-like message layout
    messageRow: {
        flexDirection: 'row',
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    userMessageRow: {
        justifyContent: 'flex-end',
    },
    assistantMessageRow: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        marginTop: 4,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    messageContent: {
        flex: 1,
        maxWidth: width * 0.8, // Reasonable max width like Claude
    },
    userMessageContent: {
        alignItems: 'flex-end',
    },
    assistantMessageContent: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 18,
        borderWidth: 1,
        // No fixed width - let content determine size within maxWidth
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        fontStyle: 'italic',
    },
    quickActionsContainer: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    quickActionsTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickActionButton: {
        width: (width - 56) / 2,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 12,
    },
    quickActionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },
    quickActionSubtitle: {
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 12,
        maxHeight: 100,
        fontSize: 16,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // 🔒 Premium loading styles
    premiumLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumLoadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default AIChatScreen;