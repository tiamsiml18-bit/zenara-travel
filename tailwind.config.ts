import type { Config } from 'tailwindcss';

// Zenara design tokens
// Palette rationale: a light, modern SaaS-style theme built around the
// agency's chosen brand indigo (#5961C7) — not a dark sidebar. Every
// anchor value below (harbor-50/100/600, coral-500, ink-900, sand-50/200)
// is the exact hex specified, not approximated; the intermediate steps
// were computed to progress sensibly between them. "Harbor" is the
// primary brand color used for buttons, links, active states, and
// important numbers; "coral" is used sparingly, for alerts and selected
// highlights only; "sand" is the light neutral background/border family;
// "ink" is body text, several shades lighter than before so the overall
// page reads soft rather than high-contrast-dark.
//
// Every color below resolves through a CSS variable defined in
// globals.css (":root" for light, ".dark" for dark) rather than a static
// hex — this is what makes Dark Mode apply consistently everywhere
// without every component needing its own dark: variant. "surface" is
// new: the card/panel background, white in light mode, dark charcoal in
// dark mode (previously every card just used Tailwind's built-in "white",
// which can't have a dark-mode counterpart the same way).
const config: Config = {
  darkMode: 'class',
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
