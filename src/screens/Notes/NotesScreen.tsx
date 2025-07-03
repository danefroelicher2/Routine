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

  const renderNote = ({ item: note }: { item: Note }) => (
    <TouchableOpacity onPress={() => openNote(note)}>
      <View style={styles.noteItem}>
        <View style={styles.noteContent}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {note.title || "Untitled"}
            </Text>
            <View style={styles.noteActions}>
              <TouchableOpacity
                onPress={() => {
                  /* Handle pin toggle */
                }}
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
            {getPreviewText(note.content || "")}
          </Text>

          <Text style={styles.noteDate}>{formatDate(note.updated_at)}</Text>
        </View>
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

      <FlatList
        data={[...pinnedNotes, ...regularNotes]}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          notes.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        ListHeaderComponent={() =>
          pinnedNotes.length > 0 && regularNotes.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pinned</Text>
            </View>
          ) : null
        }
        stickyHeaderIndices={
          pinnedNotes.length > 0 && regularNotes.length > 0 ? [0] : []
        }
      />

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
    backgroundColor: "#fff",
  },
  // NEW: Quote container styles
  quoteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  quoteBox: {
    backgroundColor: "#f8f9fa",
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 4,
  },
  quoteText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    fontStyle: "italic",
  },
  // END NEW quote styles

  listContainer: {
    paddingVertical: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  noteItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  noteContent: {
    flex: 1,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  noteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 10,
  },
  noteActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  noteIcon: {
    marginLeft: 12,
  },
  notePreview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 12,
    color: "#999",
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 20,
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
