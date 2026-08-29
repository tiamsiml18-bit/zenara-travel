import type { Config } from 'tailwindcss';

// Zenara design tokens
// Palette rationale: this is an internal operations tool for a travel agency,
// not a marketing site — it needs to read as calm, trustworthy, and fast to scan
// for hours at a time. "Harbor" (deep blue-teal) evokes travel/water without
// being a cliché tropical palette; "Sand" is the warm neutral background;
// a single coral accent is reserved for follow-up urgency states only,
// so it stays meaningful instead of decorative.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        harbor: {
          50: '#eef5f5',
          100: '#d3e6e6',
          200: '#a7cccc',
          400: '#3f8585',
          500: '#2b6868',
          600: '#215252',
          700: '#1a4141',
          800: '#132f2f',
          900: '#0c2020',
          950: '#081616',
        },
        sand: {
          50: '#faf8f4',
          100: '#f3efe6',
          200: '#e6ddcb',
        },
        coral: {
          500: '#e0693f',
          600: '#c9562f',
        },
        ink: {
          900: '#161b1b',
          700: '#3a4342',
          500: '#6b7473',
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
