import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        display: ['Orbitron', 'monospace'],
      },
      colors: {
        // Custom near-black charcoal gray scale — zero blue cast,
        // biased very dark so surfaces sit close to the black background.
        gray: {
          50:  '#fafafa',
          100: '#efefef',
          200: '#d4d4d4',
          300: '#a8a8ae',
          400: '#8a8a90',
          500: '#636369',
          600: '#3d3d44',
          700: '#252530',
          800: '#161619',
          900: '#0e0e12',
          950: '#080809',
        },
        space: {
          bg: '#0A0A0F',
          hull: '#4A4E54',
          panel: '#555A61',
          ground: '#2A2D32',
          pipe: '#8B1A1A',
          pipeCap: '#A02020',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
