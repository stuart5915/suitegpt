import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@app_theme';

export type ThemeMode = 'light' | 'dark';

interface ThemeColors {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    gold: string;
    border: string;
}

export const lightColors: ThemeColors = {
    background: '#FAF6F0',
    surface: '#FFFFFF',
    text: '#2C2C2C',
    textSecondary: '#666666',
    gold: '#C9A962',
    border: '#E5E5E5',
};

export const darkColors: ThemeColors = {
    background: '#121212',
    surface: '#1E1E1E',
    text: '#F5F5F5',
    textSecondary: '#AAAAAA',
    gold: '#C9A962',
    border: '#333333',
};

interface ThemeContextType {
    theme: ThemeMode;
    colors: ThemeColors;
    isDarkMode: boolean;
    toggleTheme: () => void;
    setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<ThemeMode>('light');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    async function loadTheme() {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark' || savedTheme === 'light') {
                setThemeState(savedTheme);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        } finally {
            setIsLoaded(true);
        }
    }

    async function setTheme(newTheme: ThemeMode) {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    }

    function toggleTheme() {
        setTheme(theme === 'light' ? 'dark' : 'light');
    }

    const colors = theme === 'dark' ? darkColors : lightColors;
    const isDarkMode = theme === 'dark';

    // Don't render until theme is loaded to prevent flash
    if (!isLoaded) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, colors, isDarkMode, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
