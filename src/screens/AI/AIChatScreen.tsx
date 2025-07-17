// ============================================
// AI CHAT SCREEN WITH MARKDOWN SUPPORT
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

const { width } = Dimensions.get('window');

interface AIChatScreenProps {
    navigation: any;
}

interface ChatMessageWithLoading extends ChatMessage {
    isLoading?: boolean;
}

const AIChatScreen: React.FC<AIChatScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();

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

    // Load data when screen focuses
    useFocusEffect(
        useCallback(() => {
            initializeChat();
            checkAIConnection();
        }, [])
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

            if (!connected) {
                Alert.alert(
                    'AI Not Connected',
                    'Please add your DeepSeek API key in the app settings.',
                    [
                        { text: 'Cancel' },
                        { text: 'Open Settings', onPress: () => navigation.navigate('AISettings') }
                    ]
                );
            }
        } catch (error) {
            console.error('Connection check failed:', error);
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
     * Render individual message with markdown support
     */
    const renderMessage = ({ item }: { item: ChatMessageWithLoading }) => {
        const isUser = item.role === 'user';
        const isLoading = item.isLoading;

        return (
            <View style={[
                styles.messageContainer,
                isUser ? styles.userMessage : styles.assistantMessage,
            ]}>
                {!isUser && (
                    <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#007AFF" />
                    </View>
                )}

                <View style={[
                    styles.messageBubble,
                    {
                        backgroundColor: isUser ? '#007AFF' : colors.surface,
                        borderColor: colors.border,
                    },
                ]}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                AI is thinking...
                            </Text>
                        </View>
                    ) : isUser ? (
                        // User messages - plain text (no markdown)
                        <Text style={[
                            styles.messageText,
                            { color: '#FFFFFF' },
                        ]}>
                            {item.content}
                        </Text>
                    ) : (
                        // AI messages - render with markdown
                        <Markdown
                            style={{
                                body: {
                                    color: colors.text,
                                    fontSize: 16,
                                    lineHeight: 22,
                                    fontFamily: 'System',
                                },
                                paragraph: {
                                    marginTop: 0,
                                    marginBottom: 8,
                                    color: colors.text,
                                    fontSize: 16,
                                    lineHeight: 22,
                                },
                                strong: {
                                    fontWeight: 'bold',
                                    color: colors.text,
                                },
                                em: {
                                    fontStyle: 'italic',
                                    color: colors.text,
                                },
                                code_inline: {
                                    backgroundColor: colors.border,
                                    paddingHorizontal: 4,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    fontFamily: 'monospace',
                                    fontSize: 14,
                                    color: colors.text,
                                },
                                bullet_list: {
                                    marginVertical: 4,
                                },
                                ordered_list: {
                                    marginVertical: 4,
                                },
                                list_item: {
                                    marginVertical: 2,
                                    color: colors.text,
                                    fontSize: 16,
                                },
                                blockquote: {
                                    backgroundColor: colors.border,
                                    borderLeftWidth: 4,
                                    borderLeftColor: '#007AFF',
                                    paddingLeft: 12,
                                    paddingVertical: 8,
                                    marginVertical: 4,
                                },
                                heading1: {
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    marginVertical: 8,
                                    color: colors.text,
                                },
                                heading2: {
                                    fontSize: 17,
                                    fontWeight: '600',
                                    marginVertical: 6,
                                    color: colors.text,
                                },
                                text: {
                                    color: colors.text,
                                    fontSize: 16,
                                    lineHeight: 22,
                                },
                            }}
                        >
                            {item.content}
                        </Markdown>
                    )}
                </View>

                {isUser && (
                    <View style={[styles.avatarContainer, { backgroundColor: '#007AFF' }]}>
                        <Ionicons name="person" size={20} color="#FFFFFF" />
                    </View>
                )}
            </View>
        );
    };

    /**
     * Render quick actions
     */
    const renderQuickActions = () => {
        if (!showQuickActions || messages.length > 2) return null;

        return (
            <View style={styles.quickActionsContainer}>
                <Text style={[styles.quickActionsTitle, { color: colors.text }]}>
                    Quick Actions
                </Text>
                <View style={styles.quickActionsGrid}>
                    {quickActions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={action.onPress}
                            disabled={isLoading}
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

    /**
     * Render header
     */
    const renderHeader = () => (
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                    <View style={[styles.aiIcon, { backgroundColor: isConnected ? '#00FF7F20' : '#FF000020' }]}>
                        <Ionicons name="chatbubble-ellipses" size={24} color={isConnected ? '#00FF7F' : '#FF0000'} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            AI Assistant
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {isConnected ? 'Connected' : 'Check Settings'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('AISettings')}
                >
                    <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {renderHeader()}

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
                    ListFooterComponent={renderQuickActions}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                {/* Input Area */}
                <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Ask about your routines, schedule, or productivity..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={1000}
                        editable={!isLoading && isConnected}
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
        padding: 16,
        paddingBottom: 20,
    },
    messageContainer: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
    },
    userMessage: {
        justifyContent: 'flex-end',
    },
    assistantMessage: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    messageBubble: {
        maxWidth: width * 0.75,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        fontStyle: 'italic',
    },
    quickActionsContainer: {
        marginTop: 20,
        paddingHorizontal: 4,
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
        width: (width - 48) / 2,
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
});

export default AIChatScreen;