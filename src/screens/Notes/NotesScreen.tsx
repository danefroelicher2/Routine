import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { Note } from '../../types/database';

interface NotesScreenProps {
    navigation: any;
}

export default function NotesScreen({ navigation }: NotesScreenProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadNotes();
        }, [])
    );

    const loadNotes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: notesData, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('is_pinned', { ascending: false })
                .order('updated_at', { ascending: false });

            if (error) throw error;

            setNotes(notesData || []);
        } catch (error) {
            console.error('Error loading notes:', error);
            Alert.alert('Error', 'Failed to load notes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const createNewNote = () => {
        navigation.navigate('NoteDetail', {
            isNew: true,
            onSave: loadNotes
        });
    };

    const openNote = (note: Note) => {
        navigation.navigate('NoteDetail', {
            note,
            onSave: loadNotes
        });
    };

    const togglePinNote = async (note: Note) => {
        try {
            const { error } = await supabase
                .from('notes')
                .update({ is_pinned: !note.is_pinned })
                .eq('id', note.id);

            if (error) throw error;

            loadNotes();
        } catch (error) {
            console.error('Error toggling pin:', error);
            Alert.alert('Error', 'Failed to update note');
        }
    };

    const deleteNote = async (note: Note) => {
        Alert.alert(
            'Delete Note',
            'Are you sure you want to delete this note?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('notes')
                                .delete()
                                .eq('id', note.id);

                            if (error) throw error;

                            loadNotes();
                        } catch (error) {
                            console.error('Error deleting note:', error);
                            Alert.alert('Error', 'Failed to delete note');
                        }
                    },
                },
            ]
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } else if (diffInHours < 24 * 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const getPreviewText = (content: string) => {
        if (!content) return 'No additional text';
        return content.length > 100 ? content.substring(0, 100) + '...' : content;
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadNotes();
    };

    const renderNote = ({ item: note }: { item: Note }) => (
        <TouchableOpacity
            style={styles.noteItem}
            onPress={() => openNote(note)}
        >
            <View style={styles.noteContent}>
                <View style={styles.noteHeader}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                        {note.title || 'Untitled'}
                    </Text>
                    <View style={styles.noteActions}>
                        {note.is_locked && (
                            <Ionicons name="lock-closed" size={16} color="#666" style={styles.noteIcon} />
                        )}
                        <TouchableOpacity
                            onPress={() => togglePinNote(note)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons
                                name={note.is_pinned ? "star" : "star-outline"}
                                size={16}
                                color={note.is_pinned ? "#ffb347" : "#666"}
                                style={styles.noteIcon}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => deleteNote(note)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.notePreview} numberOfLines={2}>
                    {getPreviewText(note.content || '')}
                </Text>

                <Text style={styles.noteDate}>
                    {formatDate(note.updated_at)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderSeparator = () => <View style={styles.separator} />;

    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Notes Yet</Text>
            <Text style={styles.emptyStateText}>
                Tap the + button to create your first note
            </Text>
        </View>
    );

    // Separate pinned and regular notes
    const pinnedNotes = notes.filter(note => note.is_pinned);
    const regularNotes = notes.filter(note => !note.is_pinned);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notes</Text>
                <TouchableOpacity style={styles.addButton} onPress={createNewNote}>
                    <Ionicons name="add" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={[...pinnedNotes, ...regularNotes]}
                renderItem={renderNote}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={renderSeparator}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.listContainer}
                ListHeaderComponent={() => (
                    pinnedNotes.length > 0 && regularNotes.length > 0 ? (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Pinned</Text>
                        </View>
                    ) : null
                )}
                stickyHeaderIndices={pinnedNotes.length > 0 && regularNotes.length > 0 ? [0] : []}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    addButton: {
        padding: 8,
    },
    listContainer: {
        paddingVertical: 10,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    sectionHeader: {
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
    },
    noteItem: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    noteContent: {
        flex: 1,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    noteTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginRight: 10,
    },
    noteActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noteIcon: {
        marginLeft: 12,
    },
    notePreview: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 6,
    },
    noteDate: {
        fontSize: 12,
        color: '#999',
    },
    separator: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginLeft: 20,
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        lineHeight: 22,
    },
});