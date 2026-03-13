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
