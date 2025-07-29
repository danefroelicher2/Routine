import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet, StatusBar, Linking, Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "./src/services/supabase";
import "react-native-url-polyfill/auto";

// Services
import { supabase } from "./src/services/supabase";

// Theme Provider
import { ThemeProvider, useTheme } from "./ThemeContext";

// ✅ PREMIUM PROVIDER
import { PremiumProvider } from "./src/contexts/PremiumContext";

// Auth Screens
import LoginScreen from "./src/screens/Auth/LoginScreen";
import SignupScreen from "./src/screens/Auth/SignupScreen";
import ChangePasswordScreen from "./src/screens/Profile/ChangePasswordScreen";
import ResetPasswordScreen from "./src/screens/Auth/ResetPasswordScreen";

// Main App Screens
import HomeScreen from "./src/screens/Home/HomeScreen";
import AddRoutineScreen from "./src/screens/Home/AddRoutineScreen";
import StatsScreen from "./src/screens/Stats/StatsScreen";

// AI Screens
import AIChatScreen from "./src/screens/AI/AIChatScreen";
import AISettingsScreen from "./src/screens/AI/AISettingsScreen";

// Other Screens
import NotesScreen from "./src/screens/Notes/NotesScreen";
import NoteDetailScreen from "./src/screens/Notes/NoteDetailScreen";
import ProfileScreen from "./src/screens/Profile/ProfileScreen";
import SettingsScreen from "./src/screens/Profile/SettingsScreen";
import RoutineManagerScreen from "./src/screens/Profile/RoutineManagerScreen";

// ✅ PREMIUM SCREEN
import PremiumScreen from "./src/screens/Premium/PremiumScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack Navigator for Home
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddRoutine"
        component={AddRoutineScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Stack Navigator for AI
function AIStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AIChatMain"
        component={AIChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AISettings"
        component={AISettingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Stack Navigator for Notes
function NotesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="NotesList"
        component={NotesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NoteDetail"
        component={NoteDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ✅ Stack Navigator for Profile with Premium Screen
function ProfileStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: "#007AFF",
        headerTitleStyle: {
          color: colors.text,
        },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="RoutineManager"
        component={RoutineManagerScreen}
        options={{ title: "Manage Routines" }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerShown: false }}
      />
      {/* ✅ PREMIUM SCREEN */}
      <Stack.Screen
        name="Premium"
        component={PremiumScreen}
        options={{
          title: "Premium",
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: "#FFD700",
          headerTitleStyle: {
            color: colors.text,
            fontWeight: "700",
          },
        }}
      />
    </Stack.Navigator>
  );
}

// Auth Stack Navigator
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

// Main App Tabs
function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Stats") {
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          } else if (route.name === "AI") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";

            return (
              <View
                style={{
                  backgroundColor: focused ? "#007AFF20" : "transparent",
                  borderRadius: 20,
                  padding: 8,
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}
              >
                <Ionicons
                  name={iconName}
                  size={size}
                  color={focused ? "#007AFF" : color}
                />
              </View>
            );
          } else if (route.name === "Notes") {
            iconName = focused ? "document-text" : "document-text-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "ellipse";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: -5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="AI" component={AIStack} />
      <Tab.Screen name="Notes" component={NotesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// App Content with Deep Link Handling
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ DEEP LINK HANDLING FOR STRIPE
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('🔗 Deep link received:', url);

      if (url.includes('premium-success')) {
        console.log('🎉 Premium purchase successful!');

        setTimeout(async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // 🔑 REPLACE YOUR_VERCEL_URL with your actual Vercel URL
              const response = await fetch(
                `https://YOUR_VERCEL_URL.vercel.app/api/subscription-status?userId=${user.id}`
              );

              if (response.ok) {
                const { isPremium } = await response.json();

                if (isPremium) {
                  Alert.alert(
                    '🎉 Welcome to Premium!',
                    'Your premium features are now active! Enjoy unlimited routines, AI assistant, and more.',
                    [{ text: 'Get Started' }]
                  );
                }
              }
            }
          } catch (error) {
            console.error('❌ Error processing premium success:', error);
            Alert.alert(
              'Success!',
              'Welcome to Premium! Your features are being activated.',
              [{ text: 'OK' }]
            );
          }
        }, 1000);

      } else if (url.includes('premium-cancel')) {
        console.log('❌ Premium purchase cancelled');
        setTimeout(() => {
          Alert.alert(
            'Purchase Cancelled',
            'No worries! You can upgrade to Premium anytime.',
            [{ text: 'OK' }]
          );
        }, 500);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription?.remove();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

// ✅ MAIN APP WITH PREMIUM PROVIDER
export default function App() {
  return (
    <ThemeProvider>
      <PremiumProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <AppContent />
      </PremiumProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});