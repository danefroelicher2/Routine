import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ScrollView,
    TextInput,
    Modal,
    FlatList,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { UserRoutine, RoutineTemplate } from '../../types/database';

interface RoutineManagerScreenProps {
    navigation: any;
}

interface RoutineFormData {
    name: string;
    description: string;
    icon: string;
    is_daily: boolean;
    is_weekly: boolean;
    target_value: string;
    target_unit: string;
}

export default function RoutineManagerScreen({ navigation }: RoutineManagerScreenProps) {
    const [userRoutines, setUserRoutines] = useState<UserRoutine[]>([]);
    const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<UserRoutine | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState<RoutineFormData>({
        name: '',
        description: '',
        icon: 'checkmark-circle',
        is_daily: true,
        is_weekly: false,
        target_value: '',
        target_unit: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await Promise.all([loadUserRoutines(), loadRoutineTemplates()]);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load routines');
        } finally {
            setLoading(false);
        }
    };

    const loadUserRoutines = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('user_routines')
            .select('*')
            .eq('user_id', user.id)
            .order('sort_order');

        if (error) throw error;
        setUserRoutines(data || []);
    };

    const loadRoutineTemplates = async () => {
        const { data, error } = await supabase
            .from('routine_templates')
            .select('*')
            .order('name');

        if (error) throw error;
        setRoutineTemplates(data || []);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            icon: 'checkmark-circle',
            is_daily: true,
            is_weekly: false,
            target_value: '',
            target_unit: '',
        });
        setEditingRoutine(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const openEditModal = (routine: UserRoutine) => {
        setFormData({
            name: routine.name,
            description: routine.description || '',
            icon: routine.icon || 'checkmark-circle',
            is_daily: routine.is_daily || false,
            is_weekly: routine.is_weekly || false,
            target_value: routine.target_value?.toString() || '',
            target_unit: routine.target_unit || '',
        });
        setEditingRoutine(routine);
        setShowAddModal(true);
    };

    const handleSaveRoutine = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'Please enter a routine name');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const routineData = {
                user_id: user.id,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                icon: formData.icon,
                is_daily: formData.is_daily,
                is_weekly: formData.is_weekly,
                target_value: formData.target_value ? parseInt(formData.target_value) : null,
                target_unit: formData.target_unit.trim() || null,
                sort_order: userRoutines.length,
                is_active: true,
            };

            if (editingRoutine) {
                const { error } = await supabase
                    .from('user_routines')
                    .update(routineData)
                    .eq('id', editingRoutine.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('user_routines')
                    .insert(routineData);
                if (error) throw error;
            }

            await loadUserRoutines();
            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error saving routine:', error);
            Alert.alert('Error', 'Failed to save routine');
        }
    };

    const handleDeleteRoutine = (routine: UserRoutine) => {
        Alert.alert(
            'Delete Routine',
            `Are you sure you want to delete "${routine.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('user_routines')
                                .delete()
                                .eq('id', routine.id);

                            if (error) throw error;
                            await loadUserRoutines();
                        } catch (error) {
                            console.error('Error deleting routine:', error);
                            Alert.alert('Error', 'Failed to delete routine');
                        }
                    },
                },
            ]
        );
    };

    const addFromTemplate = async (template: RoutineTemplate) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const routineData = {
                user_id: user.id,
                name: template.name,
                description: template.description,
                icon: template.icon,
                is_daily: true,
                is_weekly: false,
                target_value: null,
                target_unit: null,
                sort_order: userRoutines.length,
                is_active: true,
            };

            const { error } = await supabase
                .from('user_routines')
                .insert(routineData);

            if (error) throw error;

            await loadUserRoutines();
            setShowTemplatesModal(false);
            Alert.alert('Success', `Added "${template.name}" to your routines!`);
        } catch (error) {
            console.error('Error adding template:', error);
            Alert.alert('Error', 'Failed to add routine from template');
        }
    };

    const filteredTemplates = routineTemplates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const iconOptions = [
        'checkmark-circle', 'fitness', 'walk', 'bicycle', 'nutrition',
        'water-drop', 'bed', 'book', 'code-slash', 'school',
        'journal', 'heart', 'leaf', 'star', 'flame'
    ];

    const renderRoutineItem = ({ item: routine }: { item: UserRoutine }) => (
        <View style={styles.routineItem}>
            <View style={styles.routineContent}>
                <View style={styles.routineLeft}>
                    <Ionicons name={routine.icon as any || 'checkmark-circle'} size={24} color="#007AFF" />
                    <View style={styles.routineInfo}>
                        <Text style={styles.routineName}>{routine.name}</Text>
                        {routine.description && (
                            <Text style={styles.routineDescription}>{routine.description}</Text>
                        )}
                        <View style={styles.routineMeta}>
                            <Text style={styles.routineType}>
                                {routine.is_daily && 'Daily'} {routine.is_weekly && 'Weekly'}
                            </Text>
                            {routine.target_value && routine.target_unit && (
                                <Text style={styles.routineTarget}>
                                    Target: {routine.target_value} {routine.target_unit}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
                <View style={styles.routineActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openEditModal(routine)}
                    >
                        <Ionicons name="pencil" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteRoutine(routine)}
                    >
                        <Ionicons name="trash" size={18} color="#ff6b6b" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderTemplateItem = ({ item: template }: { item: RoutineTemplate }) => (
        <TouchableOpacity
            style={styles.templateItem}
            onPress={() => addFromTemplate(template)}
        >
            <View style={styles.templateContent}>
                <Ionicons name={template.icon as any || 'checkmark-circle'} size={24} color="#007AFF" />
                <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    {template.description && (
                        <Text style={styles.templateDescription}>{template.description}</Text>
                    )}
                    <Text style={styles.templateCategory}>{template.category}</Text>
                </View>
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
                <Text style={styles.headerTitle}>Manage Routines</Text>
                <TouchableOpacity onPress={openAddModal}>
                    <Ionicons name="add" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView}>
                {/* Quick Add from Templates */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Quick Add</Text>
                        <TouchableOpacity
                            style={styles.browseButton}
                            onPress={() => setShowTemplatesModal(true)}
                        >
                            <Text style={styles.browseButtonText}>Browse Templates</Text>
                            <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* User Routines */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Routines</Text>
                    {userRoutines.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="list-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyStateText}>No routines yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Tap the + button or browse templates to get started
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={userRoutines}
                            renderItem={renderRoutineItem}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                        />
                    )}
                </View>
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowAddModal(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {editingRoutine ? 'Edit Routine' : 'Add Routine'}
                        </Text>
                        <TouchableOpacity onPress={handleSaveRoutine}>
                            <Text style={styles.saveButton}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Name</Text>
                            <TextInput
                                style={styles.formInput}
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                                placeholder="Enter routine name"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Description</Text>
                            <TextInput
                                style={styles.formInput}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                                placeholder="Optional description"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Icon</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.iconSelector}>
                                    {iconOptions.map(icon => (
                                        <TouchableOpacity
                                            key={icon}
                                            style={[
                                                styles.iconOption,
                                                formData.icon === icon && styles.iconOptionSelected
                                            ]}
                                            onPress={() => setFormData({ ...formData, icon })}
                                        >
                                            <Ionicons name={icon as any} size={24} color="#007AFF" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Type</Text>
                            <View style={styles.switchRow}>
                                <Text>Daily</Text>
                                <Switch
                                    value={formData.is_daily}
                                    onValueChange={(value) => setFormData({ ...formData, is_daily: value })}
                                />
                            </View>
                            <View style={styles.switchRow}>
                                <Text>Weekly</Text>
                                <Switch
                                    value={formData.is_weekly}
                                    onValueChange={(value) => setFormData({ ...formData, is_weekly: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Target (Optional)</Text>
                            <View style={styles.targetRow}>
                                <TextInput
                                    style={[styles.formInput, styles.targetInput]}
                                    value={formData.target_value}
                                    onChangeText={(text) => setFormData({ ...formData, target_value: text })}
                                    placeholder="0"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={[styles.formInput, styles.targetInput]}
                                    value={formData.target_unit}
                                    onChangeText={(text) => setFormData({ ...formData, target_unit: text })}
                                    placeholder="steps, minutes, etc."
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Templates Modal */}
            <Modal
                visible={showTemplatesModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowTemplatesModal(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Routine Templates</Text>
                        <View style={{ width: 60 }} />
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#666" />
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search templates..."
                            placeholderTextColor="#999"
                        />
                    </View>

                    <FlatList
                        data={filteredTemplates}
                        renderItem={renderTemplateItem}
                        keyExtractor={(item) => item.id}
                        style={styles.templatesList}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    browseButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    browseButtonText: {
        fontSize: 16,
        color: '#007AFF',
        marginRight: 4,
    },
    routineItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    routineContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    routineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    routineInfo: {
        flex: 1,
        marginLeft: 12,
    },
    routineName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    routineDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    routineMeta: {
        flexDirection: 'row',
        marginTop: 4,
    },
    routineType: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
        marginRight: 12,
    },
    routineTarget: {
        fontSize: 12,
        color: '#666',
    },
    routineActions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#666',
        marginTop: 12,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginTop: 8,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    cancelButton: {
        fontSize: 16,
        color: '#666',
    },
    saveButton: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    formGroup: {
        marginVertical: 15,
    },
    formLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: '#f8f9fa',
    },
    iconSelector: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    iconOption: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
    },
    iconOptionSelected: {
        backgroundColor: '#e3f2fd',
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    targetRow: {
        flexDirection: 'row',
        gap: 12,
    },
    targetInput: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    templatesList: {
        flex: 1,
    },
    templateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    templateContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    templateInfo: {
        flex: 1,
        marginLeft: 12,
    },
    templateName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    templateDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    templateCategory: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 4,
        textTransform: 'capitalize',
    },
});