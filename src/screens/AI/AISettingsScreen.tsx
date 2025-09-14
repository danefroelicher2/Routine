// ============================================
// STREAMLINED AI SETTINGS SCREEN - Chat History + AI Naming
// Replace your entire src/screens/AI/AISettingsScreen.tsx with this
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../ThemeContext';
import { supabase } from '../../services/supabase';
import { chatService } from '../../services/chatService';
import { ChatSession } from '../../types/database';

interface AISettingsScreenProps {
    navigation: any;
}

const AISettingsScreen: React.FC<AISettingsScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();

    // State
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiName, setAiName] = useState('AI Assistant');
    const [tempAiName, setTempAiName] = useState('');
    const [savingName, setSavingName] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    /**
     * Load chat sessions and AI name preference
     */
    const loadData = async () => {
        try {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Load chat sessions
                const sessions = await chatService.getChatSessions(user.id);
                setChatSessions(sessions);

                // Load AI name preference
                const { data: settings } = await supabase
                    .from('user_settings')
                    .select('ai_name')
                    .eq('user_id', user.id)
                    .single();

                const savedName = settings?.ai_name || 'AI Assistant';
                setAiName(savedName);
                setTempAiName(savedName);
            }

        } catch (error) {
            console.error('Error loading AI settings:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Save AI name preference
     */
    const saveAiName = async () => {
        if (!tempAiName.trim()) {
            Alert.alert('Error', 'Please enter a name for your AI assistant.');
            return;
        }

        try {
            setSavingName(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const trimmedName = tempAiName.trim();

            // Upsert AI name preference
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    ai_name: trimmedName
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            setAiName(trimmedName);
            Alert.alert('Saved!', `Your AI assistant is now named "${trimmedName}"`);

        } catch (error) {
            console.error('Error saving AI name:', error);
            Alert.alert('Error', 'Failed to save AI name. Please try again.');
        } finally {
            setSavingName(false);
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

    // Loading state
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
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    AI Settings
                </Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Chat History Section */}
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
                                Start a conversation with {aiName}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.chatList}>
                            {chatSessions.map(session => (
                                <View key={session.id} style={[styles.chatItem, { borderBottomColor: colors.border }]}>
                                    <View style={styles.chatInfo}>
                                        <Text
                                            style={[styles.chatTitle, { color: colors.text }]}
                                            numberOfLines={1}
                                        >
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

                {/* AI Name Customization */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-circle" size={20} color="#007AFF" />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            Name Your AI Assistant
                        </Text>
                    </View>

                    <View style={styles.nameCustomization}>


                        <TextInput
                            style={[styles.nameInput, {
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                                color: colors.text
                            }]}
                            value={tempAiName}
                            onChangeText={setTempAiName}
                            placeholder="Enter a name for your AI..."
                            placeholderTextColor={colors.textSecondary}
                            maxLength={30}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, {
                                backgroundColor: tempAiName.trim() && tempAiName.trim() !== aiName ? '#007AFF' : colors.border
                            }]}
                            onPress={saveAiName}
                            disabled={savingName || !tempAiName.trim() || tempAiName.trim() === aiName}
                        >
                            {savingName ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="save" size={20} color="#FFFFFF" />
                                    <Text style={styles.saveButtonText}>
                                        Save Name
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
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
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 16,
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    headerRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    section: {
        marginTop: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    clearAllText: {
        fontSize: 16,
        fontWeight: '500',
    },
    emptyChatHistory: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
    },
    chatList: {
        // Container for chat sessions
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
    nameCustomization: {
        // Container for AI name customization
    },
    currentNameLabel: {
        fontSize: 14,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    nameInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 16,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 12,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    nameHelpText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    premiumNote: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    premiumText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    premiumSubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default AISettingsScreen;