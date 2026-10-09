/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        md3: {
          primary: 'var(--md-sys-color-primary)',
          'on-primary': 'var(--md-sys-color-on-primary)',
          'primary-container': 'var(--md-sys-color-primary-container)',
          'on-primary-container': 'var(--md-sys-color-on-primary-container)',
          secondary: 'var(--md-sys-color-secondary)',
          'on-secondary': 'var(--md-sys-color-on-secondary)',
          'secondary-container': 'var(--md-sys-color-secondary-container)',
          'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',
          tertiary: 'var(--md-sys-color-tertiary)',
          'on-tertiary': 'var(--md-sys-color-on-tertiary)',
          'tertiary-container': 'var(--md-sys-color-tertiary-container)',
          'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',
          background: 'var(--md-sys-color-background)',
          'on-background': 'var(--md-sys-color-on-background)',
          surface: 'var(--md-sys-color-surface)',
          'on-surface': 'var(--md-sys-color-on-surface)',
          'surface-variant': 'var(--md-sys-color-surface-variant)',
          'on-surface-variant': 'var(--md-sys-color-on-surface-variant)',
          'surface-container-lowest': 'var(--md-sys-color-surface-container-lowest)',
          'surface-container-low': 'var(--md-sys-color-surface-container-low)',
          'surface-container': 'var(--md-sys-color-surface-container)',
          'surface-container-high': 'var(--md-sys-color-surface-container-high)',
          'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',
          outline: 'var(--md-sys-color-outline)',
          'outline-variant': 'var(--md-sys-color-outline-variant)',
        },
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '28px',
      },
      fontFamily: {
        sans: [
          'Google Sans',
          'Roboto',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
