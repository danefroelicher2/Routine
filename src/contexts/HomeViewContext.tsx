import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface HomeViewContextType {
    defaultToCalendarView: boolean;
    setDefaultToCalendarView: (enabled: boolean) => void;
    isLoading: boolean;
}

const HomeViewContext = createContext<HomeViewContextType | undefined>(undefined);

interface HomeViewProviderProps {
    children: React.ReactNode;
}

export const HomeViewProvider: React.FC<HomeViewProviderProps> = ({ children }) => {
    const [defaultToCalendarView, setDefaultToCalendarViewState] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHomeViewPreference();
    }, []);

    const loadHomeViewPreference = async () => {
        try {
            console.log("🏠 Loading home view preference with timeout protection...");

            // CRITICAL FIX: Add 5-second timeout to prevent iPad hanging
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Home view load timeout')), 5000)
            );

            const userPromise = supabase.auth.getUser();

            let userResult;
            try {
                userResult = await Promise.race([userPromise, timeoutPromise]);
            } catch (timeoutError) {
                console.warn("⚠️ Home view load timed out after 5 seconds - using default view");
                // Use default view state and retry in background
                setTimeout(() => retryHomeViewLoad(), 2000);
                setIsLoading(false);
                return;
            }

            const { data: { user } } = userResult;
            if (!user) {
                console.log("❌ No user found for home view preference");
                setIsLoading(false);
                return;
            }

            // Add timeout to database query as well
            const settingsTimeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Settings query timeout')), 3000)
            );

            const settingsPromise = supabase
                .from('user_settings')
                .select('default_calendar_view')
                .eq('user_id', user.id)
                .single();

            let settingsResult;
            try {
                settingsResult = await Promise.race([settingsPromise, settingsTimeoutPromise]);
            } catch (settingsTimeoutError) {
                console.warn("⚠️ Home view settings query timed out - using default view");
                setIsLoading(false);
                return;
            }

            const { data, error } = settingsResult;
            if (!error && data) {
                setDefaultToCalendarViewState(data.default_calendar_view || false);
                console.log(`✅ Home view preference loaded: ${data.default_calendar_view ? 'calendar' : 'list'} view`);
            } else if (error) {
                console.error("❌ Error loading home view from database:", error);
            }

        } catch (error) {
            console.error('❌ Error loading home view preference:', error);
            // Graceful fallback - app continues with default view
        } finally {
            setIsLoading(false);
        }
    };

    const retryHomeViewLoad = async () => {
        try {
            console.log("🔄 Retrying home view load in background...");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_settings')
                .select('default_calendar_view')
                .eq('user_id', user.id)
                .single();

            if (!error && data) {
                setDefaultToCalendarViewState(data.default_calendar_view || false);
                console.log(`✅ Home view preference loaded on retry: ${data.default_calendar_view ? 'calendar' : 'list'} view`);
            }
        } catch (retryError) {
            console.error("❌ Home view retry failed (gracefully):", retryError);
            // Silent failure - app continues with current view
        }
    };

    const setDefaultToCalendarView = async (enabled: boolean) => {
        try {
            // Update local state immediately for responsive UI
            setDefaultToCalendarViewState(enabled);

            // Add timeout protection to view update as well
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Home view update timeout')), 5000)
            );

            const userPromise = supabase.auth.getUser();

            let userResult;
            try {
                userResult = await Promise.race([userPromise, timeoutPromise]);
            } catch (timeoutError) {
                console.warn("⚠️ Home view update timed out - local change preserved");
                return;
            }

            const { data: { user } } = userResult;
            if (!user) {
                console.log("❌ No user found for home view update");
                return;
            }

            // Add timeout to database update
            const updateTimeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Database update timeout')), 3000)
            );

            const updatePromise = supabase
                .from('user_settings')
                .update({ default_calendar_view: enabled })
                .eq('user_id', user.id);

            try {
                const { error } = await Promise.race([updatePromise, updateTimeoutPromise]);
                if (error) throw error;
                console.log(`✅ Home view preference saved: ${enabled ? 'calendar' : 'list'} view`);
            } catch (updateError) {
                console.warn("⚠️ Home view database update failed - local change preserved:", updateError);
                // Local state is already updated, so user sees immediate change
            }

        } catch (error) {
            console.error('❌ Error updating home view preference:', error);
            // Keep local state change even if database update fails
        }
    };

    const value: HomeViewContextType = {
        defaultToCalendarView,
        setDefaultToCalendarView,
        isLoading,
    };

    return (
        <HomeViewContext.Provider value={value}>
            {children}
        </HomeViewContext.Provider>
    );
};

export const useHomeView = (): HomeViewContextType => {
    const context = useContext(HomeViewContext);
    if (context === undefined) {
        throw new Error('useHomeView must be used within a HomeViewProvider');
    }
    return context;
};

export default HomeViewContext;