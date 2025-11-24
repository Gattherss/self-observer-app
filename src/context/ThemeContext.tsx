import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'cyberpunk' | 'zen' | 'minimalist' | 'neon' | 'sunset' | 'forest' | 'ocean' | 'coffee' | 'white' | 'darkgrey' | 'aurora';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    fontScale: number;
    setFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('app-theme');
        return (saved as Theme) || 'cyberpunk';
    });
    const [fontScale, setFontScale] = useState<number>(() => {
        const saved = localStorage.getItem('app-font-scale');
        return saved ? Number(saved) || 1 : 1;
    });

    useEffect(() => {
        localStorage.setItem('app-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('app-font-scale', String(fontScale));
        const base = 16 * fontScale;
        document.documentElement.style.fontSize = `${base}px`;
    }, [fontScale]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, fontScale, setFontScale }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
