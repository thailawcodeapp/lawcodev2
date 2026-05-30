/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper:       '#ece4d4',
        'paper-dk':  '#d8cdb4',
        card:        '#f4ecda',
        ink:         '#10110f',
        'ink-soft':  '#5a5547',
        rule:        '#1d1c19',
        'rule-soft': '#bdb19a',
        accent:      '#a93225',
        ochre:       '#c08a2a',
        'ink-2':     '#22201a',
        // dark mode surface
        'dark-bg':   '#0f0e0c',
        'dark-card': '#1a1914',
      },
      fontFamily: {
        display: ["'Trirong'", 'Georgia', 'serif'],
        serif:   ["'Trirong'", 'Georgia', 'serif'],
        ui:      ["'Sarabun'", 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
