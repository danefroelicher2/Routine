// App.tsx - UPDATED TO FIX PASSWORD RESET FLOW + PREMIUM DEEP LINKS
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Session } from './src/services/supabase';

// Services
import { supabase } from './src/services/supabase';

// Context Providers
import { ThemeProvider, useTheme } from './ThemeContext';
import { PremiumProvider, usePremium } from './src/contexts/PremiumContext';
import { HomeViewProvider } from './src/contexts/HomeViewContext';

// Auth Screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import SignupScreen from './src/screens/Auth/SignupScreen';
import ResetPasswordScreen from './src/screens/Auth/ResetPasswordScreen';
import ConfirmPasswordResetScreen from './src/screens/Auth/ConfirmPasswordResetScreen';

// Main App Screens
import HomeScreen from './src/screens/Home/HomeScreen';
import AddRoutineScreen from './src/screens/Home/AddRoutineScreen';
import StatsScreen from './src/screens/Stats/StatsScreen';
import AIChatScreen from './src/screens/AI/AIChatScreen';
import AISettingsScreen from './src/screens/AI/AISettingsScreen';
import NotesScreen from './src/screens/Notes/NotesScreen';
import NoteDetailScreen from './src/screens/Notes/NoteDetailScreen';
import ProfileScreen from './src/screens/Profile/ProfileScreen';
import SettingsScreen from './src/screens/Profile/SettingsScreen';
import ChangePasswordScreen from './src/screens/Profile/ChangePasswordScreen';
import RoutineManagerScreen from './src/screens/Profile/RoutineManagerScreen';
import PremiumScreen from './src/screens/Premium/PremiumScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack Navigator for Home
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddRoutine" component={AddRoutineScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Stack Navigator for AI
function AIStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AIChatMain" component={AIChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AISettings" component={AISettingsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Stack Navigator for Notes
function NotesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="NotesList" component={NotesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Stack Navigator for Profile
function ProfileStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: '#007AFF',
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
      <Stack.Screen name="RoutineManager" component={RoutineManagerScreen} options={{ title: 'Manage Routines' }} />
      <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: 'Premium', headerShown: false }} />
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
          let iconName: any;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'AI') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Notes') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
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
          fontWeight: '500',
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

// ====================================
// FIXED: Auth Stack Navigator 
// ====================================
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

// ====================================
// MAIN APP COMPONENT WITH FIXED DEEP LINK HANDLING + PREMIUM LINKS
// ====================================
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [resetTokens, setResetTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const { colors } = useTheme();
  const { refreshSubscriptionStatus } = usePremium();
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session ? 'EXISTS' : 'NULL');

      // Only set session if it's not a password reset session
      if (session && !pendingPasswordReset) {
        setSession(session);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session ? 'SESSION_EXISTS' : 'NO_SESSION');

      // Only set session if it's not a password reset flow
      if (!pendingPasswordReset) {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [pendingPasswordReset]);

  // ====================================
  // FIXED: Deep Link Handler + Premium Support
  // ====================================
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);

      // Handle password reset deep link
      if (url.includes('#access_token=') || url.includes('reset-password-confirm')) {
        console.log('Password reset link detected');

        const hashParams = url.split('#')[1];
        if (hashParams) {
          const params = new URLSearchParams(hashParams);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('Valid reset tokens found');

            try {
              // KEY FIX: Don't set session yet! Store tokens and navigate to ConfirmPasswordResetScreen

              // Set the session temporarily for validation
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (!error && data.session) {
                console.log('Reset session validated successfully');

                // Store the reset tokens
                setResetTokens({ accessToken, refreshToken });

                // Set flag to prevent normal session handling
                setPendingPasswordReset(true);

                // Don't set the main session - keep user in AuthStack
                setSession(null);

                // Navigate to ConfirmPasswordResetScreen
                setTimeout(() => {
                  if (navigationRef.current) {
                    navigationRef.current.navigate('ConfirmPasswordReset');
                  }
                }, 500);

                Alert.alert(
                  'Reset Password',
                  'Please set your new password below.',
                  [{ text: 'OK' }]
                );

              } else {
                console.error('Invalid reset session:', error);
                Alert.alert('Error', 'Invalid or expired reset link. Please request a new one.');
              }
            } catch (error) {
              console.error('Error handling reset link:', error);
              Alert.alert('Error', 'Failed to process reset link. Please try again.');
            }
          } else {
            console.error('Missing access or refresh token');
            Alert.alert('Error', 'Invalid reset link format.');
          }
        } else {
          console.error('No hash parameters found in URL');
          Alert.alert('Error', 'Invalid reset link.');
        }
        return; // Early return to prevent premium link handling
      }

      // Handle premium deep links
      if (url.includes('premium-success')) {
        console.log('Premium success deep link received');

        // Refresh subscription status with delay to ensure webhook processed
        setTimeout(async () => {
          try {
            await refreshSubscriptionStatus();
            Alert.alert(
              'Payment Successful!',
              'Welcome to Premium! Your subscription is now active.',
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('Error refreshing premium status:', error);
            Alert.alert(
              'Payment Successful!',
              'Your premium subscription is active. Please restart the app to see your new features.',
              [{ text: 'OK' }]
            );
          }
        }, 2000);

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
  }, [refreshSubscriptionStatus]);

  // ====================================
  // HELPER FUNCTION: Complete Password Reset
  // ====================================
  const completePasswordReset = async () => {
    console.log('Completing password reset flow');

    // Clear the password reset flow
    setPendingPasswordReset(false);
    setResetTokens(null);

    // Sign out to clear any temporary session
    await supabase.auth.signOut();

    // Navigate back to login
    if (navigationRef.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  // Make helper function available globally for ConfirmPasswordResetScreen
  (global as any).completePasswordReset = completePasswordReset;
  (global as any).resetTokens = resetTokens;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {session && !pendingPasswordReset ? <MainTabs /> : <AuthStack />}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});