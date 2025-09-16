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
      bundleIdentifier: "com.routine.dailyhabits",
      // FIXED: Add Face ID usage description
      infoPlist: {
        NSFaceIDUsageDescription:
          "This app uses Face ID to secure your private notes.",
        ITSAppUsesNonExemptEncryption: false
      },
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
      // FIXED: Proper expo-local-authentication plugin configuration
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Allow Routine to use Face ID to secure your notes.",
        },
      ],
    ],
    // ADD THIS SECTION: EAS Configuration
    extra: {
      eas: {
        projectId: "c5578321-6c96-4f53-80f8-46cf2bc3bbcd"
      }
    }
  },
};