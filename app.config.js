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
            backgroundColor: "#ffffff"
        },
        assetBundlePatterns: [
            "**/*"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.yourcompany.routine"
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            package: "com.yourcompany.routine"
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        plugins: [
            "expo-secure-store",
            "expo-local-authentication"
        ]
    }
};