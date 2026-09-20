/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Every colour resolves to a CSS variable so the light and dark
        // themes are one system rather than two stylesheets.
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        amber: {
          DEFAULT: 'rgb(var(--amber) / <alpha-value>)',
          deep: 'rgb(var(--amber-deep) / <alpha-value>)',
          wash: 'rgb(var(--amber-wash) / <alpha-value>)',
        },
        healthy: 'rgb(var(--healthy) / <alpha-value>)',
        'healthy-wash': 'rgb(var(--healthy-wash) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-wash': 'rgb(var(--warning-wash) / <alpha-value>)',
        critical: 'rgb(var(--critical) / <alpha-value>)',
        'critical-wash': 'rgb(var(--critical-wash) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-wash': 'rgb(var(--info-wash) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // A modular scale at 1.25, so headings relate to each other.
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        tiny: ['0.75rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        body: ['0.9375rem', { lineHeight: '1.55rem' }],
        lead: ['1.0625rem', { lineHeight: '1.7rem' }],
        h4: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em' }],
        h3: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.016em' }],
        h2: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.021em' }],
        h1: ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.028em' }],
        display: ['clamp(2.75rem, 6.4vw, 5.25rem)', { lineHeight: '0.96', letterSpacing: '-0.035em' }],
        metric: ['2.125rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em' }],
      },
      borderRadius: { panel: '10px', control: '7px', pill: '999px' },
      boxShadow: {
        // Reserved for things that genuinely float above the page.
        overlay: '0 1px 2px rgb(var(--shadow) / 0.06), 0 12px 32px -8px rgb(var(--shadow) / 0.18)',
        popover: '0 1px 2px rgb(var(--shadow) / 0.05), 0 6px 16px -4px rgb(var(--shadow) / 0.14)',
        lift: '0 2px 6px -2px rgb(var(--shadow) / 0.10)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        'caret-blink': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'caret-blink': 'caret-blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
}
