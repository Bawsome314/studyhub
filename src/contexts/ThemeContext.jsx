import { createContext, useContext, useState, useEffect } from 'react';

const THEMES = [
  // Light row
  { id: 'light', name: 'Light', preview: '#2563eb', bg: '#f8f9fb', accent: '#2563eb', row: 'light' },
  { id: 'slate', name: 'Slate', preview: '#4a7ab5', bg: '#dce2ea', accent: '#4a7ab5', row: 'light' },
  { id: 'strawberry', name: 'Strawberries & Cream', preview: '#e8829a', bg: '#fef9f6', accent: '#e8829a', row: 'light' },
  // Dark row
  { id: 'dark', name: 'Dark', preview: '#3b82f6', bg: '#121214', accent: '#3b82f6', row: 'dark' },
  { id: 'midnight', name: 'Midnight', preview: '#8b5cf6', bg: '#0a0c18', accent: '#8b5cf6', row: 'dark' },
  { id: 'charcoal', name: 'Charcoal', preview: '#f97316', bg: '#0f0f0f', accent: '#f97316', row: 'dark' },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('studyhub-theme') || 'midnight';
    // Migrate old themes that no longer exist
    const validIds = THEMES.map(t => t.id);
    return validIds.includes(stored) ? stored : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studyhub-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
