/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {
    colors: {
      theme: {
        bg: 'rgb(var(--color-bg-primary) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--color-bg-secondary) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--color-bg-elevated) / <alpha-value>)',
        text: 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)'
      },
      neural: {
        blue: 'rgb(var(--color-neural-blue) / <alpha-value>)',
        red: 'rgb(var(--color-neural-red) / <alpha-value>)',
        green: 'rgb(var(--color-neural-green) / <alpha-value>)'
      },
      stimulus: { white: 'rgb(var(--color-stimulus-white) / <alpha-value>)' }
    },
    borderRadius: { lab: '0.5rem' },
    fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'monospace'] }
  }},
  plugins: []
};
