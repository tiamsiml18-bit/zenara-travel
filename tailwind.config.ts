import type { Config } from 'tailwindcss';

// Zenara design tokens
// Palette: a Warm Ember / Caramel brand identity for a professional
// travel-operations CRM (color-system revision; Deep Navy + Blue, Teal
// + Navy, and a brighter teal/Deep-Ocean attempt were all tried and
// superseded by this version). The four brand anchors sit at
// meaningful points in the harbor scale: harbor-400 = Caramel (#E9B48A,
// soft highlights/active backgrounds — placed where the only consumers
// are focus rings/borders, never body text), harbor-500 = Warm Taupe
// (#956959, secondary accents), harbor-700 = Deep Brown (#5C352C,
// PRIMARY — buttons, active states, important numbers), harbor-950 =
// Dark Espresso (#2A1713, strongest structural tone, also reused
// directly as ink-900/Primary Text and sidebar-bg). "coral" is used
// sparingly, for alerts, destructive actions, and one accent highlight
// only — never a UI-wide color; "sand" is the light warm-neutral
// background/border family; "ink" is body text.
//
// "sidebar" is a small, dedicated family for the one permanently-dark
// surface in this interface (Dark Espresso #2A1713) — harbor-50/ink-900
// stay reserved for their existing light-context roles elsewhere in
// the app (11+ other places use them as light tints/text), so the
// sidebar's dark surface needed its own tokens rather than repointing
// shared ones. Same pattern already established by success/warning: a
// focused family for one specific need, not a second general-purpose
// system.
//
// "success" and "warning" needed no changes: the specified Success
// (#15803D) and Warning (#B45309) are already exactly Tailwind's
// green-700/amber-700, which success-700/warning-700 already resolved
// to from the Phase 1 design-token foundation. Coral is unchanged too —
// it wasn't named in this palette, so it wasn't touched.
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
        sidebar: {
          bg: 'rgb(var(--sidebar-bg) / <alpha-value>)',
          hover: 'rgb(var(--sidebar-hover) / <alpha-value>)',
          active: 'rgb(var(--sidebar-active) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
          text: 'rgb(var(--sidebar-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--sidebar-text-muted) / <alpha-value>)',
          'active-text': 'rgb(var(--sidebar-active-text) / <alpha-value>)',
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
