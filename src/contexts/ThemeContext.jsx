import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEMES = [
  // Light row
  { id: 'light', name: 'Light', preview: '#2563eb', bg: '#f8f9fb', accent: '#2563eb', row: 'light' },
  { id: 'slate', name: 'Slate', preview: '#4a7ab5', bg: '#dce2ea', accent: '#4a7ab5', row: 'light' },
  { id: 'strawberry', name: 'Strawberries & Cream', preview: '#e8829a', bg: '#fef9f6', accent: '#e8829a', row: 'light' },
  { id: 'forest', name: 'Forest', preview: '#4a8c5c', bg: '#f2f5f0', accent: '#4a8c5c', row: 'light' },
  { id: 'lavender', name: 'Lavender', preview: '#7c6aef', bg: '#f5f3ff', accent: '#7c6aef', row: 'light' },
  // Dark row
  { id: 'dark', name: 'Dark', preview: '#3b82f6', bg: '#121214', accent: '#3b82f6', row: 'dark' },
  { id: 'midnight', name: 'Midnight', preview: '#8b5cf6', bg: '#0a0c18', accent: '#8b5cf6', row: 'dark' },
  { id: 'charcoal', name: 'Charcoal', preview: '#f97316', bg: '#0f0f0f', accent: '#f97316', row: 'dark' },
  { id: 'nord', name: 'Nord', preview: '#88c0d0', bg: '#2e3440', accent: '#88c0d0', row: 'dark' },
  { id: 'cyber', name: 'Cyber', preview: '#00ff41', bg: '#0a0a0a', accent: '#00ff41', row: 'dark' },
];

export { THEMES };

// Parse hex to {r,g,b}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// Mix a color toward white or black by a fraction (0-1)
function mix(hex, target, amount) {
  const c = hexToRgb(hex);
  const t = hexToRgb(target);
  const r = Math.round(c.r + (t.r - c.r) * amount);
  const g = Math.round(c.g + (t.g - c.g) * amount);
  const b = Math.round(c.b + (t.b - c.b) * amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Generate full CSS variables from accent color + base mode
function generateCustomVars(accent, base) {
  const { r, g, b } = hexToRgb(accent);

  if (base === 'dark') {
    return {
      '--color-bg-primary': '#101012',
      '--color-bg-secondary': '#1a1a1e',
      '--color-bg-tertiary': '#252529',
      '--color-bg-hover': '#32323a',
      '--color-border': '#3e3e48',
      '--color-text-primary': '#f4f4f5',
      '--color-text-secondary': '#a8a8b0',
      '--color-text-muted': '#707078',
      '--color-accent': accent,
      '--color-accent-hover': mix(accent, '#ffffff', 0.2),
      '--color-accent-muted': `rgba(${r}, ${g}, ${b}, 0.15)`,
      '--color-success': '#22c55e',
      '--color-warning': '#f59e0b',
      '--color-danger': '#ef4444',
      '--color-sidebar': '#0a0a0c',
    };
  } else {
    return {
      '--color-bg-primary': '#f8f9fb',
      '--color-bg-secondary': '#ffffff',
      '--color-bg-tertiary': '#eef0f4',
      '--color-bg-hover': '#e3e6ed',
      '--color-border': '#c8ced8',
      '--color-text-primary': '#111827',
      '--color-text-secondary': '#374151',
      '--color-text-muted': '#6b7280',
      '--color-accent': accent,
      '--color-accent-hover': mix(accent, '#000000', 0.15),
      '--color-accent-muted': `rgba(${r}, ${g}, ${b}, 0.08)`,
      '--color-success': '#059669',
      '--color-warning': '#d97706',
      '--color-danger': '#dc2626',
      '--color-sidebar': '#ffffff',
    };
  }
}

function applyCustomVars(vars) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearCustomVars() {
  const root = document.documentElement;
  const props = [
    '--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary',
    '--color-bg-hover', '--color-border', '--color-text-primary',
    '--color-text-secondary', '--color-text-muted', '--color-accent',
    '--color-accent-hover', '--color-accent-muted', '--color-success',
    '--color-warning', '--color-danger', '--color-sidebar',
  ];
  for (const p of props) root.style.removeProperty(p);
}

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = useState(() => {
    const stored = localStorage.getItem('studyhub-theme') || 'midnight';
    const validIds = [...THEMES.map(t => t.id), 'custom'];
    return validIds.includes(stored) ? stored : 'dark';
  });

  const [customConfig, setCustomConfigRaw] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('studyhub-custom-theme') || '{}');
    } catch { return {}; }
  });

  const setCustomConfig = useCallback((config) => {
    setCustomConfigRaw(config);
    localStorage.setItem('studyhub-custom-theme', JSON.stringify(config));
  }, []);

  const setTheme = useCallback((id) => {
    setThemeRaw(id);
  }, []);

  useEffect(() => {
    if (theme === 'custom' && customConfig.accent) {
      document.documentElement.setAttribute('data-theme', 'custom');
      applyCustomVars(generateCustomVars(customConfig.accent, customConfig.base || 'dark'));
    } else {
      clearCustomVars();
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('studyhub-theme', theme);
  }, [theme, customConfig]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, customConfig, setCustomConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
