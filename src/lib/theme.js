// Which theme is on, and what follows from it. Classic is today's look; Wave
// is the default for everyone, existing users included (spec 2.1). Settings
// live in AppContext's `lawcode-eng-settings`.

export function resolveTheme(settings) {
  return settings?.theme === 'classic' ? 'classic' : 'wave';
}

export function resolveWaveMode(settings) {
  const m = settings?.waveMode;
  return m === 'light' || m === 'dark' ? m : 'auto';
}

export function systemPrefersDark() {
  try {
    return !!window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

// Wave's dark mode rides on the same `dark` class Classic uses, so every
// screen's dark: classes apply and wave.css only has to recolour them
// (spec 2.2). isDarkMode belongs to Classic and is never touched here.
export function htmlClasses(settings, systemDark) {
  if (resolveTheme(settings) === 'classic') return { wave: false, dark: !!settings?.isDarkMode };
  const mode = resolveWaveMode(settings);
  return { wave: true, dark: mode === 'dark' || (mode === 'auto' && !!systemDark) };
}

export function statusBarColors(settings, systemDark) {
  const { wave, dark } = htmlClasses(settings, systemDark);
  if (wave) return dark ? { color: '#131211', dark: true } : { color: '#F4F2EE', dark: false };
  return dark ? { color: '#0f0e0c', dark: true } : { color: '#ece4d4', dark: false };
}

// The device's own reduce-motion setting. A `reduceMotion` saved by the toggle
// Settings used to have is ignored: nothing could turn it back off now.
export function deviceReducesMotion() {
  try {
    return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
