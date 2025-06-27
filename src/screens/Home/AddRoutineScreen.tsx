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
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Organized routine templates by category
    const routineTemplates: RoutineTemplate[] = [
        // Fitness
        { id: '1', name: 'Workout', description: 'Physical exercise session', icon: 'fitness', category: 'Fitness' },
        { id: '2', name: 'Run', description: 'Go for a run', icon: 'walk', category: 'Fitness' },
        { id: '3', name: 'Bicycling', description: 'Bike ride', icon: 'bicycle', category: 'Fitness' },
        { id: '4', name: 'Yoga', description: 'Yoga practice', icon: 'body', category: 'Fitness' },
        { id: '5', name: 'Walk', description: 'Take a walk', icon: 'walk', category: 'Fitness' },
        { id: '6', name: 'Stretch', description: 'Stretching exercises', icon: 'accessibility', category: 'Fitness' },
        { id: '7', name: 'Swimming', description: 'Swimming workout', icon: 'water', category: 'Fitness' },
        { id: '8', name: 'Weightlifting', description: 'Strength training', icon: 'barbell', category: 'Fitness' },
        { id: '9', name: 'Cardio', description: 'Cardiovascular exercise', icon: 'heart', category: 'Fitness' },

        // Learning
        { id: '10', name: 'Read a Book', description: 'Reading time', icon: 'book', category: 'Learning' },
        { id: '11', name: 'Study', description: 'Study session', icon: 'school', category: 'Learning' },
        { id: '12', name: 'Music Practice', description: 'Practice instrument', icon: 'musical-notes', category: 'Learning' },
        { id: '13', name: 'Language Learning', description: 'Practice new language', icon: 'chatbubbles', category: 'Learning' },
        { id: '14', name: 'Online Course', description: 'Take online classes', icon: 'laptop', category: 'Learning' },
        { id: '15', name: 'Podcast', description: 'Listen to educational content', icon: 'headset', category: 'Learning' },
        { id: '16', name: 'Writing', description: 'Creative or technical writing', icon: 'create', category: 'Learning' },

        // Productivity
        { id: '17', name: 'Work', description: 'Work session', icon: 'briefcase', category: 'Productivity' },
        { id: '18', name: 'Plan Day', description: 'Daily planning', icon: 'calendar', category: 'Productivity' },
        { id: '19', name: 'Email Management', description: 'Process emails', icon: 'mail', category: 'Productivity' },
        { id: '20', name: 'Deep Work', description: 'Focused work session', icon: 'bulb', category: 'Productivity' },
        { id: '21', name: 'Review Goals', description: 'Check progress', icon: 'checkmark-done', category: 'Productivity' },
        { id: '22', name: 'Organize Workspace', description: 'Clean and organize', icon: 'file-tray', category: 'Productivity' },

        // Wellness
        { id: '23', name: 'Meditation', description: 'Mindfulness practice', icon: 'leaf', category: 'Wellness' },
        { id: '24', name: 'Sleep 8 Hours', description: 'Get adequate rest', icon: 'bed', category: 'Wellness' },
        { id: '25', name: 'Drink Water', description: 'Stay hydrated', icon: 'water', category: 'Wellness' },
        { id: '26', name: 'Journal', description: 'Write in journal', icon: 'create', category: 'Wellness' },
        { id: '27', name: 'Social Media Break', description: 'Limit screen time', icon: 'phone-portrait', category: 'Wellness' },
        { id: '28', name: 'Breathwork', description: 'Breathing exercises', icon: 'flower', category: 'Wellness' },
        { id: '29', name: 'Gratitude Practice', description: 'Count your blessings', icon: 'heart', category: 'Wellness' },
        { id: '30', name: 'Nature Time', description: 'Spend time outdoors', icon: 'leaf', category: 'Wellness' },

        // Lifestyle
        { id: '31', name: 'Coffee', description: 'Coffee break', icon: 'cafe', category: 'Lifestyle' },
        { id: '32', name: 'Cook', description: 'Prepare meals', icon: 'restaurant', category: 'Lifestyle' },
        { id: '33', name: 'Clean House', description: 'Household cleaning', icon: 'home', category: 'Lifestyle' },
        { id: '34', name: 'Garden', description: 'Gardening activities', icon: 'flower', category: 'Lifestyle' },
        { id: '35', name: 'Grocery Shopping', description: 'Buy groceries', icon: 'basket', category: 'Lifestyle' },
        { id: '36', name: 'Meal Prep', description: 'Prepare meals in advance', icon: 'nutrition', category: 'Lifestyle' },
        { id: '37', name: 'Laundry', description: 'Wash clothes', icon: 'shirt', category: 'Lifestyle' },

        // Social
        { id: '38', name: 'Video Call Family', description: 'Connect with family', icon: 'videocam', category: 'Social' },
        { id: '39', name: 'Call Friends', description: 'Catch up with friends', icon: 'call', category: 'Social' },
        { id: '40', name: 'Social Activity', description: 'Meet with others', icon: 'people', category: 'Social' },
        { id: '41', name: 'Date Night', description: 'Spend time with partner', icon: 'heart', category: 'Social' },
        { id: '42', name: 'Community Service', description: 'Help others', icon: 'hand-left', category: 'Social' },

        // Spiritual
        { id: '43', name: 'Prayer', description: 'Prayer time', icon: 'rose', category: 'Spiritual' },
        { id: '44', name: 'Bible Study', description: 'Read scripture', icon: 'book', category: 'Spiritual' },
        { id: '45', name: 'Church', description: 'Attend service', icon: 'home', category: 'Spiritual' },
        { id: '46', name: 'Reflection', description: 'Spiritual reflection', icon: 'bulb', category: 'Spiritual' },
        { id: '47', name: 'Devotional', description: 'Daily devotional', icon: 'heart', category: 'Spiritual' },

        // Business
        { id: '48', name: 'Networking', description: 'Build connections', icon: 'people', category: 'Business' },
        { id: '49', name: 'Skill Development', description: 'Learn new skills', icon: 'trending-up', category: 'Business' },
        { id: '50', name: 'Client Calls', description: 'Talk to clients', icon: 'call', category: 'Business' },
        { id: '51', name: 'Business Planning', description: 'Strategic planning', icon: 'analytics', category: 'Business' },
        { id: '52', name: 'Marketing', description: 'Promote business', icon: 'megaphone', category: 'Business' },
    ];

    // Group routines by category
    const routinesByCategory = routineTemplates.reduce((acc, routine) => {
        if (!acc[routine.category]) {
            acc[routine.category] = [];
        }
        acc[routine.category].push(routine);
        return acc;
    }, {} as Record<string, RoutineTemplate[]>);

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    useEffect(() => {
        // Filter routines based on search query
        if (searchQuery.trim() === '') {
            setFilteredRoutines([]);
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

        if (customTitle.length > 20) {
            Alert.alert('Error', 'Title must be 20 characters or less');
            return;
        }

        if (customDescription.length > 35) {
            Alert.alert('Error', 'Description must be 35 characters or less');
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

    const renderCategorySection = (category: string, routines: RoutineTemplate[]) => {
        const isExpanded = expandedCategories.has(category);

        return (
            <View key={category} style={styles.categorySection}>
                <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category)}
                >
                    <View style={styles.categoryHeaderLeft}>
                        <Text style={styles.categoryTitle}>{category}</Text>
                        <Text style={styles.categoryCount}>({routines.length})</Text>
                    </View>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#666"
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.categoryContent}>
                        {routines.map(routine => (
                            <TouchableOpacity
                                key={routine.id}
                                style={styles.routineItemInCategory}
                                onPress={() => handleSelectRoutine(routine)}
                            >
                                <View style={styles.routineIcon}>
                                    <Ionicons name={routine.icon as any} size={20} color="#007AFF" />
                                </View>
                                <View style={styles.routineInfo}>
                                    <Text style={styles.routineName}>{routine.name}</Text>
                                    {routine.description && (
                                        <Text style={styles.routineDescription}>{routine.description}</Text>
                                    )}
                                </View>
                                <Ionicons name="add-circle" size={20} color="#007AFF" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

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

                {/* Routines Content */}
                {searchQuery.trim() !== '' ? (
                    // Show search results
                    <>
                        <Text style={styles.sectionTitle}>
                            Search Results ({filteredRoutines.length})
                        </Text>
                        <FlatList
                            data={filteredRoutines}
                            renderItem={({ item }) => (
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
                            )}
                            keyExtractor={(item) => item.id}
                            style={styles.routinesList}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                ) : (
                    // Show categorized routines
                    <>
                        <Text style={styles.sectionTitle}>Browse by Category</Text>
                        <ScrollView style={styles.categoriesContainer} showsVerticalScrollIndicator={false}>
                            {Object.entries(routinesByCategory).map(([category, routines]) =>
                                renderCategorySection(category, routines)
                            )}
                        </ScrollView>
                    </>
                )}
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
                            <View style={styles.inputLabelContainer}>
                                <Text style={styles.inputLabel}>Title *</Text>
                                <Text style={[styles.characterCount, customTitle.length > 20 && styles.characterCountError]}>
                                    {customTitle.length}/20
                                </Text>
                            </View>
                            <TextInput
                                style={[styles.textInput, customTitle.length > 20 && styles.textInputError]}
                                placeholder="Enter routine name"
                                value={customTitle}
                                onChangeText={setCustomTitle}
                                maxLength={20}
                                autoFocus
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelContainer}>
                                <Text style={styles.inputLabel}>Description (Optional)</Text>
                                <Text style={[styles.characterCount, customDescription.length > 35 && styles.characterCountError]}>
                                    {customDescription.length}/35
                                </Text>
                            </View>
                            <TextInput
                                style={[styles.textInput, styles.textAreaInput, customDescription.length > 35 && styles.textInputError]}
                                placeholder="Enter description"
                                value={customDescription}
                                onChangeText={setCustomDescription}
                                maxLength={35}
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
    categoriesContainer: {
        flex: 1,
    },
    categorySection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
    },
    categoryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    categoryCount: {
        fontSize: 14,
        color: '#666',
        marginLeft: 6,
    },
    categoryContent: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    routineItemInCategory: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginVertical: 2,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
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
        width: 36,
        height: 36,
        borderRadius: 18,
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
    inputLabelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    characterCount: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    characterCountError: {
        color: '#ff6b6b',
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
    textInputError: {
        borderColor: '#ff6b6b',
        backgroundColor: '#fff5f5',
    },
    textAreaInput: {
        height: 100,
        textAlignVertical: 'top',
    },
});

export default AddRoutineScreen;