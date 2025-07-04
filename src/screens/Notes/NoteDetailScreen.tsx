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
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Set Password</Text>
          <TouchableOpacity onPress={handleSetPassword}>
            <Text style={styles.modalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.passwordLabel}>
            Create a password to lock this note
          </Text>

          {/* FIXED: Single password input only */}
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter password"
              placeholderTextColor="#999"
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
                color="#666"
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
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlayContainer}>
        <View style={styles.lockModalContainer}>
          <Text style={styles.lockModalTitle}>Lock Note</Text>
          <Text style={styles.lockModalSubtitle}>
            Choose how to lock this note
          </Text>

          <TouchableOpacity
            style={styles.lockOption}
            onPress={onLockWithFaceID}
          >
            <Ionicons name="finger-print" size={24} color="#007AFF" />
            <Text style={styles.lockOptionText}>Face ID / Touch ID</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lockOption}
            onPress={onLockWithPassword}
          >
            <Ionicons name="key" size={24} color="#007AFF" />
            <Text style={styles.lockOptionText}>Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
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

  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle scrolling - disconnect cursor and dismiss keyboard
  const handleScroll = () => {
    Keyboard.dismiss();
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
  };

  const handleContentChange = (text: string) => {
    setContent(text);
  };

  useEffect(() => {
    if (isNew && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isNew]);

  useEffect(() => {
    setHasChanges(
      title !== (note?.title || "") ||
        content !== (note?.content || "") ||
        isLocked !== (note?.is_locked || false)
    );
  }, [title, content, isLocked, note]);

  // Auto-save functionality - only when note is unlocked
  useEffect(() => {
    if (!isUnlocked) return; // Don't auto-save when locked

    const saveTimer = setTimeout(() => {
      if (hasChanges && (title.trim() || content.trim())) {
        handleSave(false); // Silent auto-save
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [title, content, hasChanges, isUnlocked]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!hasChanges) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Don't leave", style: "cancel", onPress: () => {} },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges]);

  // FIXED: Handle lock/unlock toggle from header button
  const handleLockToggle = async () => {
    if (isLocked && !isUnlocked) {
      // Note is locked, try to unlock it
      await unlockNote();
    } else if (isUnlocked) {
      // Note is unlocked, lock it
      setShowLockModal(true);
    }
  };

  // FIXED: Unified unlock function for both unlock button and header button
  const unlockNote = async () => {
    try {
      // First try to get the stored password for this note
      const storedPassword = await SecureStore.getItemAsync(
        `note_password_${note?.id}`
      );

      if (storedPassword) {
        // This note was locked with a password
        Alert.prompt(
          "Enter Password",
          "Enter the password to unlock this note",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Unlock",
              onPress: async (inputPassword) => {
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
      } else {
        // This note was locked with biometric authentication
        console.log("Attempting Face ID unlock...");

        // SIMPLIFIED: Try basic Face ID authentication
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Use Face ID to unlock this note",
        });

        console.log("Face ID Unlock Result:", result);

        if (result.success) {
          setIsUnlocked(true);
        } else {
          Alert.alert(
            "Face ID Authentication Failed",
            "Face ID authentication was not successful. Please try again."
          );
        }
      }
    } catch (error) {
      console.error("Error unlocking note:", error);
      Alert.alert("Error", "Failed to unlock note");
    }
  };

  const lockWithFaceID = async () => {
    try {
      // SIMPLIFIED: Try the most basic Face ID configuration first
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Use Face ID to lock this note",
        // REMOVED: disableDeviceFallback - let's allow fallback for now to test
      });

      console.log("Face ID Result:", result);

      if (result.success) {
        // Remove any existing password for this note
        if (note?.id) {
          try {
            await SecureStore.deleteItemAsync(`note_password_${note.id}`);
          } catch (e) {
            // Password didn't exist, that's fine
          }
        }

        await updateNoteLockStatus(true);
        setIsLocked(true);
        setIsUnlocked(false);
        setShowLockModal(false);
        Alert.alert("Success", "Note locked with Face ID");
      } else {
        // If direct Face ID fails, try a different approach
        Alert.alert(
          "Face ID Setup",
          "Would you like to try an alternative Face ID setup?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Try Alternative",
              onPress: () => tryAlternativeFaceID(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Face ID Error:", error);
      Alert.alert(
        "Face ID Error",
        "There was an error with Face ID authentication. Please try using the password option instead."
      );
    }
  };

  // NEW: Alternative Face ID approach using a different strategy
  const tryAlternativeFaceID = async () => {
    try {
      // Try with minimal options - sometimes less is more
      const result = await LocalAuthentication.authenticateAsync();

      console.log("Alternative Face ID Result:", result);

      if (result.success) {
        if (note?.id) {
          try {
            await SecureStore.deleteItemAsync(`note_password_${note.id}`);
          } catch (e) {
            // Password didn't exist, that's fine
          }
        }

        await updateNoteLockStatus(true);
        setIsLocked(true);
        setIsUnlocked(false);
        setShowLockModal(false);
        Alert.alert("Success", "Note locked with Face ID");
      } else {
        Alert.alert(
          "Face ID Not Working",
          "Face ID authentication is not working properly. Please use the password option instead."
        );
      }
    } catch (error) {
      console.error("Alternative Face ID Error:", error);
      Alert.alert("Error", "Face ID setup failed. Please use password option.");
    }
  };

  const lockWithPassword = () => {
    setShowLockModal(false);
    setShowPasswordModal(true);
  };

  const handleSetPassword = async (password: string) => {
    try {
      if (!note?.id) {
        Alert.alert("Error", "Cannot lock unsaved note");
        return;
      }

      // Store the password securely
      await SecureStore.setItemAsync(`note_password_${note.id}`, password);

      await updateNoteLockStatus(true);
      setIsLocked(true);
      setIsUnlocked(false);
      setShowPasswordModal(false);
      Alert.alert("Success", "Note locked with password");
    } catch (error) {
      console.error("Error setting password:", error);
      Alert.alert("Error", "Failed to set password");
    }
  };

  const updateNoteLockStatus = async (locked: boolean) => {
    if (!note?.id) return;

    try {
      const { error } = await supabase
        .from("notes")
        .update({ is_locked: locked })
        .eq("id", note.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating lock status:", error);
      throw error;
    }
  };

  const handleSave = async (showAlert = true) => {
    if (!title.trim() && !content.trim()) {
      if (showAlert) {
        Alert.alert("Empty Note", "Cannot save an empty note");
      }
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      if (isNew) {
        const { error } = await supabase.from("notes").insert({
          user_id: user.id,
          title: title.trim() || "Untitled",
          content: content.trim(),
          is_pinned: false,
          is_locked: isLocked,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notes")
          .update({
            title: title.trim() || "Untitled",
            content: content.trim(),
            is_locked: isLocked,
          })
          .eq("id", note!.id);

        if (error) throw error;
      }

      setHasChanges(false);

      if (showAlert) {
        Alert.alert("Success", "Note saved successfully");
      }

      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("Error saving note:", error);
      if (showAlert) {
        Alert.alert("Error", "Failed to save note");
      }
    } finally {
      setSaving(false);
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
    <View style={styles.unlockContainer}>
      <Ionicons name="lock-closed" size={64} color="#007AFF" />
      <Text style={styles.unlockTitle}>Note is Locked</Text>
      <Text style={styles.unlockSubtitle}>
        This note is protected. Unlock to view its contents.
      </Text>

      <TouchableOpacity style={styles.unlockButton} onPress={unlockNote}>
        <Ionicons name="lock-open" size={20} color="#fff" />
        <Text style={styles.unlockButtonText}>Unlock Note</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header - always visible */}
        <View style={styles.header}>
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
              style={styles.content}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={handleScroll}
              onMomentumScrollBegin={handleScroll}
              showsVerticalScrollIndicator={false}
            >
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
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
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
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  contentInput: {
    fontSize: 16,
    color: "#333",
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
    backgroundColor: "#fff",
  },
  unlockTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  unlockSubtitle: {
    fontSize: 16,
    color: "#666",
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
    backgroundColor: "#fff",
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
  },
  lockModalSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  lockOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    marginBottom: 12,
  },
  lockOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    color: "#333",
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
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
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
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#f8f9fa",
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: "#333",
  },
  eyeButton: {
    padding: 16,
  },
});
