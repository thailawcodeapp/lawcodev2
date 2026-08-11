import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TARGETS, readVersions, writeVersions } from './bump-version.mjs';

// Real files, read once. The regexes are the whole substance of this script,
// and a regex tested only against a fixture proves nothing about the file it
// has to edit — the fixture would be written to match the regex.
const real = Object.fromEntries(TARGETS.map((t) => [t.path, readFileSync(t.path, 'utf8')]));

describe('readVersions', () => {
  it('reads one build and one version name out of the repository as it stands', () => {
    const { code, name } = readVersions(real);
    expect(Number.isInteger(code)).toBe(true);
    expect(code).toBeGreaterThan(0);
    expect(name).toMatch(/^\d+(\.\d+)*$/);
  });

  it('finds the Xcode pair, not just the first of them', () => {
    // Xcode writes CURRENT_PROJECT_VERSION once per build configuration.
    // Bumping only the first ships the old build number in release, which is
    // invisible until a store upload is rejected.
    const pbx = TARGETS.find((t) => t.path.endsWith('project.pbxproj'));
    expect(pbx.code.count).toBe(2);
    expect([...real[pbx.path].matchAll(pbx.code.re())]).toHaveLength(2);
    expect([...real[pbx.path].matchAll(pbx.name.re())]).toHaveLength(2);
  });

  it('refuses to guess when the files have drifted apart', () => {
    const drifted = { ...real };
    const gradle = 'android/app/build.gradle';
    drifted[gradle] = drifted[gradle].replace(/versionCode\s+\d+/, 'versionCode 999');
    expect(() => readVersions(drifted)).toThrow(/disagree/);
  });

  it('refuses to run when a file no longer has the shape it expects', () => {
    // The failure that matters: a rename upstream turns this script into a
    // no-op for that file, and the bump silently covers three places instead
    // of four.
    const config = 'src/config.js';
    expect(() => readVersions({ ...real, [config]: real[config].replace(/APP_VERSION_CODE/, 'BUILD_NUMBER') }))
      .toThrow(/expected 1 code match/);
  });
});

describe('writeVersions', () => {
  it('sets the same build in all four places', () => {
    const next = writeVersions(real, { code: 999, name: '9.9.9' });
    expect(readVersions(next)).toEqual({ code: 999, name: '9.9.9' });
  });

  it('changes nothing but the numbers', () => {
    const { code, name } = readVersions(real);
    const next = writeVersions(real, { code, name });
    for (const t of TARGETS) expect(next[t.path]).toBe(real[t.path]);
  });

  it('leaves a two-digit build a two-digit build rather than corrupting neighbours', () => {
    // Guards the shape of the replacement, which is the part that touches
    // project.pbxproj — a file where a stray edit is not obvious on review.
    const next = writeVersions(real, { code: 100, name: '1.0.6' });
    expect(next['android/app/build.gradle']).toContain('versionCode 100');
    expect(next['ios/App/App.xcodeproj/project.pbxproj']).toContain('CURRENT_PROJECT_VERSION = 100;');
    expect(next['src/config.js']).toContain('APP_VERSION_CODE = 100;');
  });
});
