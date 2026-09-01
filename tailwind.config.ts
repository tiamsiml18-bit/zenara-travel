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
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        harbor: {
          50: '#F7F8FC',
          100: '#E9EBFF',
          200: '#d0d2f1',
          400: '#8389d8',
          500: '#666dcc',
          600: '#5961C7',
          700: '#3841b2',
          800: '#2b3282',
          900: '#222659',
          950: '#181a3a',
        },
        sand: {
          50: '#F8F9FC',
          100: '#f0f2f4',
          200: '#E5E7EB',
        },
        coral: {
          500: '#F47B73',
          600: '#ee584f',
        },
        ink: {
          900: '#374151',
          700: '#576275',
          500: '#7e899a',
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
