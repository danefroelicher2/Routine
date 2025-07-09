import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../services/supabase";
import { Note } from "../../types/database";
import { useTheme } from "../../../ThemeContext"; // ADD THIS IMPORT

interface NotesScreenProps {
  navigation: any;
}

export default function NotesScreen({ navigation }: NotesScreenProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyQuote, setDailyQuote] = useState("");

  // ADD THEME SUPPORT
  const { colors } = useTheme();

  // Daily inspirational quotes
  const quotes = [
    "The secret of getting ahead is getting started. — Mark Twain",
    "Your thoughts become your actions, your actions become your habits.",
    "Progress is impossible without change, and those who cannot change their minds cannot change anything. — George Bernard Shaw",
    "Success is the sum of small efforts repeated day in and day out. — Robert Collier",
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
    "Believe you can and you're halfway there. — Theodore Roosevelt",
    "It always seems impossible until it's done. — Nelson Mandela",
    "The future depends on what you do today. — Mahatma Gandhi",
    "Dreams don't work unless you do. — John C. Maxwell",
  ];

  useFocusEffect(
    React.useCallback(() => {
      loadNotes();
      setRandomQuote();
    }, [])
  );

  const setRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setDailyQuote(quotes[randomIndex]);
  };

  const loadNotes = async () => {
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
      console.error("Error loading notes:", error);
      Alert.alert("Error", "Failed to load notes");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotes();
    setRandomQuote();
    setRefreshing(false);
  };

  const createNewNote = () => {
    navigation.navigate("NoteDetail", { isNew: true });
  };

  const openNote = (note: Note) => {
    navigation.navigate("NoteDetail", { note });
  };

  const togglePin = async (noteId: string, currentPinStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("notes")
        .update({ is_pinned: !currentPinStatus })
        .eq("id", noteId);

      if (error) throw error;

      // Reload notes to reflect changes
      await loadNotes();
    } catch (error) {
      console.error("Error toggling pin:", error);
      Alert.alert("Error", "Failed to update note");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 168) {
      // Less than a week
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getPreviewText = (content: string) => {
    if (!content || content.trim() === "") return "";
    const stripped = content.replace(/\n/g, " ").trim();
    return stripped.length > 60 ? stripped.substring(0, 60) + "..." : stripped;
  };

  const renderNoteCard = (note: Note) => (
    <TouchableOpacity
      key={note.id}
      style={[styles.noteCard, { backgroundColor: colors.surface }]} // USE THEME
      onPress={() => openNote(note)}
    >
      <View style={styles.noteCardHeader}>
        <Text
          style={[styles.noteCardTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {note.title || "Untitled"}
        </Text>
        <View style={styles.noteCardActions}>
          {/* Show lock indicator if note is locked */}
          {note.is_locked && (
            <View style={styles.lockIndicator}>
              <Ionicons
                name="lock-closed"
                size={14}
                color={colors.textSecondary}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              togglePin(note.id, note.is_pinned);
            }}
          >
            <Ionicons
              name={note.is_pinned ? "star" : "star-outline"}
              size={16}
              color={note.is_pinned ? "#ffb347" : colors.textSecondary} // USE THEME
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.noteCardDate, { color: colors.textSecondary }]}>
        {formatDate(note.updated_at)}
        {getPreviewText(note.content || "") &&
          ` ${getPreviewText(note.content || "")}`}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="document-text-outline"
        size={64}
        color={colors.textTertiary}
      />
      <Text style={[styles.emptyStateTitle, { color: colors.textSecondary }]}>
        No Notes Yet
      </Text>
      <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>
        Tap the + button to create your first note
      </Text>
    </View>
  );

  // Separate pinned and regular notes
  const pinnedNotes = notes.filter((note) => note.is_pinned);
  const regularNotes = notes.filter((note) => !note.is_pinned);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Daily Quote Section */}
      <View
        style={[
          styles.quoteContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={[styles.quoteBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.quoteText, { color: colors.text }]}>
            {dailyQuote}
          </Text>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pinned
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: colors.surface },
              ]}
            >
              {pinnedNotes.map((note, index) => (
                <View key={note.id}>
                  {renderNoteCard(note)}
                  {index < pinnedNotes.length - 1 && (
                    <View
                      style={[
                        styles.noteSeparator,
                        { backgroundColor: colors.separator },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Section */}
        {regularNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: colors.surface },
              ]}
            >
              {regularNotes.map((note, index) => (
                <View key={note.id}>
                  {renderNoteCard(note)}
                  {index < regularNotes.length - 1 && (
                    <View
                      style={[
                        styles.noteSeparator,
                        { backgroundColor: colors.separator },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {notes.length === 0 && renderEmpty()}
      </ScrollView>

      {/* Floating Add Button */}
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
    // REMOVED HARDCODED backgroundColor: "#000", - NOW USES THEME
  },
  // Quote container styles
  quoteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    // REMOVED HARDCODED backgroundColor: "#000", - NOW USES THEME
    borderBottomWidth: 1,
    // REMOVED HARDCODED borderBottomColor: "#2c2c2e", - NOW USES THEME
  },
  quoteBox: {
    // REMOVED HARDCODED backgroundColor: "#1c1c1e", - NOW USES THEME
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 4,
  },
  quoteText: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#fff", - NOW USES THEME
    lineHeight: 24,
    fontStyle: "italic",
  },
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
    // REMOVED HARDCODED color: "#fff", - NOW USES THEME
    marginBottom: 16,
    marginLeft: 20,
  },
  sectionContent: {
    // REMOVED HARDCODED backgroundColor: "#2c2c2e", - NOW USES THEME
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    // REMOVED HARDCODED backgroundColor: "#2c2c2e", - NOW USES THEME
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
    // REMOVED HARDCODED color: "#fff", - NOW USES THEME
    marginRight: 12,
  },
  noteCardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  // NEW: Lock indicator style
  lockIndicator: {
    marginRight: 8,
    opacity: 0.8,
  },
  noteCardDate: {
    fontSize: 15,
    // REMOVED HARDCODED color: "#8e8e93", - NOW USES THEME
    lineHeight: 20,
  },
  noteSeparator: {
    height: 1,
    // REMOVED HARDCODED backgroundColor: "#3c3c3e", - NOW USES THEME
    marginLeft: 16,
  },
  sectionHeader: {
    // REMOVED HARDCODED backgroundColor: "#f8f9fa", - NOW USES THEME
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    // REMOVED HARDCODED borderBottomColor: "#e9ecef", - NOW USES THEME
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    // REMOVED HARDCODED color: "#666", - NOW USES THEME
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#999", - NOW USES THEME
    textAlign: "center",
    lineHeight: 22,
  },
  // Floating add button styles
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
