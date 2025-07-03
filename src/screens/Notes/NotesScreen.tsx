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

// Daily quotes array - includes your quotes plus additional similar ones
const DAILY_QUOTES = [
  // Original quotes from your images (shortened for 3 lines max)
  "Is it Important to you",
  "Always ask questions",
  "Your vision in life is key. Giraffes eat at the top as that's where they see",
  "Love yours",
  "If it takes less than a minute, do it immediately",
  "Early to bed, early to rise, makes a man young wealthy and wise",
  "Action is the foundation, learning is the supplementation",
  "Be a good person. Be kind to others",
  "Never raise your voice",
  "The man who blames others has a long way to go, the man who blames himself is halfway there",
  "Do not make promises you do not intend to keep",
  "Be a good listener, encourage others to talk about themselves",
  "Become genuinely interested in other people",
  "Smile",
  "The great pyramids were older to the Romans than the Romans are to us",
  "When faced with a decision, flip a coin. In the air, you know which choice you're hoping for",
  "Look people in the eyes",
  "If you are distressed by anything external, the pain is not the thing itself, but your estimation of it",
  "As you are now, so once were they, as they are now, so shall you be",
  "Meditate. Find your peace",
  "If I asked people what they want they would've said faster horses",
  "Victory came to those who made the rules and imposed them on the enemy",

  // Additional similar motivational/philosophical quotes (3 lines max)
  "Success is not final, failure is not fatal: it is the courage to continue that counts",
  "The best time to plant a tree was 20 years ago. The second best time is now",
  "You are never too old to set another goal or to dream a new dream",
  "The only way to do great work is to love what you do",
  "It is during our darkest moments that we must focus to see the light",
  "Believe you can and you're halfway there",
  "The future belongs to those who believe in the beauty of their dreams",
  "In the middle of difficulty lies opportunity",
  "Life is what happens while you're busy making other plans",
  "The only impossible journey is the one you never begin",
  "What lies behind us and before us are tiny matters compared to what lies within us",
  "Be yourself; everyone else is already taken",
  "Two things are infinite: the universe and human stupidity",
  "A room without books is like a body without a soul",
  "The only thing we have to fear is fear itself",
  "It takes courage to grow up and become who you really are",
  "Life isn't about finding yourself. Life is about creating yourself",
  "The way to get started is to quit talking and begin doing",
  "Innovation distinguishes between a leader and a follower",
  "Stay hungry, stay foolish",
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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f8f9fa",
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  quoteText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
    fontStyle: "italic",
    maxHeight: 66, // 3 lines max (22 * 3)
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
