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
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../../services/supabase';
import { Note } from '../../types/database';

interface NoteDetailScreenProps {
    navigation: any;
    route: {
        params: {
            note?: Note;
            isNew?: boolean;
            onSave?: () => void;
        };
    };
}

export default function NoteDetailScreen({ navigation, route }: NoteDetailScreenProps) {
    const { note, isNew = false, onSave } = route.params || {};

    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [isLocked, setIsLocked] = useState(note?.is_locked || false);
    const [isPinned, setIsPinned] = useState(note?.is_pinned || false);
    const [hasAuthenticated, setHasAuthenticated] = useState(!note?.is_locked);
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

    const checkBiometricAvailability = async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        return compatible && enrolled;
    };

    const authenticateWithBiometrics = async () => {
        try {
            const biometricAvailable = await checkBiometricAvailability();

            if (!biometricAvailable) {
                Alert.alert(
                    'Biometric Authentication Unavailable',
                    'Please set up Face ID or Touch ID in your device settings to use this feature.'
                );
                return false;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to access this note',
                cancelLabel: 'Cancel',
                fallbackLabel: 'Use Password',
            });

            return result.success;
        } catch (error) {
            console.error('Biometric authentication error:', error);
            Alert.alert('Authentication Error', 'Unable to authenticate. Please try again.');
            return false;
        }
    };

    const handleLockToggle = async () => {
        if (!isLocked) {
            // Locking the note
            const authenticated = await authenticateWithBiometrics();
            if (authenticated) {
                setIsLocked(true);
            }
        } else {
            // Unlocking the note
            const authenticated = await authenticateWithBiometrics();
            if (authenticated) {
                setIsLocked(false);
                setHasAuthenticated(true);
            }
        }
    };

    const handleAccessLockedNote = async () => {
        const authenticated = await authenticateWithBiometrics();
        if (authenticated) {
            setHasAuthenticated(true);
        }
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
                        is_locked: isLocked,
                    });

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('notes')
                    .update({
                        title: title.trim() || 'Untitled',
                        content: content.trim(),
                        is_pinned: isPinned,
                        is_locked: isLocked,
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
        // Note: In a real app, you'd implement proper sharing
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

    if (isLocked && !hasAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Locked Note</Text>
                    <View style={styles.headerButton} />
                </View>

                <View style={styles.lockedContainer}>
                    <Ionicons name="lock-closed" size={64} color="#666" />
                    <Text style={styles.lockedTitle}>This note is locked</Text>
                    <Text style={styles.lockedSubtitle}>
                        Use Face ID or Touch ID to unlock
                    </Text>
                    <TouchableOpacity
                        style={styles.unlockButton}
                        onPress={handleAccessLockedNote}
                    >
                        <Ionicons name="finger-print" size={24} color="#fff" />
                        <Text style={styles.unlockButtonText}>Unlock</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
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
    lockedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    lockedTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 8,
    },
    lockedSubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 32,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    unlockButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});