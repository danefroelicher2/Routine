import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "../../services/supabase";
import { Profile, UserSettings } from "../../types/database";
import { useTheme } from "../../../ThemeContext";
import { usePremium } from "../../contexts/PremiumContext";

const { width } = Dimensions.get("window");

interface ProfileScreenProps {
  navigation: any;
}

interface Achievement {
  id: string;
  name: string;
  target: number;
  unlocked: boolean;
  unlockedDate?: string;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [avatarData, setAvatarData] = useState<string | null>(null);

  // ✅ NEW: Help form state
  const [helpForm, setHelpForm] = useState({
    name: '',
    email: '',
    message: ''
  });

  const { colors } = useTheme();
  const { isPremium } = usePremium();

  const ACHIEVEMENT_TARGETS = [
    3, 5, 7, 14, 30, 60, 100, 150, 200, 250, 300, 365,
  ];

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      requestPermissions();
    }, [])
  );

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || mediaStatus !== "granted") {
      console.log("Camera or media library permissions not granted");
    }
  };

  // FIXED: Enhanced avatar loading function with empty file handling
  const loadAvatarAsBase64 = async (
    avatarFileName: string
  ): Promise<string | null> => {
    try {
      console.log("🔄 Loading avatar as base64:", avatarFileName);

      // Check if it's already a full URL (current format) or just a filename (old format)
      if (avatarFileName.startsWith("http")) {
        // Current format - try to fetch from URL first
        console.log("🔗 URL format detected, trying direct fetch");
        try {
          const response = await fetch(avatarFileName);
          if (response.ok) {
            const blob = await response.blob();
            console.log(
              "📦 Blob details - type:",
              blob.type,
              "size:",
              blob.size
            );

            // VALIDATION: Check if blob is actually an image and has data
            if (!blob.type.startsWith("image/")) {
              console.error("❌ Fetched data is not an image:", blob.type);
              throw new Error("Invalid image type");
            }

            if (blob.size === 0) {
              console.error("❌ Blob is empty - file may be corrupted");
              throw new Error("Empty blob - corrupted file");
            }

            // Use more robust FileReader with detailed logging
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();

              reader.onloadstart = () => {
                console.log("📖 FileReader started reading...");
              };

              reader.onprogress = (event) => {
                if (event.lengthComputable) {
                  console.log(
                    `📊 Reading progress: ${event.loaded}/${event.total}`
                  );
                }
              };

              reader.onloadend = () => {
                console.log("📖 FileReader finished reading");
                const result = reader.result;

                // Detailed validation and logging
                if (!result) {
                  console.error("❌ FileReader result is null/undefined");
                  reject(new Error("FileReader returned null result"));
                  return;
                }

                const base64data = result as string;
                console.log(
                  "🔍 Base64 result preview:",
                  base64data.substring(0, 100) + "..."
                );
                console.log("📏 Base64 length:", base64data.length);

                // Enhanced validation
                if (!base64data.startsWith("data:image/")) {
                  console.error("❌ Missing data:image/ prefix");
                  reject(new Error("Invalid base64 prefix"));
                  return;
                }

                if (!base64data.includes("base64,")) {
                  console.error("❌ Missing base64, marker");
                  reject(new Error("Missing base64 marker"));
                  return;
                }

                // Check actual base64 content length
                const base64Content = base64data.split("base64,")[1];
                if (!base64Content || base64Content.length < 100) {
                  console.error(
                    "❌ Base64 content too short:",
                    base64Content?.length || 0
                  );
                  reject(new Error("Base64 content too short"));
                  return;
                }

                console.log(
                  "✅ Avatar loaded from URL and converted to base64"
                );
                resolve(base64data);
              };

              reader.onerror = (error) => {
                console.error("❌ FileReader error:", error);
                reject(new Error("FileReader failed"));
              };

              reader.onabort = () => {
                console.error("❌ FileReader aborted");
                reject(new Error("FileReader aborted"));
              };

              console.log("🔄 Starting FileReader.readAsDataURL...");
              reader.readAsDataURL(blob);
            });
          } else {
            console.log(
              `❌ HTTP ${response.status} - trying to extract filename from URL`
            );
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (urlError) {
          console.log("❌ Failed to load from URL:", urlError);

          // Try to extract filename from URL and download from storage
          try {
            const url = new URL(avatarFileName);
            const pathParts = url.pathname.split("/");

            // Extract the actual filename from the URL path
            // For URLs like: /storage/v1/object/public/avatars/user-id/avatar.jpg
            // We want to get: user-id/avatar.jpg
            let fileName = "";
            const avatarsIndex = pathParts.indexOf("avatars");
            if (avatarsIndex !== -1 && avatarsIndex < pathParts.length - 1) {
              // Get everything after "avatars/" in the path
              fileName = pathParts.slice(avatarsIndex + 1).join("/");
            } else {
              // Fallback: just use the last two parts (user-id/avatar.jpg)
              fileName = pathParts.slice(-2).join("/");
            }

            console.log(
              `🔄 Extracted filename: ${fileName}, trying storage download`
            );

            if (fileName && fileName.includes("/")) {
              const { data, error } = await supabase.storage
                .from("avatars")
                .download(fileName);

              if (!error && data) {
                console.log("✅ Avatar downloaded from storage successfully");
                console.log(
                  "📦 Storage blob details - type:",
                  data.type,
                  "size:",
                  data.size
                );

                // VALIDATION: Check if the downloaded data is an image and has content
                if (!data.type.startsWith("image/")) {
                  console.error(
                    "❌ Downloaded data is not an image:",
                    data.type
                  );
                  throw new Error("Invalid image type from storage");
                }

                if (data.size === 0) {
                  console.error(
                    "❌ Downloaded blob is empty - file corrupted in storage"
                  );
                  console.log(
                    "💡 SOLUTION: Please upload a new profile picture to replace the corrupted file"
                  );
                  throw new Error("Empty blob from storage - file corrupted");
                }

                return new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();

                  reader.onloadstart = () => {
                    console.log("📖 Storage FileReader started reading...");
                  };

                  reader.onprogress = (event) => {
                    if (event.lengthComputable) {
                      console.log(
                        `📊 Storage reading progress: ${event.loaded}/${event.total}`
                      );
                    }
                  };

                  reader.onloadend = () => {
                    console.log("📖 Storage FileReader finished reading");
                    const result = reader.result;

                    if (!result) {
                      console.error(
                        "❌ Storage FileReader result is null/undefined"
                      );
                      reject(new Error("FileReader returned null result"));
                      return;
                    }

                    const base64data = result as string;
                    console.log(
                      "🔍 Storage Base64 result preview:",
                      base64data.substring(0, 100) + "..."
                    );
                    console.log("📏 Storage Base64 length:", base64data.length);

                    // Enhanced validation
                    if (!base64data.startsWith("data:image/")) {
                      console.error("❌ Storage: Missing data:image/ prefix");
                      reject(new Error("Invalid base64 prefix from storage"));
                      return;
                    }

                    if (!base64data.includes("base64,")) {
                      console.error("❌ Storage: Missing base64, marker");
                      reject(new Error("Missing base64 marker from storage"));
                      return;
                    }

                    // Check actual base64 content length
                    const base64Content = base64data.split("base64,")[1];
                    if (!base64Content || base64Content.length < 100) {
                      console.error(
                        "❌ Storage: Base64 content too short:",
                        base64Content?.length || 0
                      );
                      reject(
                        new Error("Base64 content too short from storage")
                      );
                      return;
                    }

                    console.log("✅ Avatar converted to base64 from storage");
                    resolve(base64data);
                  };

                  reader.onerror = (error) => {
                    console.error("❌ Storage FileReader error:", error);
                    reject(new Error("Storage FileReader failed"));
                  };

                  reader.onabort = () => {
                    console.error("❌ Storage FileReader aborted");
                    reject(new Error("Storage FileReader aborted"));
                  };

                  console.log(
                    "🔄 Starting storage FileReader.readAsDataURL..."
                  );
                  reader.readAsDataURL(data);
                });
              } else {
                console.log("❌ Storage download failed:", error);
                throw new Error(`Storage download failed: ${error?.message}`);
              }
            } else {
              console.log("❌ Could not extract valid filename from URL");
              throw new Error("Invalid filename extracted from URL");
            }
          } catch (extractError) {
            console.log(
              "❌ Could not extract filename from URL:",
              extractError
            );
            throw urlError;
          }
        }
      } else {
        // Filename format - download from Supabase storage
        console.log("📁 Filename format detected, using storage download");
        const { data, error } = await supabase.storage
          .from("avatars")
          .download(avatarFileName);

        if (error) {
          console.error("❌ Storage download error:", error);
          throw error;
        }

        if (data) {
          console.log("✅ Avatar downloaded from storage successfully");
          console.log(
            "📦 Storage blob details - type:",
            data.type,
            "size:",
            data.size
          );

          // VALIDATION: Check if the downloaded data is an image and has content
          if (!data.type.startsWith("image/")) {
            console.error("❌ Downloaded data is not an image:", data.type);
            throw new Error("Invalid image type from storage");
          }

          if (data.size === 0) {
            console.error(
              "❌ Downloaded blob is empty - file corrupted in storage"
            );
            console.log(
              "💡 SOLUTION: Please upload a new profile picture to replace the corrupted file"
            );
            throw new Error("Empty blob from storage - file corrupted");
          }

          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onloadstart = () => {
              console.log("📖 Storage FileReader started reading...");
            };

            reader.onprogress = (event) => {
              if (event.lengthComputable) {
                console.log(
                  `📊 Storage reading progress: ${event.loaded}/${event.total}`
                );
              }
            };

            reader.onloadend = () => {
              console.log("📖 Storage FileReader finished reading");
              const result = reader.result;

              if (!result) {
                console.error("❌ Storage FileReader result is null/undefined");
                reject(new Error("FileReader returned null result"));
                return;
              }

              const base64data = result as string;
              console.log(
                "🔍 Storage Base64 result preview:",
                base64data.substring(0, 100) + "..."
              );
              console.log("📏 Storage Base64 length:", base64data.length);

              // Enhanced validation
              if (!base64data.startsWith("data:image/")) {
                console.error("❌ Storage: Missing data:image/ prefix");
                reject(new Error("Invalid base64 prefix from storage"));
                return;
              }

              if (!base64data.includes("base64,")) {
                console.error("❌ Storage: Missing base64, marker");
                reject(new Error("Missing base64 marker from storage"));
                return;
              }

              // Check actual base64 content length
              const base64Content = base64data.split("base64,")[1];
              if (!base64Content || base64Content.length < 100) {
                console.error(
                  "❌ Storage: Base64 content too short:",
                  base64Content?.length || 0
                );
                reject(new Error("Base64 content too short from storage"));
                return;
              }

              console.log("✅ Avatar converted to base64 from storage");
              resolve(base64data);
            };

            reader.onerror = (error) => {
              console.error("❌ Storage FileReader error:", error);
              reject(new Error("Storage FileReader failed"));
            };

            reader.onabort = () => {
              console.error("❌ Storage FileReader aborted");
              reject(new Error("Storage FileReader aborted"));
            };

            console.log("🔄 Starting storage FileReader.readAsDataURL...");
            reader.readAsDataURL(data);
          });
        }
      }

      return null;
    } catch (error) {
      console.log("❌ Avatar loading failed:", error);

      // Special handling for corrupted files
      if (
        error.message?.includes("Empty blob") ||
        error.message?.includes("corrupted")
      ) {
        console.log("🔧 CORRUPTED FILE DETECTED:");
        console.log("   - The avatar file exists but is empty/corrupted");
        console.log("   - Upload a new profile picture to fix this");

        // Clear the corrupted avatar_url from the profile
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("profiles")
              .update({ avatar_url: null })
              .eq("id", user.id);
            console.log("🧹 Cleared corrupted avatar_url from profile");
          }
        } catch (clearError) {
          console.log("❌ Could not clear corrupted avatar_url:", clearError);
        }
      }

      throw error; // Re-throw to let caller handle
    }
  };

  // FIXED: Profile data loading with avatar persistence protection
  const loadProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      setProfile(profileData);
      setSettings(settingsData);

      // CRITICAL FIX: Only load avatar if we don't already have one displayed
      // This prevents overriding the avatar after a successful upload
      if (profileData?.avatar_url && !avatarData) {
        console.log(
          "🔄 Found avatar_url and no current avatar, loading:",
          profileData.avatar_url
        );
        try {
          const base64Avatar = await loadAvatarAsBase64(profileData.avatar_url);
          if (base64Avatar) {
            setAvatarData(base64Avatar);
            console.log("✅ Avatar loaded successfully on profile load");
          } else {
            console.log("⚠️ Avatar URL exists but failed to load image data");
          }
        } catch (avatarError) {
          console.error("❌ Avatar loading error:", avatarError);
          // Don't set to null if we have existing avatar data
          if (!avatarData) {
            setAvatarData(null);
          }
        }
      } else if (avatarData) {
        console.log(
          "ℹ️ Avatar already displayed, skipping reload to prevent override"
        );
      } else {
        console.log("ℹ️ No avatar_url found");
        setAvatarData(null);
      }

      await calculateAchievements(user.id);
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAchievements = async (userId: string) => {
    try {
      const { data: completions, error } = await supabase
        .from("routine_completions")
        .select("completion_date")
        .eq("user_id", userId)
        .order("completion_date");

      if (error) throw error;

      if (!completions || completions.length === 0) {
        const emptyAchievements = ACHIEVEMENT_TARGETS.map((target, index) => ({
          id: `achievement-${index}`,
          name: `${target} Day${target === 1 ? "" : "s"}`,
          target,
          unlocked: false,
        }));
        setAchievements(emptyAchievements);
        return;
      }

      const completionDates = completions.map((c) => c.completion_date);
      const streaks = calculateStreaks(completionDates);
      const maxStreak = Math.max(...streaks.map((s) => s.length));

      const achievementList = ACHIEVEMENT_TARGETS.map((target, index) => {
        const isUnlocked = maxStreak >= target;
        let unlockedDate: string | undefined;

        if (isUnlocked) {
          const qualifyingStreak = streaks.find((s) => s.length >= target);
          if (qualifyingStreak) {
            const streakEndIndex = completionDates.indexOf(
              qualifyingStreak.endDate
            );
            const targetDateIndex = Math.max(0, streakEndIndex - target + 1);
            unlockedDate = completionDates[targetDateIndex + target - 1];
          }
        }

        return {
          id: `achievement-${index}`,
          name: `${target} Day${target === 1 ? "" : "s"}`,
          target,
          unlocked: isUnlocked,
          unlockedDate,
        };
      });

      setAchievements(achievementList);
    } catch (error) {
      console.error("Error calculating achievements:", error);
    }
  };

  const calculateStreaks = (completionDates: string[]) => {
    if (completionDates.length === 0) return [];

    const sortedDates = [...new Set(completionDates)].sort();
    const streaks: Array<{
      length: number;
      startDate: string;
      endDate: string;
    }> = [];
    let currentStreak = {
      length: 1,
      startDate: sortedDates[0],
      endDate: sortedDates[0],
    };

    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const prevDate = new Date(sortedDates[i - 1]);
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak.length++;
        currentStreak.endDate = sortedDates[i];
      } else {
        streaks.push({ ...currentStreak });
        currentStreak = {
          length: 1,
          startDate: sortedDates[i],
          endDate: sortedDates[i],
        };
      }
    }

    streaks.push(currentStreak);
    return streaks;
  };

  const handleProfilePicturePress = () => {
    setShowImagePicker(true);
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      let result;

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setShowImagePicker(false);
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  // FINAL FIX: React Native compatible upload using FormData
  const uploadProfilePicture = async (imageUri: string) => {
    const previousAvatarData = avatarData;

    try {
      setUploadingImage(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      console.log("🚀 REACT NATIVE UPLOAD: Starting RN-compatible upload");
      console.log("📱 Image URI:", imageUri);

      // Step 1: Read file as base64 for immediate display
      console.log("🔄 Reading file as base64 for display...");
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length < 100) {
        throw new Error("Failed to read image file as base64");
      }

      console.log("✅ Base64 read successfully - length:", base64.length);

      // Create data URI for display
      const base64DataUri = `data:image/jpeg;base64,${base64}`;
      setAvatarData(base64DataUri);
      console.log("✅ Avatar displayed instantly from base64");

      // Step 2: Create FormData for upload (React Native compatible)
      console.log("📤 Creating FormData for React Native upload...");

      const fileName = `${user.id}/avatar.jpg`;
      const formData = new FormData();

      // Use the imageUri directly - React Native handles this properly
      formData.append("file", {
        uri: imageUri,
        type: "image/jpeg",
        name: "avatar.jpg",
      } as any);

      console.log("📦 FormData created for file:", fileName);

      // Step 3: Upload using Supabase REST API with fetch
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
      }

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No auth session");
      }

      // Remove existing file first
      try {
        const { error: removeError } = await supabase.storage
          .from("avatars")
          .remove([fileName]);
        if (!removeError) {
          console.log("🗑️ Removed existing avatar");
        }
      } catch (removeError) {
        console.log("ℹ️ No existing file to remove");
      }

      // Upload using fetch with FormData
      console.log("📡 Uploading via fetch with FormData...");
      const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-upsert": "true",
        },
        body: formData,
      });

      console.log("📊 Upload response status:", uploadResponse.status);
      console.log("📊 Upload response headers:", uploadResponse.headers);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("❌ Upload failed:", errorText);
        throw new Error(
          `Upload failed: ${uploadResponse.status} - ${errorText}`
        );
      }

      const uploadResult = await uploadResponse.json();
      console.log("✅ Upload successful:", uploadResult);

      // Step 4: Verify upload immediately
      console.log("🔍 Verifying upload...");
      const { data: verifyData, error: verifyError } = await supabase.storage
        .from("avatars")
        .download(fileName);

      if (verifyError) {
        console.error("❌ Verification failed:", verifyError);
        throw new Error(`Upload verification failed: ${verifyError.message}`);
      }

      console.log("📊 Verification result:");
      console.log("   - Downloaded size:", verifyData?.size || 0);
      console.log("   - Downloaded type:", verifyData?.type || "unknown");

      if (!verifyData || verifyData.size === 0) {
        throw new Error(
          "Upload verification failed - downloaded file is empty"
        );
      }

      console.log("✅ Upload verified successfully!");

      // Step 5: Get public URL and update database
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      console.log("🔗 Public URL:", urlData.publicUrl);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("❌ Database update failed:", updateError);
        throw updateError;
      }

      console.log("✅ Database updated successfully");

      // Step 6: Update local state
      setProfile((prev) =>
        prev
          ? {
            ...prev,
            avatar_url: urlData.publicUrl,
            updated_at: new Date().toISOString(),
          }
          : null
      );

      console.log("🎉 UPLOAD COMPLETE: Profile picture updated successfully!");
      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("💥 UPLOAD FAILED:", error);

      // Restore previous avatar
      if (previousAvatarData) {
        console.log("🔄 Restoring previous avatar");
        setAvatarData(previousAvatarData);
      } else {
        setAvatarData(null);
      }

      Alert.alert(
        "Upload Failed",
        `Failed to upload profile picture: ${error.message}\n\nPlease try again.`
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // FIXED: Enhanced renderAvatar function with debugging and fallback mechanism
  const renderAvatar = () => {
    if (uploadingImage) {
      return (
        <View
          style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}
        >
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      );
    }

    // VALIDATION: Check if avatarData is valid base64 before rendering
    if (avatarData) {
      console.log(
        "🖼️ Attempting to render avatar, preview:",
        avatarData.substring(0, 50) + "..."
      );

      // Validate base64 format
      const isValidBase64 =
        avatarData.startsWith("data:image/") && avatarData.includes("base64,");

      if (!isValidBase64) {
        console.error(
          "❌ Invalid base64 format detected for rendering:",
          avatarData.substring(0, 50)
        );
        // Don't clear the state, just show placeholder
        return (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.border },
            ]}
          >
            <Ionicons name="person" size={40} color={colors.textSecondary} />
            <Text
              style={{
                fontSize: 10,
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Invalid Format
            </Text>
          </View>
        );
      }

      // Additional validation - check base64 content length
      const base64Content = avatarData.split("base64,")[1];
      if (!base64Content || base64Content.length < 100) {
        console.error(
          "❌ Base64 content too short for rendering:",
          base64Content?.length || 0
        );
        return (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.border },
            ]}
          >
            <Ionicons name="person" size={40} color={colors.textSecondary} />
            <Text
              style={{
                fontSize: 10,
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Corrupted Data
            </Text>
          </View>
        );
      }

      console.log("✅ Base64 validation passed, rendering Image component");

      return (
        <Image
          source={{ uri: avatarData }}
          style={styles.avatarImage}
          onLoadStart={() => {
            console.log("🔄 Image component started loading...");
          }}
          onLoad={(event) => {
            const { width, height } = event.nativeEvent.source;
            console.log(
              `✅ Avatar loaded successfully! Dimensions: ${width}x${height}`
            );
          }}
          onError={(error) => {
            console.error("❌ Avatar image load error details:");
            console.error("   - Error object:", error.nativeEvent);
            console.error("   - Avatar data length:", avatarData?.length || 0);
            console.error(
              "   - Avatar preview:",
              avatarData?.substring(0, 100) || "No data"
            );

            // CRITICAL: Don't clear avatarData on error - this preserves the avatar
            // Instead, we could implement a retry mechanism or show an error indicator

            // Optional: You could show an error overlay instead of clearing the avatar
            console.log("🔄 Keeping avatar data for potential retry");
          }}
          onLoadEnd={() => {
            console.log("🏁 Image component finished loading process");
          }}
          // Enhanced props for better error handling
          resizeMode="cover"
          defaultSource={undefined}
          // Add a key to force re-render if avatarData changes
          key={avatarData.substring(0, 50)}
        />
      );
    }

    console.log("📭 No avatar data, showing placeholder");
    return (
      <View
        style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}
      >
        <Ionicons name="person" size={40} color={colors.textSecondary} />
      </View>
    );
  };

  // FIXED: Refresh function that preserves avatar state
  const onRefresh = async () => {
    setRefreshing(true);

    // Store current avatar to prevent it from being cleared
    const currentAvatar = avatarData;

    await loadProfileData();

    // If we had an avatar before refresh and it got cleared, restore it
    if (currentAvatar && !avatarData) {
      console.log("🔄 Restoring avatar after refresh");
      setAvatarData(currentAvatar);
    }

    setRefreshing(false);
  };

  const showHelpSupport = () => {
    setShowHelpModal(true);
  };

  // ✅ NEW: Handle help form submission
  const handleHelpSubmit = async () => {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'You must be logged in to submit a support request');
        return;
      }

      // Insert the support message into the database
      const { data, error } = await supabase
        .from('contact_support_messages')
        .insert([
          {
            user_id: user.id,
            name: helpForm.name.trim(),
            email: helpForm.email.trim(),
            message: helpForm.message.trim(),
            status: 'new',
            user_agent: navigator.userAgent || 'Unknown',
            ip_address: null, // Will be handled by Supabase if needed
          }
        ])
        .select();

      if (error) {
        console.error('❌ Database submission error:', error);
        Alert.alert(
          'Submission Failed',
          `Failed to submit your message: ${error.message}\n\nPlease try again or contact support directly.`
        );
        return;
      }

      console.log('✅ Support message submitted successfully:', data);

      // Reset form and close modal
      setHelpForm({ name: '', email: '', message: '' });
      setShowHelpModal(false);

      // Show success message
      Alert.alert('Success', 'Your message has been sent. We\'ll get back to you soon!');

    } catch (error) {
      console.error('💥 Unexpected error submitting support message:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again or contact support directly.'
      );
    }
  };

  const handleContactSupport = () => {
    const email = "support@example.com";
    const subject = "Support Request";
    const body = "Hi, I need help with...";
    const mailto = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    Linking.openURL(mailto);
  };

  const getBadgeStyle = (achievement: Achievement) => {
    if (!achievement.unlocked) {
      return {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      };
    }

    const tierIndex = ACHIEVEMENT_TARGETS.indexOf(achievement.target);
    const badgeDesigns = [
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887" },
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887" },
      { backgroundColor: "#FFE4B5", borderColor: "#DEB887" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8" },
      { backgroundColor: "#E6E6FA", borderColor: "#D8BFD8" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500" },
      { backgroundColor: "#FFD700", borderColor: "#FFA500" },
      { backgroundColor: "#E0BBE4", borderColor: "#D8BFD8" },
      { backgroundColor: "#E0BBE4", borderColor: "#D8BFD8" },
      { backgroundColor: "#FFB6C1", borderColor: "#FF69B4" },
    ];

    return {
      backgroundColor: badgeDesigns[tierIndex]?.backgroundColor || "#f3f4f6",
      borderColor: badgeDesigns[tierIndex]?.borderColor || "#e5e7eb",
    };
  };

  const getBadgeDesign = (achievement: Achievement) => {
    const tierIndex = ACHIEVEMENT_TARGETS.indexOf(achievement.target);
    const badgeDesigns = [
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Bronze", emoji: "🥉" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Silver", emoji: "🥈" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Gold", emoji: "🥇" },
      { tier: "Platinum", emoji: "💎" },
      { tier: "Platinum", emoji: "💎" },
      { tier: "Diamond", emoji: "👑" },
    ];

    return badgeDesigns[tierIndex] || { tier: "Bronze", emoji: "🏅" };
  };

  const renderAchievementsSection = () => {
    const accomplishedAchievements = achievements.filter((a) => a.unlocked);

    if (accomplishedAchievements.length === 0) {
      return (
        <View style={styles.emptyAchievements}>
          <Ionicons name="trophy" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyAchievementsText, { color: colors.text }]}>
            No achievements yet
          </Text>
          <Text
            style={[
              styles.emptyAchievementsSubtext,
              { color: colors.textSecondary },
            ]}
          >
            Complete daily routines to earn your first achievement!
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementsScrollContent}
      >
        {accomplishedAchievements.map((achievement) => {
          const badgeDesign = getBadgeDesign(achievement);
          const badgeStyle = getBadgeStyle(achievement);

          return (
            <View key={achievement.id} style={styles.accomplishedAchievement}>
              <View style={[styles.accomplishedBadge, badgeStyle]}>
                <Text style={styles.accomplishedBadgeEmoji}>
                  {badgeDesign.emoji}
                </Text>
                <View style={styles.accomplishedBadgeNumber}>
                  <Text style={styles.accomplishedBadgeNumberText}>
                    {achievement.target}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.accomplishedAchievementTitle,
                  { color: colors.text },
                ]}
              >
                {achievement.target} Day{achievement.target === 1 ? "" : "s"}
              </Text>
              <Text
                style={[
                  styles.accomplishedAchievementTier,
                  { color: colors.textSecondary },
                ]}
              >
                {badgeDesign.tier}
              </Text>
              {achievement.unlockedDate && (
                <Text
                  style={[
                    styles.accomplishedAchievementDate,
                    { color: colors.textTertiary },
                  ]}
                >
                  {new Date(achievement.unlockedDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ✅ UPDATED: Menu items with Premium integration
  const menuItems = [
    {
      title: "Settings",
      subtitle: "Notifications, preferences, and more",
      icon: "settings-outline",
      iconColor: colors.textSecondary,
      onPress: () => navigation.navigate("Settings"),
    },
    {
      title: isPremium ? "Premium Features" : "Upgrade to Premium",
      subtitle: isPremium
        ? "Manage your subscription"
        : "Unlock unlimited routines & AI features",
      icon: "diamond",
      iconColor: "#FFD700", // Gold color for premium
      onPress: () => navigation.navigate("Premium", { source: "profile_menu" }),
      isPremium: true, // Flag to style differently
      badge: !isPremium ? "$2.94/mo" : "ACTIVE",
    },
    {
      title: "Help & Support",
      subtitle: "Get help or contact us",
      icon: "help-circle-outline",
      iconColor: colors.textSecondary,
      onPress: showHelpSupport,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Profile
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Profile
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={[
            styles.userSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleProfilePicturePress}
            disabled={uploadingImage}
          >
            {renderAvatar()}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.userName, { color: colors.text }]}>
            {profile?.display_name || profile?.full_name || "User"}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {profile?.email}
          </Text>
          <Text style={[styles.joinDate, { color: colors.textTertiary }]}>
            Joined{" "}
            {new Date(profile?.created_at || "").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Achievements Section */}
        <View
          style={[
            styles.achievementsSection,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.achievementsHeader}>
            <Ionicons name="trophy" size={20} color="#007AFF" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Achievements
            </Text>
            <View
              style={[
                styles.achievementCount,
                { backgroundColor: "#007AFF20" },
              ]}
            >
              <Text style={[styles.achievementCountText, { color: "#007AFF" }]}>
                {achievements.filter((a) => a.unlocked).length}/
                {achievements.length}
              </Text>
            </View>
          </View>
          {renderAchievementsSection()}
        </View>

        {/* ✅ UPDATED: Menu Section with Premium styling */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIconContainer,
                    { backgroundColor: item.isPremium ? "#FFD70020" : "#007AFF20" },
                    item.isPremium && { borderColor: "#FFD70040", borderWidth: 1 },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={18}
                    color={item.iconColor || "#007AFF"}
                  />
                </View>
                <View style={styles.menuItemContent}>
                  <Text
                    style={[
                      styles.menuItemTitle,
                      { color: colors.text },
                      item.isPremium && { fontWeight: "600" }
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.menuItemSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              </View>

              {/* ✅ Premium Badge or Chevron */}
              <View style={styles.menuItemRight}>
                {item.badge && (
                  <View
                    style={[
                      styles.menuBadge,
                      {
                        backgroundColor: isPremium ? "#34C759" : "#FFD70020",
                        borderColor: isPremium ? "#34C759" : "#FFD700",
                        borderWidth: isPremium ? 0 : 1,
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuBadgeText,
                        {
                          color: isPremium ? "#fff" : "#FFD700",
                          fontSize: isPremium ? 10 : 11,
                          fontWeight: "700",
                        }
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={item.isPremium ? "#FFD700" : colors.textTertiary}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.imagePickerOverlay}>
          <View
            style={[
              styles.imagePickerContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.imagePickerTitle, { color: colors.text }]}>
              Change Profile Picture
            </Text>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => pickImage(true)}
            >
              <Ionicons name="camera" size={24} color="#007AFF" />
              <Text
                style={[styles.imagePickerOptionText, { color: colors.text }]}
              >
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => pickImage(false)}
            >
              <Ionicons name="images" size={24} color="#007AFF" />
              <Text
                style={[styles.imagePickerOptionText, { color: colors.text }]}
              >
                Choose from Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imagePickerCancel,
                { borderTopColor: colors.border },
              ]}
              onPress={() => setShowImagePicker(false)}
            >
              <Text
                style={[
                  styles.imagePickerCancelText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ✅ UPDATED: Help & Support Modal with Form */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.helpModalContent, { backgroundColor: colors.surface }]}>
            {/* ✅ UPDATED: Header with close button */}
            <View style={[styles.helpModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.helpModalTitle, { color: colors.text }]}>
                Help & Support
              </Text>
              <TouchableOpacity
                onPress={() => setShowHelpModal(false)}
                style={styles.helpModalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* ✅ NEW: Form content */}
            <View style={styles.helpFormContainer}>
              {/* Name input */}
              <View style={styles.helpInputGroup}>
                <Text style={[styles.helpInputLabel, { color: colors.textSecondary }]}>
                  name
                </Text>
                <TextInput
                  style={[
                    styles.helpTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    }
                  ]}
                  placeholder=""
                  placeholderTextColor={colors.textTertiary}
                  value={helpForm.name}
                  onChangeText={(text) => setHelpForm({ ...helpForm, name: text })}
                />
              </View>

              {/* Email input */}
              <View style={styles.helpInputGroup}>
                <Text style={[styles.helpInputLabel, { color: colors.textSecondary }]}>
                  email
                </Text>
                <TextInput
                  style={[
                    styles.helpTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    }
                  ]}
                  placeholder=""
                  placeholderTextColor={colors.textTertiary}
                  value={helpForm.email}
                  onChangeText={(text) => setHelpForm({ ...helpForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Message input */}
              <View style={styles.helpInputGroup}>
                <Text style={[styles.helpInputLabel, { color: colors.textSecondary }]}>
                  message
                </Text>
                <TextInput
                  style={[
                    styles.helpTextAreaInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    }
                  ]}
                  placeholder=""
                  placeholderTextColor={colors.textTertiary}
                  value={helpForm.message}
                  onChangeText={(text) => setHelpForm({ ...helpForm, message: text })}
                  multiline={true}
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[
                  styles.helpSubmitButton,
                  {
                    backgroundColor: helpForm.name && helpForm.email && helpForm.message
                      ? "#007AFF"
                      : colors.border,
                  }
                ]}
                onPress={handleHelpSubmit}
                disabled={!helpForm.name || !helpForm.email || !helpForm.message}
              >
                <Text
                  style={[
                    styles.helpSubmitButtonText,
                    {
                      color: helpForm.name && helpForm.email && helpForm.message
                        ? "#fff"
                        : colors.textTertiary,
                    }
                  ]}
                >
                  submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  userSection: {
    alignItems: "center",
    paddingVertical: 30,
    marginTop: 15,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 15,
    position: "relative",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 10,
  },
  joinDate: {
    fontSize: 14,
  },
  achievementsSection: {
    marginTop: 15,
    borderBottomWidth: 1,
    paddingVertical: 20,
  },
  achievementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  achievementCount: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  achievementCountText: {
    fontSize: 12,
    fontWeight: "600",
  },
  achievementsScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  accomplishedAchievement: {
    alignItems: "center",
    marginRight: 20,
    width: 80,
  },
  accomplishedBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  accomplishedBadgeEmoji: {
    fontSize: 24,
  },
  accomplishedBadgeNumber: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
    minWidth: 20,
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  accomplishedBadgeNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#333",
  },
  accomplishedAchievementTitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  accomplishedAchievementTier: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  accomplishedAchievementDate: {
    fontSize: 9,
    textAlign: "center",
  },
  emptyAchievements: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyAchievementsText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyAchievementsSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  menuSection: {
    marginTop: 15,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
  },
  // ✅ NEW: Premium menu styling
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  imagePickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  imagePickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  imagePickerOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  imagePickerCancel: {
    borderTopWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  // ✅ NEW: Help Modal Styles
  helpModalContent: {
    width: "90%",
    maxWidth: 500,
    borderRadius: 16,
    maxHeight: "80%",
  },
  helpModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  helpModalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  helpModalCloseButton: {
    padding: 4,
  },
  helpFormContainer: {
    padding: 24,
  },
  helpInputGroup: {
    marginBottom: 20,
  },
  helpInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  helpTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  helpTextAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 120,
  },
  helpSubmitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  helpSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});