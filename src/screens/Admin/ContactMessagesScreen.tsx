// ============================================
// ADMIN CONTACT MESSAGES SCREEN
// Create this as src/screens/Admin/ContactMessagesScreen.tsx
// This screen allows you to view all submitted contact messages
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Modal,
    ScrollView,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { contactSupportService, ContactSupportMessage } from '../../services/contactSupportService';
import { useTheme } from '../../../ThemeContext';

interface ContactMessagesScreenProps {
    navigation: any;
}

export default function ContactMessagesScreen({ navigation }: ContactMessagesScreenProps) {
    const [messages, setMessages] = useState<ContactSupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ContactSupportMessage | null>(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        new: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
    });

    const { colors } = useTheme();

    const loadMessages = async () => {
        try {
            let fetchedMessages: ContactSupportMessage[] = [];

            if (searchQuery.trim()) {
                // Search mode
                fetchedMessages = await contactSupportService.searchContactMessages(searchQuery.trim());
            } else {
                // Normal mode with optional status filter
                const statusFilter = filterStatus === 'all' ? undefined : filterStatus as any;
                fetchedMessages = await contactSupportService.getAllContactMessages(statusFilter, 100);
            }

            setMessages(fetchedMessages);

            // Load stats
            const messageStats = await contactSupportService.getContactMessageStats();
            setStats(messageStats);

        } catch (error) {
            console.error('Error loading contact messages:', error);
            Alert.alert('Error', 'Failed to load contact messages');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadMessages();
        }, [filterStatus, searchQuery])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadMessages();
    };

    const handleStatusUpdate = async (messageId: string, newStatus: string) => {
        try {
            await contactSupportService.updateContactMessageStatus(messageId, newStatus as any);

            // Update local state
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === messageId ? { ...msg, status: newStatus as any } : msg
                )
            );

            Alert.alert('Success', `Message status updated to ${newStatus}`);
            setShowMessageModal(false);
        } catch (error) {
            console.error('Error updating message status:', error);
            Alert.alert('Error', 'Failed to update message status');
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await contactSupportService.deleteContactMessage(messageId);
                            setMessages(prev => prev.filter(msg => msg.id !== messageId));
                            setShowMessageModal(false);
                            Alert.alert('Success', 'Message deleted successfully');
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            Alert.alert('Error', 'Failed to delete message');
                        }
                    }
                }
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return '#FF6B6B';
            case 'in_progress': return '#4ECDC4';
            case 'resolved': return '#45B7D1';
            case 'closed': return '#96CEB4';
            default: return colors.textSecondary;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'new': return 'alert-circle';
            case 'in_progress': return 'time';
            case 'resolved': return 'checkmark-circle';
            case 'closed': return 'archive';
            default: return 'help-circle';
        }
    };

    const renderMessageItem = ({ item }: { item: ContactSupportMessage }) => (
        <TouchableOpacity
            style={[styles.messageItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
                setSelectedMessage(item);
                setShowMessageModal(true);
            }}
        >
            <View style={styles.messageHeader}>
                <View style={styles.messageHeaderLeft}>
                    <Text style={[styles.messageName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.messageEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Ionicons name={getStatusIcon(item.status)} size={12} color="white" />
                    <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
            </View>

            <Text style={[styles.messagePreview, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.message}
            </Text>

            <Text style={[styles.messageDate, { color: colors.textTertiary }]}>
                {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString()}
            </Text>
        </TouchableOpacity>
    );

    const renderStatsCard = () => (
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statsTitle, { color: colors.text }]}>Message Statistics</Text>
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#FF6B6B' }]}>{stats.new}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>New</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#4ECDC4' }]}>{stats.in_progress}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>In Progress</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#45B7D1' }]}>{stats.resolved}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Resolved</Text>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Contact Messages</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={[styles.loadingText, { color: colors.text }]}>Loading messages...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Contact Messages</Text>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search by name or email..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filter Buttons */}
            <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
                    {['all', 'new', 'in_progress', 'resolved', 'closed'].map((status) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterButton,
                                {
                                    backgroundColor: filterStatus === status ? '#007AFF' : colors.background,
                                    borderColor: colors.border,
                                }
                            ]}
                            onPress={() => setFilterStatus(status)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                { color: filterStatus === status ? 'white' : colors.text }
                            ]}>
                                {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Messages List */}
            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={renderStatsCard}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="mail-open-outline" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Messages Found</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                            {searchQuery ? 'Try adjusting your search query' : 'Contact messages will appear here when users submit them'}
                        </Text>
                    </View>
                )}
            />

            {/* Message Detail Modal */}
            <Modal
                visible={showMessageModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowMessageModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        {selectedMessage && (
                            <ScrollView style={styles.modalScroll}>
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>Message Details</Text>
                                    <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Message Info */}
                                <View style={styles.messageDetails}>
                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name:</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedMessage.name}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Email:</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedMessage.email}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status:</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedMessage.status) }]}>
                                            <Ionicons name={getStatusIcon(selectedMessage.status)} size={12} color="white" />
                                            <Text style={styles.statusText}>{selectedMessage.status.replace('_', ' ').toUpperCase()}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Submitted:</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>
                                            {new Date(selectedMessage.created_at).toLocaleDateString()} at {new Date(selectedMessage.created_at).toLocaleTimeString()}
                                        </Text>
                                    </View>

                                    <View style={styles.messageSection}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Message:</Text>
                                        <View style={[styles.messageBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                            <Text style={[styles.messageText, { color: colors.text }]}>{selectedMessage.message}</Text>
                                        </View>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.actionButtons}>
                                        <Text style={[styles.actionTitle, { color: colors.text }]}>Update Status:</Text>
                                        <View style={styles.statusButtons}>
                                            {['new', 'in_progress', 'resolved', 'closed'].map((status) => (
                                                <TouchableOpacity
                                                    key={status}
                                                    style={[
                                                        styles.statusActionButton,
                                                        {
                                                            backgroundColor: selectedMessage.status === status ? getStatusColor(status) : colors.background,
                                                            borderColor: getStatusColor(status),
                                                        }
                                                    ]}
                                                    onPress={() => handleStatusUpdate(selectedMessage.id, status)}
                                                    disabled={selectedMessage.status === status}
                                                >
                                                    <Text style={[
                                                        styles.statusActionText,
                                                        { color: selectedMessage.status === status ? 'white' : getStatusColor(status) }
                                                    ]}>
                                                        {status.replace('_', ' ').toUpperCase()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Delete Button */}
                                        <TouchableOpacity
                                            style={[styles.deleteButton, { borderColor: '#FF6B6B' }]}
                                            onPress={() => handleDeleteMessage(selectedMessage.id)}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                            <Text style={[styles.deleteButtonText, { color: '#FF6B6B' }]}>Delete Message</Text>

                                        </TouchableOpacity>

                                    </div>
                                </View>

                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
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
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    filterContainer: {
        borderBottomWidth: 1,
        paddingVertical: 12,
    },
    filterScrollContent: {
        paddingHorizontal: 20,
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    listContainer: {
        padding: 20,
    },
    statsCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    messageItem: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    messageHeaderLeft: {
        flex: 1,
    },
    messageName: {
        fontSize: 16,
        fontWeight: '600',
    },
    messageEmail: {
        fontSize: 14,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    messagePreview: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    messageDate: {
        fontSize: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        maxHeight: '90%',
    },
    modalScroll: {
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    messageDetails: {
        gap: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        minWidth: 80,
    },
    detailValue: {
        fontSize: 14,
        flex: 1,
    },
    messageSection: {
        gap: 8,
    },
    messageBox: {
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    actionButtons: {
        marginTop: 20,
        gap: 16,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    statusButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusActionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusActionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});