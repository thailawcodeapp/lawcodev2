// The build number lives in four places across three files, and every release
// so far has moved them by hand. Miss one and the symptom is not a build
// failure — it is a store upload rejected for a duplicate versionCode, or an
// app whose Settings screen reports a build it is not, discovered after the
// fact by someone trying to work out which build a bug came from.
//
// One source of truth is not available: Gradle, Xcode and the app bundle each
// insist on their own. So instead: one command that writes all four, and
// refuses to run if they had already drifted apart.
//
//   node scripts/bump-version.mjs                 next build (73 -> 74)
//   node scripts/bump-version.mjs --set 80        a specific build
//   node scripts/bump-version.mjs --name 1.0.7    also move the version name
//   node scripts/bump-version.mjs --check         report only, change nothing
//
// --check is the one to reach for before a release, and the one worth adding
// to CI: it fails when the four disagree, which is the state that produces a
// rejected upload.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// `re` is a factory rather than a value because a /g regex carries lastIndex,
// and reading with matchAll and then writing with replace using the same
// object is the kind of shared state that works until it doesn't.
export const TARGETS = [
  {
    path: 'android/app/build.gradle',
    code: { re: () => /versionCode\s+(\d+)/g, write: (n) => `versionCode ${n}`, count: 1 },
    name: { re: () => /versionName\s+"([^"]+)"/g, write: (v) => `versionName "${v}"`, count: 1 },
  },
  {
    path: 'src/config.js',
    code: { re: () => /APP_VERSION_CODE\s*=\s*(\d+)/g, write: (n) => `APP_VERSION_CODE = ${n}`, count: 1 },
    name: { re: () => /APP_VERSION_NAME\s*=\s*'([^']+)'/g, write: (v) => `APP_VERSION_NAME = '${v}'`, count: 1 },
  },
  {
    // Twice each: Xcode writes one per build configuration, Debug and Release.
    // Bumping only the first is a build that ships the old number in release.
    path: 'ios/App/App.xcodeproj/project.pbxproj',
    code: { re: () => /CURRENT_PROJECT_VERSION\s*=\s*(\d+)/g, write: (n) => `CURRENT_PROJECT_VERSION = ${n}`, count: 2 },
    name: { re: () => /MARKETING_VERSION\s*=\s*([0-9][0-9.]*)/g, write: (v) => `MARKETING_VERSION = ${v}`, count: 2 },
  },
];

/**
 * The build and version name every file currently agrees on.
 *
 * Throws rather than picking a winner when they do not. A bump that silently
 * normalised a drift would hide the fact that some earlier release shipped
 * mismatched numbers, which is exactly the thing worth being told about.
 *
 * @param {Record<string, string>} contents  path -> file text
 */
export function readVersions(contents) {
  const codes = [];
  const names = [];
  for (const target of TARGETS) {
    const text = contents[target.path];
    if (text == null) throw new Error(`${target.path}: not read`);
    for (const field of ['code', 'name']) {
      const found = [...text.matchAll(target[field].re())].map((m) => m[1]);
      if (found.length !== target[field].count) {
        throw new Error(
          `${target.path}: expected ${target[field].count} ${field} match(es), found ${found.length}`
          + ' — the file changed shape and this script would have silently skipped it',
        );
      }
      (field === 'code' ? codes : names).push(...found);
    }
  }
  const uniqueCodes = [...new Set(codes)];
  const uniqueNames = [...new Set(names)];
  if (uniqueCodes.length !== 1) throw new Error(`build numbers already disagree: ${codes.join(', ')}`);
  if (uniqueNames.length !== 1) throw new Error(`version names already disagree: ${names.join(', ')}`);
  return { code: Number(uniqueCodes[0]), name: uniqueNames[0] };
}

/** New contents for every file, with both fields set. Pure. */
export function writeVersions(contents, { code, name }) {
  const out = {};
  for (const target of TARGETS) {
    out[target.path] = contents[target.path]
      .replace(target.code.re(), () => target.code.write(code))
      .replace(target.name.re(), () => target.name.write(name));
  }
  return out;
}

function flag(argv, key) {
  const at = argv.indexOf(key);
  return at < 0 ? null : argv[at + 1];
}

function main() {
  const argv = process.argv.slice(2);
  const contents = Object.fromEntries(TARGETS.map((t) => [t.path, readFileSync(t.path, 'utf8')]));
  const current = readVersions(contents);

  if (argv.includes('--check')) {
    console.log(`build ${current.code}, version ${current.name} — all ${TARGETS.length} files agree`);
    return;
  }

  const set = flag(argv, '--set');
  if (set != null && !/^\d+$/.test(set)) {
    console.error(`--set needs a whole number, got ${JSON.stringify(set)}`);
    process.exit(1);
  }
  const code = set != null ? Number(set) : current.code + 1;
  if (code <= current.code) {
    // Play and App Store both reject a build number that is not higher than
    // one already uploaded, and there is no way back from a wasted number.
    console.error(`build ${code} is not above the current ${current.code} — stores reject that`);
    process.exit(1);
  }

  const name = flag(argv, '--name') ?? current.name;
  if (!/^\d+(\.\d+)*$/.test(name)) {
    console.error(`--name needs a dotted number like 1.0.7, got ${JSON.stringify(name)}`);
    process.exit(1);
  }

  const next = writeVersions(contents, { code, name });
  // Re-read the result the same way the files are read, so a rewrite that
  // produced something this script cannot parse back fails here rather than
  // at the next release.
  readVersions(next);

  for (const [path, text] of Object.entries(next)) writeFileSync(path, text);

  console.log(`build ${current.code} -> ${code}`);
  console.log(current.name === name ? `version ${name} (unchanged)` : `version ${current.name} -> ${name}`);
  for (const t of TARGETS) console.log(`  ${t.path}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
