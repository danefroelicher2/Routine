import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { Note } from '../../types/database';

interface NoteDetailScreenProps {
    navigation: any;
    route: {
        params?: {
            note?: Note;
            isNew?: boolean;
            onSave?: () => void;
        };
    };
}

export default function NoteDetailScreen({ navigation, route }: NoteDetailScreenProps) {
    const params = route.params || {};
    const { note, isNew = false, onSave } = params;

    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [isLocked, setIsLocked] = useState(note?.is_locked || false);
    const [isPinned, setIsPinned] = useState(note?.is_pinned || false);
    const [hasAuthenticated, setHasAuthenticated] = useState(true); // Always authenticated for now
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const titleInputRef = useRef<TextInput>(null);
    const contentInputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isNew && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [isNew]);

    useEffect(() => {
        setHasChanges(
            title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            isLocked !== (note?.is_locked || false) ||
            isPinned !== (note?.is_pinned || false)
        );
    }, [title, content, isLocked, isPinned, note]);

    useEffect(() => {
        // Auto-save functionality
        const saveTimer = setTimeout(() => {
            if (hasChanges && (title.trim() || content.trim())) {
                handleSave(false); // Silent save
            }
        }, 2000); // Save after 2 seconds of inactivity

        return () => clearTimeout(saveTimer);
    }, [title, content, hasChanges]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (!hasChanges) {
                return;
            }

            e.preventDefault();

            Alert.alert(
                'Discard changes?',
                'You have unsaved changes. Are you sure you want to discard them?',
                [
                    { text: "Don't leave", style: 'cancel', onPress: () => { } },
                    {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => navigation.dispatch(e.data.action),
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, hasChanges]);

    const handleLockToggle = () => {
        // For now, just show an alert that biometric auth isn't available yet
        Alert.alert(
            'Biometric Authentication',
            'Face ID/Touch ID feature will be available in a future update. For now, notes cannot be locked.',
            [{ text: 'OK' }]
        );
    };

    const handleSave = async (showAlert = true) => {
        if (!title.trim() && !content.trim()) {
            if (showAlert) {
                Alert.alert('Empty Note', 'Cannot save an empty note');
            }
            return;
        }

        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            if (isNew) {
                const { error } = await supabase
                    .from('notes')
                    .insert({
                        user_id: user.id,
                        title: title.trim() || 'Untitled',
                        content: content.trim(),
                        is_pinned: isPinned,
                        is_locked: false, // Always false for now since we don't have biometric auth
                    });

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('notes')
                    .update({
                        title: title.trim() || 'Untitled',
                        content: content.trim(),
                        is_pinned: isPinned,
                        is_locked: false, // Always false for now
                    })
                    .eq('id', note!.id);

                if (error) throw error;
            }

            setHasChanges(false);

            if (showAlert) {
                Alert.alert('Success', 'Note saved successfully');
            }

            if (onSave) {
                onSave();
            }
        } catch (error) {
            console.error('Error saving note:', error);
            if (showAlert) {
                Alert.alert('Error', 'Failed to save note');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleShare = () => {
        Alert.alert('Share', 'Sharing functionality would be implemented here');
    };

    const handleDelete = () => {
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
                            if (!isNew && note) {
                                const { error } = await supabase
                                    .from('notes')
                                    .delete()
                                    .eq('id', note.id);

                                if (error) throw error;
                            }

                            if (onSave) {
                                onSave();
                            }
                            navigation.goBack();
                        } catch (error) {
                            console.error('Error deleting note:', error);
                            Alert.alert('Error', 'Failed to delete note');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerActionButton}
                            onPress={() => setIsPinned(!isPinned)}
                        >
                            <Ionicons
                                name={isPinned ? "star" : "star-outline"}
                                size={20}
                                color={isPinned ? "#ffb347" : "#007AFF"}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerActionButton}
                            onPress={handleLockToggle}
                        >
                            <Ionicons
                                name={isLocked ? "lock-closed" : "lock-open-outline"}
                                size={20}
                                color="#007AFF"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerActionButton}
                            onPress={handleShare}
                        >
                            <Ionicons name="share-outline" size={20} color="#007AFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerActionButton}
                            onPress={handleDelete}
                        >
                            <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.savingButton]}
                            onPress={() => handleSave(true)}
                            disabled={saving}
                        >
                            <Text style={styles.saveButtonText}>
                                {saving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <TextInput
                        ref={titleInputRef}
                        style={styles.titleInput}
                        placeholder="Title"
                        placeholderTextColor="#999"
                        value={title}
                        onChangeText={setTitle}
                        returnKeyType="next"
                        onSubmitEditing={() => contentInputRef.current?.focus()}
                    />

                    <TextInput
                        ref={contentInputRef}
                        style={styles.contentInput}
                        placeholder="Start writing..."
                        placeholderTextColor="#999"
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                    />
                </ScrollView>

                {hasChanges && (
                    <View style={styles.changeIndicator}>
                        <Text style={styles.changeIndicatorText}>
                            Unsaved changes
                        </Text>
                    </View>
                )}
            </KeyboardAvoidingView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerButton: {
        padding: 8,
        minWidth: 40,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActionButton: {
        padding: 8,
        marginLeft: 8,
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        marginLeft: 12,
    },
    savingButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    titleInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    contentInput: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
        paddingVertical: 16,
        minHeight: 200,
    },
    changeIndicator: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#ff9500',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    changeIndicatorText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});