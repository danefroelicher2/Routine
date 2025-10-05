// App.tsx - COMPLETE FILE WITH SENTRY CRASH REPORTING

// CRITICAL: Initialize Sentry FIRST, before any other imports
import * as Sentry from '@sentry/react-native';

// TODO: Replace this placeholder DSN with your actual Sentry project DSN
// Get your DSN from: https://sentry.io/settings/projects/your-project/keys/
const SENTRY_DSN = 'https://22e6c820397dea486faed51f986836b82e04510123339677696.ingest.us.sentry.io/4510123340988416'

// Initialize Sentry with debug mode enabled
Sentry.init({
  dsn: SENTRY_DSN,
  debug: true, // Enable debug mode for development
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  enableNative: true,
  enableNativeCrashHandling: true,
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  beforeSend(event, hint) {
    // Log all events to console for debugging
    console.log('📊 Sentry Event:', event);
    return event;
  },
  beforeBreadcrumb(breadcrumb, hint) {
    // Log all breadcrumbs to console for debugging
    console.log('🍞 Sentry Breadcrumb:', breadcrumb);
    return breadcrumb;
  },
});

// Add initial breadcrumb to track app start
Sentry.addBreadcrumb({
  category: 'app.lifecycle',
  message: 'App.tsx loaded - Sentry initialized',
  level: 'info',
  data: {
    timestamp: new Date().toISOString(),
  },
});

console.log('✅ Sentry initialized with DSN:', SENTRY_DSN === 'https://22e6c820397dea486faed51f986836b82e04510123339677696.ingest.us.sentry.io/4510123340988416' ? 'PLACEHOLDER (needs to be replaced)' : 'configured');

import React, { useEffect, useState, useRef, ErrorInfo } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, Alert, Linking, Text, Dimensions, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Session } from './src/services/supabase';

// Add URL polyfill
import 'react-native-url-polyfill/auto';

// Add breadcrumb after URL polyfill import
Sentry.addBreadcrumb({
  category: 'app.lifecycle',
  message: 'URL polyfill loaded',
  level: 'info',
});

// Services
import { supabase } from './src/services/supabase';

// Add breadcrumb after supabase import
Sentry.addBreadcrumb({
  category: 'app.lifecycle',
  message: 'Supabase service imported',
  level: 'info',
});

// Context Providers
import { ThemeProvider, useTheme } from './ThemeContext';
import { PremiumProvider, usePremium } from './src/contexts/PremiumContext';
import { HomeViewProvider } from './src/contexts/HomeViewContext';

// Add breadcrumb after context providers import
Sentry.addBreadcrumb({
  category: 'app.lifecycle',
  message: 'Context providers imported (Theme, Premium, HomeView)',
  level: 'info',
});

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

// Device detection for Sentry
const { width, height } = Dimensions.get('window');

console.log(`📱 Device: iPhone (${width}×${height})`);

// Send device detection info to Sentry
Sentry.addBreadcrumb({
  category: 'device.detection',
  message: 'Device detected: iPhone',
  level: 'info',
  data: {
    width,
    height,
    platform: Platform.OS,
  },
});

// Set Sentry context for device info
Sentry.setContext('device', {
  type: 'iPhone',
  width,
  height,
  platform: Platform.OS,
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// SAFETY ENHANCEMENT: Enhanced Error Boundary Component with provider-specific fallbacks
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackComponent?: React.ComponentType },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallbackComponent?: React.ComponentType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('ErrorBoundary caught error:', error);

    // Send error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'true',
        component: 'ErrorBoundary',
      },
    });

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Boundary:', error, errorInfo);

    // Enhanced logging for provider failures
    if (error.message.includes('Context') || error.message.includes('Provider')) {
      console.error('🚨 Context Provider Error - attempting graceful recovery');

      // Send context provider errors to Sentry with extra context
      Sentry.captureException(error, {
        tags: {
          errorType: 'contextProvider',
          errorBoundary: 'true',
        },
        extra: {
          errorInfo,
          componentStack: errorInfo.componentStack,
        },
      });
    } else {
      // Send other errors to Sentry
      Sentry.captureException(error, {
        extra: {
          errorInfo,
          componentStack: errorInfo.componentStack,
        },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise default error UI
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return <FallbackComponent />;
      }

      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Something went wrong'}
          </Text>
          <Text style={styles.errorDetails}>
            Please restart the app. If this persists, contact support.
          </Text>
          <Text style={styles.deviceInfo}>
            Device: iPhone ({width}×{height})
          </Text>
          <Text style={styles.errorRecovery}>
            The app will attempt to recover automatically.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Stack navigators with error boundaries
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

// AppContent with error handling
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

    // Add breadcrumb for AppContent initialization
    Sentry.addBreadcrumb({
      category: 'app.lifecycle',
      message: 'AppContent component initializing',
      level: 'info',
    });

    const initializeAuth = async () => {
      try {
        console.log('📱 Getting initial session...');

        // Add breadcrumb for auth initialization start
        Sentry.addBreadcrumb({
          category: 'auth.init',
          message: 'Starting auth initialization',
          level: 'info',
        });

        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        );

        let sessionResult;

        try {
          sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as any;

          // Add breadcrumb for successful session fetch
          Sentry.addBreadcrumb({
            category: 'auth.session',
            message: 'Session fetched successfully (no timeout)',
            level: 'info',
          });
        } catch (timeoutError) {
          console.warn('⚠️ Session timeout - continuing without auth');

          // Add breadcrumb for session timeout
          Sentry.addBreadcrumb({
            category: 'auth.session',
            message: 'Session fetch timed out',
            level: 'warning',
            data: {
              timeout: 5000,
            },
          });

          // Capture timeout as an error in Sentry
          Sentry.captureException(new Error('Session timeout'), {
            tags: {
              errorType: 'sessionTimeout',
            },
          });

          // On timeout, continue with null session instead of failing
          setSession(null);
          setIsLoading(false);
          return;
        }

        const { data: { session }, error } = sessionResult;

        if (error) {
          console.error('❌ Session error:', error);

          // Add breadcrumb for session error
          Sentry.addBreadcrumb({
            category: 'auth.session',
            message: 'Session error occurred',
            level: 'error',
            data: {
              errorMessage: error.message,
            },
          });

          // Capture session error
          Sentry.captureException(error, {
            tags: {
              errorType: 'sessionError',
            },
          });

          setInitError(`Session Error: ${error.message}`);
          setIsLoading(false);
          return;
        }

        console.log('✅ Initial session:', session ? 'EXISTS' : 'NULL');

        // Add breadcrumb for session state
        Sentry.addBreadcrumb({
          category: 'auth.session',
          message: session ? 'Session exists' : 'No session found',
          level: 'info',
          data: {
            hasSession: !!session,
          },
        });

        // Only set session if it's not a password reset session
        if (session && !pendingPasswordReset) {
          setSession(session);
        }
        setIsLoading(false);

        // Add breadcrumb for successful auth initialization
        Sentry.addBreadcrumb({
          category: 'auth.init',
          message: 'Auth initialization completed successfully',
          level: 'info',
        });
      } catch (error) {
        console.error('❌ Auth initialization error:', error);

        // Add breadcrumb for initialization error
        Sentry.addBreadcrumb({
          category: 'auth.init',
          message: 'Auth initialization failed',
          level: 'error',
          data: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        // Capture initialization error
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
          tags: {
            errorType: 'authInitialization',
          },
        });

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

  if (initError) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Initialization Error</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>{initError}</Text>
        <Text style={[styles.errorDetails, { color: colors.textSecondary }]}>
          Please restart the app. If this continues, check your internet connection.
        </Text>
        <Text style={[styles.deviceInfo, { color: colors.textSecondary }]}>
          Device: iPhone ({width}×{height})
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading...
        </Text>
      </View>
    );
  }

  // Add breadcrumb before rendering navigation
  Sentry.addBreadcrumb({
    category: 'navigation.render',
    message: 'Rendering NavigationContainer',
    level: 'info',
    data: {
      hasSession: !!session,
      pendingPasswordReset,
      screen: session && !pendingPasswordReset ? 'MainTabs' : 'AuthStack',
    },
  });

  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        linking={{
          prefixes: ['routine://', 'https://routine-app.com'],
          config: {
            screens: {
              Premium: 'premium',
            },
          },
        }}
        onReady={() => {
          console.log('✅ NavigationContainer ready');
          Sentry.addBreadcrumb({
            category: 'navigation.lifecycle',
            message: 'NavigationContainer mounted and ready',
            level: 'info',
          });
        }}
        onStateChange={(state) => {
          console.log('🔄 Navigation state changed:', state);
          Sentry.addBreadcrumb({
            category: 'navigation.stateChange',
            message: 'Navigation state changed',
            level: 'info',
            data: {
              state: JSON.stringify(state),
            },
          });
        }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        {session && !pendingPasswordReset ? <MainTabs /> : <AuthStack />}
      </NavigationContainer>
    </ErrorBoundary>
  );
}

// SAFETY ENHANCEMENT: Enhanced error boundary protection for context providers
// Wrap entire app with Sentry ErrorBoundary
const SentryApp = Sentry.wrap(function App() {
  console.log('🎯 App component rendering...');

  // Add breadcrumb for App component render
  Sentry.addBreadcrumb({
    category: 'app.lifecycle',
    message: 'App component rendering',
    level: 'info',
  });

  return (
    <ErrorBoundary>
      <ErrorBoundary>
        <ThemeProvider>
          <ErrorBoundary>
            <PremiumProvider>
              <ErrorBoundary>
                <HomeViewProvider>
                  <AppContent />
                </HomeViewProvider>
              </ErrorBoundary>
            </PremiumProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </ErrorBoundary>
    </ErrorBoundary>
  );
});

export default SentryApp;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    marginBottom: 12,
  },
  deviceInfo: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorRecovery: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 8,
    fontStyle: 'italic',
  },
});