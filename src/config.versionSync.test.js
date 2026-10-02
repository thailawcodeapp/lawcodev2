import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// One release carries its version number in three files, and nothing in the
// build pipeline connects them. That is not a theoretical hazard: a release
// went out with src/config.js and build.gradle raised and the Xcode project
// left behind, so the IPA kept a CFBundleVersion App Store Connect already
// had. It refused the upload, the workflow step is continue-on-error, and the
// job finished green with nothing in TestFlight and no signal anywhere.
//
// This is the cheapest possible guard: it runs on every commit, before any
// build, and it fails on the exact mistake — one file edited, another not.
const read = (p) => readFileSync(p, 'utf8');

const CONFIG = 'src/config.js';
const GRADLE = 'android/app/build.gradle';
const PBXPROJ = 'ios/App/App.xcodeproj/project.pbxproj';

function one(text, re, what, file) {
  const m = text.match(re);
  if (!m) throw new Error(`could not find ${what} in ${file}`);
  return m[1];
}

// CURRENT_PROJECT_VERSION and MARKETING_VERSION each appear twice in the
// project file, once for Debug and once for Release. Editing only one is a
// real and easy mistake, so every occurrence is collected rather than the
// first, and they must agree with each other as well as with the rest.
function all(text, re) {
  return [...text.matchAll(re)].map((m) => m[1]);
}

describe('the build number is the same in all three places', () => {
  const config = read(CONFIG);
  const gradle = read(GRADLE);
  const pbxproj = read(PBXPROJ);

  it('agrees across src/config.js, build.gradle and the Xcode project', () => {
    const fromConfig = one(config, /APP_VERSION_CODE\s*=\s*(\d+)/, 'APP_VERSION_CODE', CONFIG);
    const fromGradle = one(gradle, /versionCode\s+(\d+)/, 'versionCode', GRADLE);
    const fromXcode = all(pbxproj, /CURRENT_PROJECT_VERSION\s*=\s*(\d+);/g);

    expect(fromXcode.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fromXcode).size, 'Debug and Release disagree in project.pbxproj').toBe(1);
    expect({ config: fromConfig, gradle: fromGradle, xcode: fromXcode[0] })
      .toEqual({ config: fromConfig, gradle: fromConfig, xcode: fromConfig });
  });

  it('agrees on the version name too', () => {
    // A mismatch here is quieter but still user-visible: Settings renders
    // "v{APP_VERSION_NAME} · build {APP_VERSION_CODE}", so a stale name
    // misleads every bug report that quotes it.
    const fromConfig = one(config, /APP_VERSION_NAME\s*=\s*'([^']+)'/, 'APP_VERSION_NAME', CONFIG);
    const fromGradle = one(gradle, /versionName\s+"([^"]+)"/, 'versionName', GRADLE);
    const fromXcode = all(pbxproj, /MARKETING_VERSION\s*=\s*([^;]+);/g).map((v) => v.trim());

    expect(new Set(fromXcode).size, 'Debug and Release disagree in project.pbxproj').toBe(1);
    expect({ config: fromConfig, gradle: fromGradle, xcode: fromXcode[0] })
      .toEqual({ config: fromConfig, gradle: fromConfig, xcode: fromConfig });
  });
});
