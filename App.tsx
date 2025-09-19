// App.tsx - MINIMAL FIXES TO YOUR EXISTING CODE
import React, { useEffect, useState, useRef, ErrorInfo } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, Alert, Linking, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Session } from './src/services/supabase';

// CRITICAL FIX 1: Add URL polyfill - THIS IS LIKELY THE MAIN ISSUE
import 'react-native-url-polyfill/auto';

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
import AboutScreen from './src/screens/Profile/AboutScreen';
import PrivacyScreen from './src/screens/Profile/PrivacyScreen';
import TermsScreen from './src/screens/Profile/TermsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// CRITICAL FIX 2: Add Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Something went wrong'}
          </Text>
          <Text style={styles.errorDetails}>
            Please restart the app. If this persists, contact support.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// CRITICAL FIX 3: Add error boundaries to stack navigators
function HomeStack() {
  return (
    <ErrorBoundary>
      <Stack.Navigator>
        <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddRoutine" component={AddRoutineScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

function AIStack() {
  return (
    <ErrorBoundary>
      <Stack.Navigator>
        <Stack.Screen name="AIChatMain" component={AIChatScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AISettings" component={AISettingsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

function NotesStack() {
  return (
    <ErrorBoundary>
      <Stack.Navigator>
        <Stack.Screen name="NotesList" component={NotesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

function ProfileStack() {
  const { colors } = useTheme();
  return (
    <ErrorBoundary>
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
        <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

function AuthStack() {
  return (
    <ErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ConfirmPasswordReset" component={ConfirmPasswordResetScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

// CRITICAL FIX 4: Add better error handling to AppContent
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [resetTokens, setResetTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const { colors } = useTheme();
  const { refreshSubscriptionStatus } = usePremium();
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    console.log('🚀 AppContent initializing...');

    const initializeAuth = async () => {
      try {
        console.log('📱 Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Session error:', error);
          setInitError(`Session Error: ${error.message}`);
          setIsLoading(false);
          return;
        }

        console.log('✅ Initial session:', session ? 'EXISTS' : 'NULL');

        // Only set session if it's not a password reset session
        if (session && !pendingPasswordReset) {
          setSession(session);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        setInitError(`Auth Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Auth state change:', _event, session ? 'SESSION_EXISTS' : 'NO_SESSION');

      // Only set session if it's not a password reset flow
      if (!pendingPasswordReset) {
        setSession(session);
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [pendingPasswordReset]);

  // Deep Link Handler (keeping your existing logic)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('🔗 Deep link received:', url);

      // Handle password reset deep link
      if (url.includes('#access_token=') || url.includes('reset-password-confirm')) {
        console.log('🔐 Password reset link detected');

        const hashParams = url.split('#')[1];
        if (hashParams) {
          const params = new URLSearchParams(hashParams);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('✅ Valid reset tokens found');

            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (!error && data.session) {
                console.log('✅ Reset session validated successfully');

                setResetTokens({ accessToken, refreshToken });
                setPendingPasswordReset(true);
                setSession(null);

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
                console.error('❌ Invalid reset session:', error);
                Alert.alert('Error', 'Invalid or expired reset link. Please request a new one.');
              }
            } catch (error) {
              console.error('❌ Error handling reset link:', error);
              Alert.alert('Error', 'Failed to process reset link. Please try again.');
            }
          } else {
            console.error('❌ Missing access or refresh token');
            Alert.alert('Error', 'Invalid reset link format.');
          }
        } else {
          console.error('❌ No hash parameters found in URL');
          Alert.alert('Error', 'Invalid reset link.');
        }
        return;
      }

      // Handle premium deep links
      if (url.includes('premium-success')) {
        console.log('💎 Premium success deep link received');

        setTimeout(async () => {
          try {
            await refreshSubscriptionStatus();
            Alert.alert(
              'Payment Successful!',
              'Welcome to Premium! Your subscription is now active.',
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('❌ Error refreshing premium status:', error);
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

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => linkingSubscription?.remove();
  }, [refreshSubscriptionStatus]);

  const completePasswordReset = async () => {
    console.log('🔄 Completing password reset flow');

    setPendingPasswordReset(false);
    setResetTokens(null);

    await supabase.auth.signOut();

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

  // CRITICAL FIX 5: Show initialization errors instead of blank screen
  if (initError) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Initialization Error</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>{initError}</Text>
        <Text style={[styles.errorDetails, { color: colors.textSecondary }]}>
          Please restart the app. If this continues, check your internet connection.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        {session && !pendingPasswordReset ? <MainTabs /> : <AuthStack />}
      </NavigationContainer>
    </ErrorBoundary>
  );
}

// CRITICAL FIX 6: Wrap root component with error boundary
export default function App() {
  console.log('🎯 App component rendering...');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PremiumProvider>
          <HomeViewProvider>
            <AppContent />
          </HomeViewProvider>
        </PremiumProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});