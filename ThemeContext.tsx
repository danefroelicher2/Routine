import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "./src/services/supabase";

interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;

  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;

  // UI elements
  border: string;
  separator: string;
  placeholder: string;

  // Status bar
  statusBar: "light-content" | "dark-content";
}

interface ThemeContextType {
  isDarkMode: boolean;
  colors: ThemeColors;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
}

const lightTheme: ThemeColors = {
  background: "#f8f9fa",
  surface: "#ffffff",
  card: "#ffffff",
  text: "#333333",
  textSecondary: "#666666",
  textTertiary: "#999999",
  border: "#e9ecef",
  separator: "#f0f0f0",
  placeholder: "#999999",
  statusBar: "dark-content",
};

const darkTheme: ThemeColors = {
  background: "#000000",
  surface: "#1c1c1e",
  card: "#2c2c2e",
  text: "#ffffff",
  textSecondary: "#8e8e93",
  textTertiary: "#636366",
  border: "#2c2c2e",
  separator: "#3c3c3e",
  placeholder: "#8e8e93",
  statusBar: "light-content",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkModeState] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      console.log("🎨 Loading theme preference with timeout protection...");

      // CRITICAL FIX: Add 5-second timeout to prevent iPad hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Theme load timeout')), 5000)
      );

      const userPromise = supabase.auth.getUser();

      let userResult;
      try {
        userResult = await Promise.race([userPromise, timeoutPromise]);
      } catch (timeoutError) {
        console.warn("⚠️ Theme load timed out after 5 seconds - using default theme");
        // Use default theme (light mode) and retry in background
        setTimeout(() => retryThemeLoad(), 2000);
        return;
      }

      const { data: { user } } = userResult;
      if (!user) {
        console.log("❌ No user found for theme preference");
        return;
      }

      // Add timeout to database query as well
      const settingsTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Settings query timeout')), 3000)
      );

      const settingsPromise = supabase
        .from("user_settings")
        .select("dark_mode")
        .eq("user_id", user.id)
        .single();

      let settingsResult;
      try {
        settingsResult = await Promise.race([settingsPromise, settingsTimeoutPromise]);
      } catch (settingsTimeoutError) {
        console.warn("⚠️ Theme settings query timed out - using default theme");
        return;
      }

      const { data, error } = settingsResult;
      if (!error && data) {
        setIsDarkModeState(data.dark_mode || false);
        console.log(`✅ Theme preference loaded: ${data.dark_mode ? 'dark' : 'light'} mode`);
      } else if (error) {
        console.error("❌ Error loading theme from database:", error);
      }

    } catch (error) {
      console.error("❌ Error loading theme preference:", error);
      // Graceful fallback - app continues with default light theme
    }
  };

  const retryThemeLoad = async () => {
    try {
      console.log("🔄 Retrying theme load in background...");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("dark_mode")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setIsDarkModeState(data.dark_mode || false);
        console.log(`✅ Theme preference loaded on retry: ${data.dark_mode ? 'dark' : 'light'} mode`);
      }
    } catch (retryError) {
      console.error("❌ Theme retry failed (gracefully):", retryError);
      // Silent failure - app continues with current theme
    }
  };

  const setDarkMode = async (enabled: boolean) => {
    try {
      // Update local state immediately for responsive UI
      setIsDarkModeState(enabled);

      // Add timeout protection to theme update as well
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Theme update timeout')), 5000)
      );

      const userPromise = supabase.auth.getUser();

      let userResult;
      try {
        userResult = await Promise.race([userPromise, timeoutPromise]);
      } catch (timeoutError) {
        console.warn("⚠️ Theme update timed out - local change preserved");
        return;
      }

      const { data: { user } } = userResult;
      if (!user) {
        console.log("❌ No user found for theme update");
        return;
      }

      // Add timeout to database update
      const updateTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database update timeout')), 3000)
      );

      const updatePromise = supabase
        .from("user_settings")
        .update({ dark_mode: enabled })
        .eq("user_id", user.id);

      try {
        const { error } = await Promise.race([updatePromise, updateTimeoutPromise]);
        if (error) throw error;
        console.log(`✅ Theme preference saved: ${enabled ? 'dark' : 'light'} mode`);
      } catch (updateError) {
        console.warn("⚠️ Theme database update failed - local change preserved:", updateError);
        // Local state is already updated, so user sees immediate change
      }

    } catch (error) {
      console.error("❌ Error updating theme preference:", error);
      // Keep local state change even if database update fails
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode);
  };

  const colors = isDarkMode ? darkTheme : lightTheme;

  const value: ThemeContextType = {
    isDarkMode,
    colors,
    toggleDarkMode,
    setDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
