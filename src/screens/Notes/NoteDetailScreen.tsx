import React, { useState, useEffect, useRef } from "react";
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
  Keyboard,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../../services/supabase";
import { Note } from "../../types/database";
import { useTheme } from "../../../ThemeContext"; // ADD THIS IMPORT

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

interface LockModalProps {
  visible: boolean;
  onClose: () => void;
  onLockWithFaceID: () => void;
  onLockWithPassword: () => void;
}

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => void;
}

// FIXED: Simplified Password Setup Modal - Single password input only
const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  onClose,
  onSetPassword,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { colors } = useTheme(); // ADD THEME SUPPORT

  const handleSetPassword = () => {
    if (!password.trim()) {
      Alert.alert("Error", "Please enter a password");
      return;
    }
    if (password.length < 4) {
      Alert.alert("Error", "Password must be at least 4 characters long");
      return;
    }
    onSetPassword(password);
    setPassword("");
    setShowPassword(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.modalHeader,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Set Password
          </Text>
          <TouchableOpacity onPress={handleSetPassword}>
            <Text style={styles.modalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={[styles.passwordLabel, { color: colors.text }]}>
            Create a password to lock this note
          </Text>

          {/* FIXED: Single password input only */}
          <View
            style={[
              styles.passwordInputContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Enter password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Lock Method Selection Modal Component
const LockModal: React.FC<LockModalProps> = ({
  visible,
  onClose,
  onLockWithFaceID,
  onLockWithPassword,
}) => {
  const { colors } = useTheme(); // ADD THEME SUPPORT

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlayContainer}>
        <View
          style={[
            styles.lockModalContainer,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.lockModalTitle, { color: colors.text }]}>
            Lock Note
          </Text>
          <Text
            style={[styles.lockModalSubtitle, { color: colors.textSecondary }]}
          >
            Choose how to lock this note
          </Text>

          <TouchableOpacity
            style={[styles.lockOption, { backgroundColor: colors.card }]}
            onPress={onLockWithFaceID}
          >
            <Ionicons name="finger-print" size={24} color="#007AFF" />
            <Text style={[styles.lockOptionText, { color: colors.text }]}>
              Face ID / Touch ID
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.lockOption, { backgroundColor: colors.card }]}
            onPress={onLockWithPassword}
          >
            <Ionicons name="key" size={24} color="#007AFF" />
            <Text style={[styles.lockOptionText, { color: colors.text }]}>
              Password
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function NoteDetailScreen({
  navigation,
  route,
}: NoteDetailScreenProps) {
  const params = route.params || {};
  const { note, isNew = false, onSave } = params;

  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [isLocked, setIsLocked] = useState(note?.is_locked || false);
  const [isUnlocked, setIsUnlocked] = useState(!note?.is_locked); // FIXED: Track if note is currently unlocked
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ADD THEME SUPPORT
  const { colors } = useTheme();

  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isNew) {
      setTimeout(() => titleInputRef.current?.focus(), 300);
    }
  }, [isNew]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasChanges) {
        saveNote();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, content, hasChanges]);

  const handleContentChange = (text: string) => {
    setContent(text);
    setHasChanges(true);
  };

  const handleScroll = () => {
    Keyboard.dismiss();
  };

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) return;

    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (isNew) {
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: user.id,
            title: title.trim() || "Untitled",
            content: content.trim(),
            is_locked: isLocked,
          })
          .select()
          .single();

        if (error) throw error;

        // Update the route params to mark as not new anymore
        navigation.setParams({ note: data, isNew: false });
      } else if (note) {
        const { error } = await supabase
          .from("notes")
          .update({
            title: title.trim() || "Untitled",
            content: content.trim(),
            is_locked: isLocked,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.id);

        if (error) throw error;
      }

      setHasChanges(false);
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert("Error", "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const lockWithFaceID = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          "Biometric Authentication Not Available",
          "Please set up Face ID or Touch ID in your device settings, or use password protection instead."
        );
        return;
      }

      // Update database
      const { error } = await supabase
        .from("notes")
        .update({ is_locked: true })
        .eq("id", note?.id);

      if (error) throw error;

      setIsLocked(true);
      setIsUnlocked(false);
      setShowLockModal(false);
    } catch (error) {
      console.error("Error setting up Face ID lock:", error);
      Alert.alert("Error", "Failed to set up Face ID protection");
    }
  };

  const lockWithPassword = () => {
    setShowLockModal(false);
    setShowPasswordModal(true);
  };

  const handleSetPassword = async (password: string) => {
    try {
      const noteId = note?.id || `temp_${Date.now()}`;
      await SecureStore.setItemAsync(`note_password_${noteId}`, password);

      // Update database
      const { error } = await supabase
        .from("notes")
        .update({ is_locked: true })
        .eq("id", note?.id);

      if (error) throw error;

      setIsLocked(true);
      setIsUnlocked(false);
      setShowPasswordModal(false);
    } catch (error) {
      console.error("Error setting password:", error);
      Alert.alert("Error", "Failed to set password protection");
    }
  };

  const unlockNote = async () => {
    try {
      if (!note) return;

      // Try password first (if exists)
      try {
        const storedPassword = await SecureStore.getItemAsync(
          `note_password_${note.id}`
        );
        if (storedPassword) {
          // Prompt for password
          Alert.prompt(
            "Enter Password",
            "Enter the password to unlock this note:",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Unlock",
                onPress: (inputPassword) => {
                  if (inputPassword === storedPassword) {
                    setIsUnlocked(true);
                  } else {
                    Alert.alert("Error", "Incorrect password");
                  }
                },
              },
            ],
            "secure-text"
          );
          return;
        }
      } catch (e) {
        // No password set, try biometric
      }

      // Try biometric authentication
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock Note",
          fallbackLabel: "Use Password",
        });

        if (result.success) {
          setIsUnlocked(true);
        }
      } else {
        Alert.alert(
          "Authentication Not Available",
          "No authentication method available for this note"
        );
      }
    } catch (error) {
      console.error("Error unlocking note:", error);
      Alert.alert("Error", "Failed to unlock note");
    }
  };

  const handleLockToggle = async () => {
    if (isLocked) {
      // Unlock the note
      try {
        const { error } = await supabase
          .from("notes")
          .update({ is_locked: false })
          .eq("id", note?.id);

        if (error) throw error;

        setIsLocked(false);
        setIsUnlocked(true);
      } catch (error) {
        console.error("Error unlocking note:", error);
        Alert.alert("Error", "Failed to unlock note");
      }
    } else {
      // Lock the note
      setShowLockModal(true);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (!isNew && note) {
              // Delete stored password if it exists
              try {
                await SecureStore.deleteItemAsync(`note_password_${note.id}`);
              } catch (e) {
                // Password doesn't exist, that's fine
              }

              const { error } = await supabase
                .from("notes")
                .delete()
                .eq("id", note.id);

              if (error) throw error;
            }

            if (onSave) {
              onSave();
            }
            navigation.goBack();
          } catch (error) {
            console.error("Error deleting note:", error);
            Alert.alert("Error", "Failed to delete note");
          }
        },
      },
    ]);
  };

  // FIXED: Show unlock screen when note is locked and not unlocked
  const renderUnlockScreen = () => (
    <View
      style={[styles.unlockContainer, { backgroundColor: colors.background }]}
    >
      <Ionicons name="lock-closed" size={64} color="#007AFF" />
      <Text style={[styles.unlockTitle, { color: colors.text }]}>
        Note is Locked
      </Text>
      <Text style={[styles.unlockSubtitle, { color: colors.textSecondary }]}>
        This note is protected. Unlock to view its contents.
      </Text>

      <TouchableOpacity style={styles.unlockButton} onPress={unlockNote}>
        <Ionicons name="lock-open" size={20} color="#fff" />
        <Text style={styles.unlockButtonText}>Unlock Note</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header - always visible */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text style={styles.backText}>Notes</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleLockToggle}
            >
              <Ionicons
                name={
                  isLocked && !isUnlocked ? "lock-closed" : "lock-open-outline"
                }
                size={20}
                color="#007AFF"
              />
            </TouchableOpacity>

            {/* Only show delete button if note is unlocked */}
            {isUnlocked && (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* FIXED: Conditional rendering - unlock screen OR note content */}
        {isLocked && !isUnlocked ? (
          renderUnlockScreen()
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              style={[styles.content, { backgroundColor: colors.background }]}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={handleScroll}
              onMomentumScrollBegin={handleScroll}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                ref={titleInputRef}
                style={[
                  styles.titleInput,
                  { color: colors.text, borderBottomColor: colors.separator },
                ]}
                placeholder="Title"
                placeholderTextColor={colors.placeholder}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
              />

              <TextInput
                ref={contentInputRef}
                style={[styles.contentInput, { color: colors.text }]}
                placeholder="Start writing..."
                placeholderTextColor={colors.placeholder}
                value={content}
                onChangeText={handleContentChange}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </ScrollView>

            {/* Auto-save indicator */}
            {saving && (
              <View style={styles.savingIndicator}>
                <Text style={styles.savingIndicatorText}>Saving...</Text>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {/* Lock Method Selection Modal */}
      <LockModal
        visible={showLockModal}
        onClose={() => setShowLockModal(false)}
        onLockWithFaceID={lockWithFaceID}
        onLockWithPassword={lockWithPassword}
      />

      {/* Password Setup Modal */}
      <PasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSetPassword={handleSetPassword}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // REMOVED HARDCODED backgroundColor: "#fff", - NOW USES THEME
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    // REMOVED HARDCODED borderBottomColor: "#e9ecef", - NOW USES THEME
    // REMOVED HARDCODED backgroundColor - NOW USES THEME
  },
  headerLeft: {
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 17,
    color: "#007AFF",
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    // REMOVED HARDCODED backgroundColor - NOW USES THEME
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "bold",
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
    paddingVertical: 16,
    borderBottomWidth: 1,
    // REMOVED HARDCODED borderBottomColor: "#f0f0f0", - NOW USES THEME
  },
  contentInput: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
    lineHeight: 24,
    paddingVertical: 16,
    minHeight: 400,
  },
  savingIndicator: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    opacity: 0.9,
  },
  savingIndicatorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  // FIXED: Unlock Screen Styles
  unlockContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    // REMOVED HARDCODED backgroundColor: "#fff", - NOW USES THEME
  },
  unlockTitle: {
    fontSize: 24,
    fontWeight: "bold",
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  unlockSubtitle: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#666", - NOW USES THEME
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  unlockButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  unlockButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  // Lock Modal Styles
  overlayContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockModalContainer: {
    // REMOVED HARDCODED backgroundColor: "#fff", - NOW USES THEME
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: "80%",
    maxWidth: 300,
  },
  lockModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    // REMOVED HARDCODED color - NOW USES THEME
  },
  lockModalSubtitle: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#666", - NOW USES THEME
    textAlign: "center",
    marginBottom: 24,
  },
  lockOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    // REMOVED HARDCODED backgroundColor: "#f8f9fa", - NOW USES THEME
    marginBottom: 12,
  },
  lockOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  // Password Modal Styles
  modalContainer: {
    flex: 1,
    // REMOVED HARDCODED backgroundColor: "#fff", - NOW USES THEME
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    // REMOVED HARDCODED borderBottomColor: "#e9ecef", - NOW USES THEME
    // REMOVED HARDCODED backgroundColor - NOW USES THEME
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    // REMOVED HARDCODED color - NOW USES THEME
  },
  modalCancelText: {
    fontSize: 16,
    color: "#007AFF",
  },
  modalSaveText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalContent: {
    padding: 20,
  },
  passwordLabel: {
    fontSize: 16,
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
    marginBottom: 20,
    textAlign: "center",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    // REMOVED HARDCODED borderColor: "#ddd", - NOW USES THEME
    borderRadius: 12,
    marginBottom: 16,
    // REMOVED HARDCODED backgroundColor: "#f8f9fa", - NOW USES THEME
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    // REMOVED HARDCODED color: "#333", - NOW USES THEME
  },
  eyeButton: {
    padding: 16,
  },
});
