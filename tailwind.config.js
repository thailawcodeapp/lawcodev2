/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  // Only apply `hover:` styles on devices that actually support hover (mouse/
  // trackpad). Fixes the iOS/iPad "sticky tap" bug where the tapped coordinate
  // kept a phantom :hover background on the next screen. Touch taps no longer
  // trigger hover states; desktop/web hover is unchanged.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Every colour is a CSS variable holding "R G B", so one class list
      // serves both themes: :root in index.css sets Classic, and
      // html.theme-wave in styles/wave.css overrides it. <alpha-value> keeps
      // modifiers such as bg-paper-dk/30 working.
      colors: {
        paper:       'rgb(var(--c-paper) / <alpha-value>)',
        'paper-dk':  'rgb(var(--c-paper-dk) / <alpha-value>)',
        card:        'rgb(var(--c-card) / <alpha-value>)',
        ink:         'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft':  'rgb(var(--c-ink-soft) / <alpha-value>)',
        rule:        'rgb(var(--c-rule) / <alpha-value>)',
        'rule-soft': 'rgb(var(--c-rule-soft) / <alpha-value>)',
        accent:      'rgb(var(--c-accent) / <alpha-value>)',
        ochre:       'rgb(var(--c-ochre) / <alpha-value>)',
        'ink-2':     'rgb(var(--c-ink-2) / <alpha-value>)',
        // dark mode surface
        'dark-bg':   'rgb(var(--c-dark-bg) / <alpha-value>)',
        'dark-card': 'rgb(var(--c-dark-card) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--f-display)'],
        serif:   ['var(--f-serif)'],
        ui:      ['var(--f-ui)'],
        body:    ['var(--f-body)'],
      },
    },
  },
  plugins: [],
};
