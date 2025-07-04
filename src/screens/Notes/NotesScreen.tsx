import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { Note } from "../../types/database";

// Daily quotes array - shorter quotes that fit well on mobile
const DAILY_QUOTES = [
  "Is it important to you",
  "Always ask questions",
  "Your vision in life is key",
  "Love yours",
  "If it takes less than a minute, do it immediately",
  "Early to bed, early to rise",
  "Action is the foundation, learning is the supplementation",
  "Be a good person. Be kind to others",
  "Never raise your voice",
  "The man who blames no one has already arrived",
  "Do not make promises you do not intend to keep",
  "Be a good listener",
  "Become genuinely interested in other people",
  "Smile",
  "When faced with a decision, flip a coin",
  "Look people in the eyes",
  "Meditate. Find your peace",
  "Stay hungry, stay foolish",
  "The best time to plant a tree was 20 years ago",
  "You are never too old to dream a new dream",
  "The only way to do great work is to love what you do",
  "Believe you can and you're halfway there",
  "In the middle of difficulty lies opportunity",
  "The only impossible journey is the one you never begin",
  "Be yourself; everyone else is already taken",
  "The only thing we have to fear is fear itself",
  "Life is about creating yourself",
  "Innovation distinguishes between a leader and a follower",
  "Success is the courage to continue",
  "What lies within us matters most",
];

interface NotesScreenProps {
  navigation: any;
}

export default function NotesScreen({ navigation }: NotesScreenProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyQuote, setDailyQuote] = useState("");

  // Get daily quote based on current date
  const getDailyQuote = () => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        86400000
    );
    const quoteIndex = dayOfYear % DAILY_QUOTES.length;
    return DAILY_QUOTES[quoteIndex];
  };

  useEffect(() => {
    setDailyQuote(getDailyQuote());
  }, []);

  const fetchNotes = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  };

  const createNewNote = () => {
    navigation.navigate("NoteDetail", {
      isNew: true,
      onSave: fetchNotes,
    });
  };

  const openNote = (note: Note) => {
    navigation.navigate("NoteDetail", {
      note,
      onSave: fetchNotes,
    });
  };

  const togglePinNote = async (note: Note) => {
    try {
      const { error } = await supabase
        .from("notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", note.id);

      if (error) throw error;

      await fetchNotes();
    } catch (error) {
      console.error("Error toggling pin:", error);
      Alert.alert("Error", "Failed to update note");
    }
  };

  const deleteNote = async (note: Note) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("notes")
              .delete()
              .eq("id", note.id);

            if (error) throw error;

            await fetchNotes();
          } catch (error) {
            console.error("Error deleting note:", error);
            Alert.alert("Error", "Failed to delete note");
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPreviewText = (content: string) => {
    return content.replace(/\n/g, " ").trim().substring(0, 100);
  };

  // FIXED: Updated renderNoteCard function with working pin functionality
  const renderNoteCard = (note: Note) => (
    <TouchableOpacity
      onPress={() => openNote(note)}
      style={styles.noteCard}
      activeOpacity={0.7}
    >
      <View style={styles.noteCardHeader}>
        <Text style={styles.noteCardTitle} numberOfLines={1}>
          {note.title || "Untitled"}
        </Text>
        <View style={styles.noteCardActions}>
          <TouchableOpacity
            onPress={() => {
              // FIXED: Actually call the togglePinNote function instead of empty comment
              togglePinNote(note);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={note.is_pinned ? "star" : "star-outline"}
              size={16}
              color={note.is_pinned ? "#ffb347" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.noteCardDate}>
        {formatDate(note.updated_at)} {getPreviewText(note.content || "")}
      </Text>
    </TouchableOpacity>
  );

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
  const pinnedNotes = notes.filter((note) => note.is_pinned);
  const regularNotes = notes.filter((note) => !note.is_pinned);

  return (
    <SafeAreaView style={styles.container}>
      {/* Daily Quote Section - NEW */}
      <View style={styles.quoteContainer}>
        <View style={styles.quoteBox}>
          <Text style={styles.quoteText}>{dailyQuote}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          notes.length === 0 ? styles.emptyContainer : styles.listContainer
        }
      >
        {/* Pinned Section */}
        {pinnedNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pinned</Text>
            <View style={styles.sectionContent}>
              {pinnedNotes.map((note, index) => (
                <View key={note.id}>
                  {renderNoteCard(note)}
                  {index < pinnedNotes.length - 1 && (
                    <View style={styles.noteSeparator} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Section */}
        {regularNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.sectionContent}>
              {regularNotes.map((note, index) => (
                <View key={note.id}>
                  {renderNoteCard(note)}
                  {index < regularNotes.length - 1 && (
                    <View style={styles.noteSeparator} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {notes.length === 0 && renderEmpty()}
      </ScrollView>

      {/* Floating Add Button - MOVED TO BOTTOM RIGHT */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={createNewNote}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  // NEW: Quote container styles
  quoteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#2c2c2e",
  },
  quoteBox: {
    backgroundColor: "#1c1c1e",
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 4,
  },
  quoteText: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 24,
    fontStyle: "italic",
  },
  // END NEW quote styles

  listContainer: {
    paddingVertical: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
    marginLeft: 20,
  },
  sectionContent: {
    backgroundColor: "#2c2c2e",
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#2c2c2e",
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  noteCardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginRight: 12,
  },
  noteCardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  noteCardDate: {
    fontSize: 15,
    color: "#8e8e93",
    lineHeight: 20,
  },
  noteSeparator: {
    height: 1,
    backgroundColor: "#3c3c3e",
    marginLeft: 16,
  },
  sectionHeader: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
  },
  // NEW: Floating add button styles
  floatingAddButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});
