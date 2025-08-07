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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_settings')
                .select('default_calendar_view')
                .eq('user_id', user.id)
                .single();

            if (!error && data) {
                setDefaultToCalendarViewState(data.default_calendar_view || false);
            }
        } catch (error) {
            console.error('Error loading home view preference:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const setDefaultToCalendarView = async (enabled: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('user_settings')
                .update({ default_calendar_view: enabled })
                .eq('user_id', user.id);

            if (error) throw error;

            setDefaultToCalendarViewState(enabled);
            console.log(`🗓️ Default calendar view ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error updating home view preference:', error);
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