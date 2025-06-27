import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

interface RoutineTemplate {
    id: string;
    name: string;
    description?: string;
    icon: string;
    category: string;
}

interface AddRoutineScreenProps {
    navigation: any;
}

const AddRoutineScreen: React.FC<AddRoutineScreenProps> = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredRoutines, setFilteredRoutines] = useState<RoutineTemplate[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [customDescription, setCustomDescription] = useState('');

    // Pre-defined routine templates
    const routineTemplates: RoutineTemplate[] = [
        { id: '1', name: 'Workout', description: 'Physical exercise session', icon: 'fitness', category: 'Fitness' },
        { id: '2', name: 'Run', description: 'Go for a run', icon: 'walk', category: 'Fitness' },
        { id: '3', name: 'Read a Book', description: 'Reading time', icon: 'book', category: 'Learning' },
        { id: '4', name: 'Bicycling', description: 'Bike ride', icon: 'bicycle', category: 'Fitness' },
        { id: '5', name: 'Work', description: 'Work session', icon: 'briefcase', category: 'Productivity' },
        { id: '6', name: 'Coffee', description: 'Coffee break', icon: 'cafe', category: 'Lifestyle' },
        { id: '7', name: 'Meditation', description: 'Mindfulness practice', icon: 'leaf', category: 'Wellness' },
        { id: '8', name: 'Yoga', description: 'Yoga practice', icon: 'body', category: 'Fitness' },
        { id: '9', name: 'Walk', description: 'Take a walk', icon: 'walk', category: 'Fitness' },
        { id: '10', name: 'Study', description: 'Study session', icon: 'school', category: 'Learning' },
        { id: '11', name: 'Cook', description: 'Prepare meals', icon: 'restaurant', category: 'Lifestyle' },
        { id: '12', name: 'Sleep 8 Hours', description: 'Get adequate rest', icon: 'bed', category: 'Wellness' },
        { id: '13', name: 'Drink Water', description: 'Stay hydrated', icon: 'water', category: 'Wellness' },
        { id: '14', name: 'Journal', description: 'Write in journal', icon: 'create', category: 'Wellness' },
        { id: '15', name: 'Stretch', description: 'Stretching exercises', icon: 'accessibility', category: 'Fitness' },
        { id: '16', name: 'Social Media Break', description: 'Limit screen time', icon: 'phone-portrait', category: 'Wellness' },
        { id: '17', name: 'Music Practice', description: 'Practice instrument', icon: 'musical-notes', category: 'Learning' },
        { id: '18', name: 'Clean House', description: 'Household cleaning', icon: 'home', category: 'Lifestyle' },
        { id: '19', name: 'Garden', description: 'Gardening activities', icon: 'flower', category: 'Lifestyle' },
        { id: '20', name: 'Video Call Family', description: 'Connect with family', icon: 'videocam', category: 'Social' },
    ];

    useEffect(() => {
        // Filter routines based on search query
        if (searchQuery.trim() === '') {
            setFilteredRoutines(routineTemplates);
        } else {
            const filtered = routineTemplates.filter(routine =>
                routine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                routine.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                routine.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredRoutines(filtered);
        }
    }, [searchQuery]);

    const handleSelectRoutine = async (routine: RoutineTemplate) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Get the current highest sort_order
            const { data: existingRoutines } = await supabase
                .from('user_routines')
                .select('sort_order')
                .eq('user_id', user.id)
                .order('sort_order', { ascending: false })
                .limit(1);

            const nextSortOrder = existingRoutines && existingRoutines.length > 0
                ? existingRoutines[0].sort_order + 1
                : 1;

            const { error } = await supabase
                .from('user_routines')
                .insert({
                    user_id: user.id,
                    name: routine.name,
                    description: routine.description,
                    icon: routine.icon,
                    is_daily: true, // Default to daily
                    is_weekly: false,
                    is_active: true,
                    sort_order: nextSortOrder,
                });

            if (error) throw error;

            Alert.alert('Success', `${routine.name} added to your daily routine!`);
            navigation.goBack();
        } catch (error) {
            console.error('Error adding routine:', error);
            Alert.alert('Error', 'Failed to add routine. Please try again.');
        }
    };

    const handleCreateCustom = async () => {
        if (!customTitle.trim()) {
            Alert.alert('Error', 'Please enter a title for your routine');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Get the current highest sort_order
            const { data: existingRoutines } = await supabase
                .from('user_routines')
                .select('sort_order')
                .eq('user_id', user.id)
                .order('sort_order', { ascending: false })
                .limit(1);

            const nextSortOrder = existingRoutines && existingRoutines.length > 0
                ? existingRoutines[0].sort_order + 1
                : 1;

            const { error } = await supabase
                .from('user_routines')
                .insert({
                    user_id: user.id,
                    name: customTitle.trim(),
                    description: customDescription.trim() || null,
                    icon: 'checkmark-circle', // Default icon
                    is_daily: true, // Default to daily
                    is_weekly: false,
                    is_active: true,
                    sort_order: nextSortOrder,
                });

            if (error) throw error;

            Alert.alert('Success', `${customTitle} added to your daily routine!`);
            setShowCreateModal(false);
            setCustomTitle('');
            setCustomDescription('');
            navigation.goBack();
        } catch (error) {
            console.error('Error creating custom routine:', error);
            Alert.alert('Error', 'Failed to create routine. Please try again.');
        }
    };

    const renderRoutineItem = ({ item }: { item: RoutineTemplate }) => (
        <TouchableOpacity
            style={styles.routineItem}
            onPress={() => handleSelectRoutine(item)}
        >
            <View style={styles.routineIcon}>
                <Ionicons name={item.icon as any} size={24} color="#007AFF" />
            </View>
            <View style={styles.routineInfo}>
                <Text style={styles.routineName}>{item.name}</Text>
                {item.description && (
                    <Text style={styles.routineDescription}>{item.description}</Text>
                )}
                <Text style={styles.routineCategory}>{item.category}</Text>
            </View>
            <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Routine</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for routines..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                </View>

                {/* Create Custom Button */}
                <TouchableOpacity
                    style={styles.createCustomButton}
                    onPress={() => setShowCreateModal(true)}
                >
                    <Ionicons name="add-circle" size={20} color="#007AFF" />
                    <Text style={styles.createCustomText}>Create Your Own Routine</Text>
                </TouchableOpacity>

                {/* Routines List */}
                <Text style={styles.sectionTitle}>Popular Routines</Text>
                <FlatList
                    data={filteredRoutines}
                    renderItem={renderRoutineItem}
                    keyExtractor={(item) => item.id}
                    style={styles.routinesList}
                    showsVerticalScrollIndicator={false}
                />
            </View>

            {/* Create Custom Modal */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create Custom Routine</Text>
                        <TouchableOpacity onPress={handleCreateCustom}>
                            <Text style={styles.saveButton}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Title *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter routine name"
                                value={customTitle}
                                onChangeText={setCustomTitle}
                                autoFocus
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Description (Optional)</Text>
                            <TextInput
                                style={[styles.textInput, styles.textAreaInput]}
                                placeholder="Enter description"
                                value={customDescription}
                                onChangeText={setCustomDescription}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    createCustomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f8ff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    createCustomText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#007AFF',
        marginLeft: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    routinesList: {
        flex: 1,
    },
    routineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    routineIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f8ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    routineInfo: {
        flex: 1,
    },
    routineName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    routineDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    routineCategory: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
    },
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    cancelButton: {
        fontSize: 16,
        color: '#666',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    textAreaInput: {
        height: 100,
        textAlignVertical: 'top',
    },
});

export default AddRoutineScreen;