import { describe, expect, it } from 'vitest';
import { resolveTheme, resolveWaveMode, htmlClasses, statusBarColors, resolveReduceMotion } from './theme.js';

describe('theme', () => {
  it('defaults to Wave; keeps a saved Classic; anything else is Wave', () => {
    expect(resolveTheme({})).toBe('wave');
    expect(resolveTheme(undefined)).toBe('wave');
    expect(resolveTheme({ theme: 'classic' })).toBe('classic');
    expect(resolveTheme({ theme: 'galaxy' })).toBe('wave');
  });

  it('Wave mode defaults to auto', () => {
    expect(resolveWaveMode({})).toBe('auto');
    expect(resolveWaveMode({ waveMode: 'dark' })).toBe('dark');
    expect(resolveWaveMode({ waveMode: 'nonsense' })).toBe('auto');
  });

  it('Wave is dark when chosen, or when auto and the device is dark', () => {
    expect(htmlClasses({}, false)).toEqual({ wave: true, dark: false });
    expect(htmlClasses({}, true)).toEqual({ wave: true, dark: true });
    expect(htmlClasses({ waveMode: 'light' }, true)).toEqual({ wave: true, dark: false });
    expect(htmlClasses({ waveMode: 'dark' }, false)).toEqual({ wave: true, dark: true });
  });

  it('Classic follows isDarkMode and ignores the device', () => {
    expect(htmlClasses({ theme: 'classic', isDarkMode: false }, true)).toEqual({ wave: false, dark: false });
    expect(htmlClasses({ theme: 'classic', isDarkMode: true }, false)).toEqual({ wave: false, dark: true });
    expect(htmlClasses({ theme: 'classic', isDarkMode: false, waveMode: 'dark' }, true)).toEqual({ wave: false, dark: false });
  });

  it('status bar colours', () => {
    expect(statusBarColors({}, false)).toEqual({ color: '#F4F2EE', dark: false });
    expect(statusBarColors({}, true)).toEqual({ color: '#131211', dark: true });
    expect(statusBarColors({ theme: 'classic', isDarkMode: true }, false)).toEqual({ color: '#0f0e0c', dark: true });
    expect(statusBarColors({ theme: 'classic' }, true)).toEqual({ color: '#ece4d4', dark: false });
  });

  it('reduce motion: explicit setting wins, else the device', () => {
    expect(resolveReduceMotion({ reduceMotion: true })).toBe(true);
    expect(resolveReduceMotion({ reduceMotion: false })).toBe(false);
    expect(resolveReduceMotion({})).toBe(false); // no window.matchMedia under node
  });
});
