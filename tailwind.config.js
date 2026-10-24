import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/**
 * Theming: the slate scale, white, canvas and the accent shades the app uses are CSS
 * variables ("R G B" channels, so opacity modifiers like bg-white/90 keep working).
 * Light values are the original palette; dark values are generated here and emitted
 * under `.dark` by the plugin at the bottom. Components keep using the plain
 * slate, white and emerald utility classes and flip automatically.
 */
const LIGHT_SLATE = {
  950: '#0b1c30', 900: '#0f172a', 800: '#1e293b', 700: '#334155', 600: '#475569',
  500: '#64748b', 400: '#94a3b8', 300: '#cbd5e1', 200: '#e2e8f0', 100: '#f1f5f9', 50: '#f8fafc',
};
const DARK_SLATE = {
  950: '#f8fafc', 900: '#f1f5f9', 800: '#dbe3ee', 700: '#c3cddc', 600: '#a9b6ca',
  500: '#94a3b8', 400: '#7c8aa5', 300: '#3b4a68', 200: '#2a3850', 100: '#1f2b42', 50: '#182235',
};
const LIGHT_SURFACE = { white: '#ffffff', canvas: '#f5f7f9' };
const DARK_SURFACE = { white: '#111a2b', canvas: '#0a101c' };

// Accent hues: dark shade s takes the light value of its mirror shade (50<->950, 100<->900, ...)
// except 500/600, which stay mid-tone so white-on-fill buttons keep their contrast.
const ACCENT_HUES = ['emerald', 'amber', 'red', 'indigo'];
const ACCENT_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const DARK_SHADE_SOURCE = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 400, 600: 500, 700: 300, 800: 200, 900: 100, 950: 50 };

const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const themeVar = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const accentColors = Object.fromEntries(
  ACCENT_HUES.map((hue) => [hue, Object.fromEntries(ACCENT_SHADES.map((s) => [s, themeVar(`${hue}-${s}`)]))])
);

const lightVars = {};
const darkVars = {};
for (const [s, hex] of Object.entries(LIGHT_SLATE)) lightVars[`--c-slate-${s}`] = channels(hex);
for (const [s, hex] of Object.entries(DARK_SLATE)) darkVars[`--c-slate-${s}`] = channels(hex);
for (const [k, hex] of Object.entries(LIGHT_SURFACE)) lightVars[`--c-${k}`] = channels(hex);
for (const [k, hex] of Object.entries(DARK_SURFACE)) darkVars[`--c-${k}`] = channels(hex);
for (const hue of ACCENT_HUES) {
  for (const s of ACCENT_SHADES) {
    lightVars[`--c-${hue}-${s}`] = channels(defaultColors[hue][s]);
    darkVars[`--c-${hue}-${s}`] = channels(defaultColors[hue][DARK_SHADE_SOURCE[s]]);
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Material & Editorial Surface Design Tokens from DESIGN.md & Stitch templates
        surface: '#f8fafc',
        'surface-dim': '#cbdbf5',
        'surface-bright': '#f8fafc',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'surface-variant': '#d3e4fe',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#464555',
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',
        outline: '#777587',
        'outline-variant': '#c7c4d8',
        'surface-tint': '#4d44e3',
        background: '#f8fafc',
        'on-background': '#0b1c30',

        // Primary Brand Colors
        primary: '#3525cd',
        'on-primary': '#ffffff',
        'primary-container': '#4f46e5',
        'on-primary-container': '#dad7ff',
        'inverse-primary': '#c3c0ff',
        'primary-fixed': '#e2dfff',
        'primary-fixed-dim': '#c3c0ff',
        'on-primary-fixed': '#0f0069',
        'on-primary-fixed-variant': '#3323cc',

        // Secondary Slate Tokens
        secondary: '#565e74',
        'on-secondary': '#ffffff',
        'secondary-container': '#dae2fd',
        'on-secondary-container': '#5c647a',
        'secondary-fixed': '#dae2fd',
        'secondary-fixed-dim': '#bec6e0',
        'on-secondary-fixed': '#131b2e',
        'on-secondary-fixed-variant': '#3f465c',

        // Tertiary / Live Broadcast Tokens
        tertiary: '#00505f',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#006a7c',
        'on-tertiary-container': '#93e8ff',
        'tertiary-fixed': '#acedff',
        'tertiary-fixed-dim': '#4cd7f6',
        'on-tertiary-fixed': '#001f26',
        'on-tertiary-fixed-variant': '#004e5c',

        // Error Feedback Tokens
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // High-precision Hairline & Divider Tokens (DESIGN.md)
        hairline: '#e2e8f0',
        'hairline-subtle': '#f1f5f9',
        'hairline-hover': '#cbd5e1',
        slate: Object.fromEntries(Object.keys(LIGHT_SLATE).map((s) => [s, themeVar(`slate-${s}`)])),
        ...accentColors,
        white: themeVar('white'),
        canvas: themeVar('canvas'),
        'white-fixed': '#ffffff', // stays white in both themes (text on coloured fills)
      },
      borderRadius: {
        DEFAULT: '0.25rem', // 4px
        sm: '0.25rem',      // 4px
        md: '0.625rem',     // 10px (interactive inputs)
        lg: '0.75rem',      // 12px (nested panels)
        card: '16px',       // 16px card border-radius (DESIGN.md / NFR)
        xl: '1rem',         // 16px (1rem)
        '2xl': '16px',      // 16px rounded-2xl (consistent with 16px card geometry)
        '3xl': '1.5rem',    // 24px
        full: '9999px',     // badges & pills
      },
      spacing: {
        gutter: '1.5rem',
        'gutter-mobile': '1rem',
        margin: '2rem',
        'margin-mobile': '1rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        'display-hero': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'display-hero-mobile': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-lg': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-lg-mobile': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-md': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'body-lg': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'body-md': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'body-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'label-md': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'label-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'code-inline': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-hero': ['48px', { lineHeight: '56px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-hero-mobile': ['32px', { lineHeight: '40px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '22px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        'label-md': ['13px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.03em', fontWeight: '600' }],
        'code-inline': ['12px', { lineHeight: '16px', letterSpacing: '-0.01em', fontWeight: '500' }],
      },
      boxShadow: {
        // High fidelity multi-stop shadows from DESIGN.md
        card: '0 1px 2px -1px rgba(15, 23, 42, 0.04), 0 3px 8px -2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 6px -2px rgba(15, 23, 42, 0.03), 0 12px 24px -4px rgba(15, 23, 42, 0.07)',
        dialog: '0 0 0 1px rgba(15, 23, 42, 0.05), 0 12px 32px -8px rgba(15, 23, 42, 0.12), 0 24px 64px -16px rgba(15, 23, 42, 0.08)',
        subtle: '0 1px 8px rgba(0, 0, 0, 0.04)',
        'subtle-sm': '0 1px 4px rgba(0, 0, 0, 0.03)',
        'primary-glow': '0 2px 8px rgba(79, 70, 229, 0.25)',
        'auth-card': '0 20px 45px -15px rgba(11, 28, 48, 0.08), 0 1px 3px rgba(11, 28, 48, 0.04)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': lightVars, '.dark': { ...darkVars, 'color-scheme': 'dark' } });
    }),
  ],
};
