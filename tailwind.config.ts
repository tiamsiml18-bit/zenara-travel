import type { Config } from 'tailwindcss';

// Zenara design tokens
// Palette: a restrained Teal + Navy identity for a professional travel
// operations CRM (color-system revision — brighter teal/Deep-Ocean and
// dark-mode-specific attempts were tried and superseded by this
// version). Every anchor value below (harbor-600 = Primary Hover
// #115E59, harbor-700 = Primary Teal #0F766E, harbor-950 = Deep Navy
// Blue #17324D, coral-500 = Accent Coral #E76F51, ink-900 = Primary
// Text #1F2937, ink-500 = Secondary Text #64748B, sand-50 = Page
// Background #F8FAFC, sand-200 = Border #E2E8F0) is the exact hex
// specified; the intermediate steps were computed to progress sensibly
// between them. "Harbor" is the primary brand color used for buttons,
// links, active states, and important numbers; "coral" is used
// sparingly, for alerts, destructive actions, and one accent highlight
// only — never a UI-wide color; "sand" is the light neutral
// background/border family; "ink" is body text.
//
// "success" and "warning" needed no changes: the specified Success
// (#15803D) and Warning (#B45309) are already exactly Tailwind's
// green-700/amber-700, which success-700/warning-700 already resolved
// to from the Phase 1 design-token foundation.
//
// Dark mode has been removed entirely — there is no .dark CSS-variable
// block (see globals.css), no theme toggle, and no next-themes
// provider anywhere in the app. Light Mode is the only theme, so
// darkMode is no longer configured here. Every color below still
// resolves through a CSS variable defined in globals.css rather than a
// static hex, purely so every component only needs to change once if
// the palette is ever revised again. "surface" is the card/panel
// background (white).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        harbor: {
          50: 'rgb(var(--harbor-50) / <alpha-value>)',
          100: 'rgb(var(--harbor-100) / <alpha-value>)',
          200: 'rgb(var(--harbor-200) / <alpha-value>)',
          400: 'rgb(var(--harbor-400) / <alpha-value>)',
          500: 'rgb(var(--harbor-500) / <alpha-value>)',
          600: 'rgb(var(--harbor-600) / <alpha-value>)',
          700: 'rgb(var(--harbor-700) / <alpha-value>)',
          800: 'rgb(var(--harbor-800) / <alpha-value>)',
          900: 'rgb(var(--harbor-900) / <alpha-value>)',
          950: 'rgb(var(--harbor-950) / <alpha-value>)',
        },
        sand: {
          50: 'rgb(var(--sand-50) / <alpha-value>)',
          100: 'rgb(var(--sand-100) / <alpha-value>)',
          200: 'rgb(var(--sand-200) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        coral: {
          500: 'rgb(var(--coral-500) / <alpha-value>)',
          600: 'rgb(var(--coral-600) / <alpha-value>)',
        },
        success: {
          100: 'rgb(var(--success-100) / <alpha-value>)',
          500: 'rgb(var(--success-500) / <alpha-value>)',
          600: 'rgb(var(--success-600) / <alpha-value>)',
          700: 'rgb(var(--success-700) / <alpha-value>)',
        },
        warning: {
          100: 'rgb(var(--warning-100) / <alpha-value>)',
          500: 'rgb(var(--warning-500) / <alpha-value>)',
          600: 'rgb(var(--warning-600) / <alpha-value>)',
          700: 'rgb(var(--warning-700) / <alpha-value>)',
        },
        ink: {
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,32,32,0.06), 0 1px 1px rgba(12,32,32,0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
