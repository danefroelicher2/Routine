export default {
  expo: {
    name: "Routine",
    slug: "routine-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.routine.app",
      // UPDATED: Enhanced info.plist for Apple IAP and security
      infoPlist: {
        NSFaceIDUsageDescription: "This app uses Face ID to secure your private notes.",
        ITSAppUsesNonExemptEncryption: false,
        // ✅ ADD THESE FOR APPLE IAP SUPPORT
        NSCameraUsageDescription: "Upload profile photos",
        NSPhotoLibraryUsageDescription: "Select profile photos from library"
      },
      // ✅ CRITICAL: Apple IAP Configuration
      usesAppleSignIn: false, // Set to true if you want Apple Sign In
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.yourcompany.routine",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-secure-store",
      // ✅ ADD EXPO-STORE-KIT for Apple IAP
      "expo-store-kit",
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Allow Routine to use Face ID to secure your notes.",
        },
      ],
    ],
    // EAS Configuration
    extra: {
      eas: {
        projectId: "c5578321-6c96-4f53-80f8-46cf2bc3bbcd"
      }
    },
    // ✅ CRITICAL: Deep linking configuration for payment flows
    scheme: "routineapp",
    // ✅ URL schemes for payment handling
    linking: {
      schemes: ["routineapp"],
      config: {
        screens: {
          // Handle payment success/failure redirects
          Premium: "premium-success",
          PremiumCancel: "premium-cancel"
        }
      }
    }
  },
};