/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        md3: {
          primary: 'rgb(var(--md-sys-color-primary-rgb) / <alpha-value>)',
          'on-primary': 'rgb(var(--md-sys-color-on-primary-rgb) / <alpha-value>)',
          'primary-container': 'rgb(var(--md-sys-color-primary-container-rgb) / <alpha-value>)',
          'on-primary-container': 'rgb(var(--md-sys-color-on-primary-container-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--md-sys-color-secondary-rgb) / <alpha-value>)',
          'on-secondary': 'rgb(var(--md-sys-color-on-secondary-rgb) / <alpha-value>)',
          'secondary-container': 'rgb(var(--md-sys-color-secondary-container-rgb) / <alpha-value>)',
          'on-secondary-container': 'rgb(var(--md-sys-color-on-secondary-container-rgb) / <alpha-value>)',
          tertiary: 'rgb(var(--md-sys-color-tertiary-rgb) / <alpha-value>)',
          'on-tertiary': 'rgb(var(--md-sys-color-on-tertiary-rgb) / <alpha-value>)',
          'tertiary-container': 'rgb(var(--md-sys-color-tertiary-container-rgb) / <alpha-value>)',
          'on-tertiary-container': 'rgb(var(--md-sys-color-on-tertiary-container-rgb) / <alpha-value>)',
          background: 'rgb(var(--md-sys-color-background-rgb) / <alpha-value>)',
          'on-background': 'rgb(var(--md-sys-color-on-background-rgb) / <alpha-value>)',
          surface: 'rgb(var(--md-sys-color-surface-rgb) / <alpha-value>)',
          'on-surface': 'rgb(var(--md-sys-color-on-surface-rgb) / <alpha-value>)',
          'surface-variant': 'rgb(var(--md-sys-color-surface-variant-rgb) / <alpha-value>)',
          'on-surface-variant': 'rgb(var(--md-sys-color-on-surface-variant-rgb) / <alpha-value>)',
          'surface-container-lowest': 'rgb(var(--md-sys-color-surface-container-lowest-rgb) / <alpha-value>)',
          'surface-container-low': 'rgb(var(--md-sys-color-surface-container-low-rgb) / <alpha-value>)',
          'surface-container': 'rgb(var(--md-sys-color-surface-container-rgb) / <alpha-value>)',
          'surface-container-high': 'rgb(var(--md-sys-color-surface-container-high-rgb) / <alpha-value>)',
          'surface-container-highest': 'rgb(var(--md-sys-color-surface-container-highest-rgb) / <alpha-value>)',
          outline: 'rgb(var(--md-sys-color-outline-rgb) / <alpha-value>)',
          'outline-variant': 'rgb(var(--md-sys-color-outline-variant-rgb) / <alpha-value>)',
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
