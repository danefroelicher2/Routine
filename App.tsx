import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet, StatusBar, Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "./src/services/supabase";
import * as Linking from 'expo-linking';

import "react-native-url-polyfill/auto";

// Services
import { supabase } from "./src/services/supabase";

// Theme Provider
import { ThemeProvider, useTheme } from "./ThemeContext";

// PREMIUM PROVIDER
import { PremiumProvider } from "./src/contexts/PremiumContext";

// HOME VIEW PROVIDER
import { HomeViewProvider } from './src/contexts/HomeViewContext';

// Auth Screens
import LoginScreen from "./src/screens/Auth/LoginScreen";
import SignupScreen from "./src/screens/Auth/SignupScreen";
import ChangePasswordScreen from "./src/screens/Profile/ChangePasswordScreen";
import ResetPasswordScreen from "./src/screens/Auth/ResetPasswordScreen";
import ConfirmPasswordResetScreen from './src/screens/Auth/ConfirmPasswordResetScreen';

// Main App Screens
import HomeScreen from "./src/screens/Home/HomeScreen";
import AddRoutineScreen from "./src/screens/Home/AddRoutineScreen";
import StatsScreen from "./src/screens/Stats/StatsScreen";

// AI Screens
import AIChatScreen from "./src/screens/AI/AIChatScreen";
import AISettingsScreen from "./src/screens/AI/AISettingsScreen";
import AIPremiumPaywall from "./src/screens/AI/AIPremiumPaywall";

// Other Screens
import NotesScreen from "./src/screens/Notes/NotesScreen";
import NoteDetailScreen from "./src/screens/Notes/NoteDetailScreen";
import ProfileScreen from "./src/screens/Profile/ProfileScreen";
import SettingsScreen from "./src/screens/Profile/SettingsScreen";
import RoutineManagerScreen from "./src/screens/Profile/RoutineManagerScreen";

// PREMIUM SCREEN
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
      <Stack.Screen
        name="AIPremiumPaywall"
        component={AIPremiumPaywall}
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

// Stack Navigator for Profile with Premium Screen
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: "Change Password" }}
      />
      <Stack.Screen
        name="RoutineManager"
        component={RoutineManagerScreen}
        options={{ title: "Manage Routines" }}
      />
      <Stack.Screen
        name="Premium"
        component={PremiumScreen}
        options={{
          title: "Premium",
          headerShown: false
        }}
      />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
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
            iconName = focused ? "analytics" : "analytics-outline";
          } else if (route.name === "AI") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "Notes") {
            iconName = focused ? "document-text" : "document-text-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 4,
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

// Auth Stack Navigator - WITH ConfirmPasswordReset
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ConfirmPasswordReset" component={ConfirmPasswordResetScreen} />
    </Stack.Navigator>
  );
}

// Main App Component
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle deep linking for password reset AND premium
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);

      // Handle password reset deep link
      if (url.includes('#access_token=') || url.includes('reset-password-confirm')) {
        const hashParams = url.split('#')[1];
        if (hashParams) {
          const params = new URLSearchParams(hashParams);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            try {
              // Set the session with the tokens
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (!error && data.session) {
                // User is now authenticated with reset token
                // They can now update their password
                Alert.alert(
                  'Reset Password',
                  'You can now set your new password.',
                  [{ text: 'OK' }]
                );
                // The navigation will happen automatically since session is set
              } else {
                Alert.alert('Error', 'Invalid or expired reset link. Please request a new one.');
              }
            } catch (error) {
              console.error('Error handling reset link:', error);
              Alert.alert('Error', 'Failed to process reset link. Please try again.');
            }
          }
        }
      }

      // Handle premium deep links
      if (url.includes('premium-success')) {
        Alert.alert(
          'Payment Successful! 🎉',
          'Welcome to Premium! Your subscription is now active.',
          [{ text: 'OK' }]
        );
      } else if (url.includes('premium-cancel')) {
        Alert.alert(
          'Payment Cancelled',
          'No worries! You can upgrade to Premium anytime.',
          [{ text: 'OK' }]
        );
      }
    };

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle URLs when app is running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => linkingSubscription?.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

// Root App Component with Providers
export default function App() {
  return (
    <ThemeProvider>
      <PremiumProvider>
        <HomeViewProvider>
          <AppContent />
        </HomeViewProvider>
      </PremiumProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});