import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "../services/supabase";

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("dark_mode")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setIsDarkModeState(data.dark_mode || false);
      }
    } catch (error) {
      console.error("Error loading theme preference:", error);
    }
  };

  const setDarkMode = async (enabled: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Update database
      const { error } = await supabase
        .from("user_settings")
        .update({ dark_mode: enabled })
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setIsDarkModeState(enabled);
    } catch (error) {
      console.error("Error updating theme preference:", error);
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
