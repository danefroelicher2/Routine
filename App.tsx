import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "./src/services/supabase";
import "react-native-url-polyfill/auto";

// Services
import { supabase } from "./src/services/supabase";

// NEW: Theme Provider
import { ThemeProvider, useTheme } from "./ThemeContext";

// Auth Screens
import LoginScreen from "./src/screens/Auth/LoginScreen";
import SignupScreen from "./src/screens/Auth/SignupScreen";

// Main App Screens
import HomeScreen from "./src/screens/Home/HomeScreen";
import AddRoutineScreen from "./src/screens/Home/AddRoutineScreen";
import StatsScreen from "./src/screens/Stats/StatsScreen";
import SocialScreen from "./src/screens/Social/SocialScreen"; // NEW: Social Screen Import
import UserProfileScreen from "./src/screens/Social/UserProfileScreen"; // NEW: User Profile Screen
import NotesScreen from "./src/screens/Notes/NotesScreen";
import NoteDetailScreen from "./src/screens/Notes/NoteDetailScreen";
import ProfileScreen from "./src/screens/Profile/ProfileScreen";
import SettingsScreen from "./src/screens/Profile/SettingsScreen";
import RoutineManagerScreen from "./src/screens/Profile/RoutineManagerScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack Navigator for Home (includes add routine)
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

// NEW: Stack Navigator for Social (includes user profiles)
function SocialStack() {
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
        name="SocialMain"
        component={SocialScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Stack Navigator for Notes - HEADERS HIDDEN FOR BOTH SCREENS
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

// Stack Navigator for Profile (includes settings) - HEADERS KEPT
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
    </Stack.Navigator>
  );
}

// Auth Stack Navigator
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// Main App Tabs with Theme and NEW Social Tab
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
          } else if (route.name === "Social") {
            // NEW: Social tab icon - using people icons
            iconName = focused ? "people" : "people-outline";

            // NEW: Return custom styled icon for Social tab
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
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      {/* UPDATED: Social Tab now uses SocialStack instead of SocialScreen */}
      <Tab.Screen name="Social" component={SocialStack} />
      <Tab.Screen name="Notes" component={NotesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// App Content (needs to be wrapped in ThemeProvider)
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

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
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={colors.statusBar}
        backgroundColor={colors.background}
      />
      <NavigationContainer>
        {session ? <MainTabs /> : <AuthStack />}
      </NavigationContainer>
    </>
  );
}

// Main App Component with ThemeProvider
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
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
