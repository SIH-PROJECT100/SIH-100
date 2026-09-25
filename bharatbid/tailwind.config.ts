import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mode A — Government Formal
        navy: {
          900: '#0F2942',
          700: '#1E3A5F',
          100: '#E8EEF4',
        },
        saffron: {
          600: '#C56B2E',
          500: '#D97F42',
          100: '#F7E8D9',
        },
        cream: {
          50: '#F7F4EF',
          100: '#EDE8DE',
        },
        paper: '#FFFFFF',
        ink: {
          900: '#1A1614',
          700: '#443C36',
          500: '#7A6E63',
          300: '#C9BFB4',
        },
        line: '#E5DDD1',
        // Semantic risk
        risk: {
          critical: '#A3372E',
          high: '#C25B2E',
          medium: '#B58A2E',
          low: '#4A7A4E',
        },
        // Trust badges
        trust: {
          digilocker: '#1F5CA8',
          portal: '#3E5F8A',
          ai: '#6B4A8F',
          simulated: '#8A7F73',
        },
        // Mode B — Bloomberg Terminal
        terminal: {
          bg: '#0C0F14',
          panel: '#131820',
          line: '#232B38',
          text: '#D4CDBF',
          dim: '#7A7268',
          accent: '#E8B15C',
          flag: '#E86D5C',
          verify: '#7CB37C',
        },
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Source Serif Pro', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
        hindi: ['Noto Sans Devanagari', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.125rem' }],
        'sm':   ['0.875rem',  { lineHeight: '1.25rem' }],
        'base': ['1rem',      { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem',  { lineHeight: '1.625rem' }],
        'xl':   ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',    { lineHeight: '2rem' }],
        '3xl':  ['1.875rem',  { lineHeight: '2.25rem' }],
        '4xl':  ['2.25rem',   { lineHeight: '2.5rem' }],
        display: ['2.25rem', { lineHeight: '1.25' }],
        h1: ['1.875rem', { lineHeight: '1.25' }],
        h2: ['1.5rem', { lineHeight: '1.25' }],
        h3: ['1.25rem', { lineHeight: '1.25' }],
        body: ['1rem', { lineHeight: '1.5' }],
        small: ['0.875rem', { lineHeight: '1.25' }],
        micro: ['0.8125rem', { lineHeight: '1.125rem' }],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(26, 22, 20, 0.04)',
        md: '0 2px 6px -1px rgba(26, 22, 20, 0.06), 0 1px 3px -1px rgba(26, 22, 20, 0.04)',
        lg: '0 8px 20px -4px rgba(26, 22, 20, 0.08), 0 4px 8px -2px rgba(26, 22, 20, 0.04)',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        normal: '180ms',
        slow: '280ms',
      },
      maxWidth: {
        shell: '1440px',
        drawer: '720px',
      },
    },
  },
  plugins: [forms],
}

export default config
