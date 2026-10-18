#!/usr/bin/env node
// run-math-tests.mjs — unified math-regression runner for CalcSuite.
//
// One command, zero dependencies (node + the project-local TypeScript only):
//
//   node scripts/run-math-tests.mjs        (or: npm run verify:math)
//
// What it does:
//   1. Compiles lib/*.ts to CommonJS into the transient build dir
//      scripts/tests/.build/lib/*.js via a generated paths-mapped tsconfig,
//      so '@/lib/*' alias imports (paytype/qbi/retirement/scorp/scorpfull →
//      tax/scorp/qbi) resolve for type-checking. Emitted JS keeps the alias
//      specifiers verbatim; every test file redirects them at load time via
//      its Module._resolveFilename hook, so no post-emit rewriting is needed.
//   2. Runs every scripts/tests/*.test.mjs under node with
//      CALC_TEST_BUILD=<build dir> exported. The build dir location is not
//      arbitrary: four test files (llccorp/retirement/scorpfull/paytype)
//      require './.build/lib/<name>.js' relative to this directory, and the
//      remaining nine probe '<build>/lib/<name>.js' first — compiling with
//      rootDir=<repo root> satisfies all thirteen loaders at once.
//   3. Prints a per-file pass/fail summary with assertion counts parsed from
//      each file's summary line, and exits non-zero if the compile fails or
//      any test file fails.
//   4. Always removes the build dir when done (it is transient; nothing is
//      left in the working tree).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS_DIR = path.join(REPO, 'scripts', 'tests');
const BUILD_DIR = path.join(TESTS_DIR, '.build');
const TSC_ENTRY = path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc');

const toPosix = (p) => p.split(path.sep).join('/');

/* ------------------------------------------------------------------ */
/* Discover inputs                                                     */
/* ------------------------------------------------------------------ */

const testFiles = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();

const libFiles = fs
  .readdirSync(path.join(REPO, 'lib'))
  .filter((f) => f.endsWith('.ts'))
  .sort();

if (testFiles.length === 0) {
  console.error('no *.test.mjs files found under scripts/tests — nothing to run');
  process.exit(1);
}
if (libFiles.length === 0) {
  console.error('no *.ts files found under lib — nothing to compile');
  process.exit(1);
}
if (!fs.existsSync(TSC_ENTRY)) {
  console.error(`typescript compiler not found at ${toPosix(TSC_ENTRY)} — run npm ci first`);
  process.exit(1);
}

const buildDirPreExisted = fs.existsSync(BUILD_DIR);

/* ------------------------------------------------------------------ */
/* Step 1 — compile lib/*.ts into the transient build dir              */
/* ------------------------------------------------------------------ */

// Paths cannot be passed on the tsc CLI, so the runner generates a minimal
// paths-mapped tsconfig inside the (transient) build dir. rootDir = repo root
// projects the lib/ folder into <outDir>/lib/, the layout every test loader
// probes first. All paths absolute + POSIX so the config is location-stable.
const tsconfigPath = path.join(BUILD_DIR, 'tsconfig.math.json');
const tsconfig = {
  compilerOptions: {
    target: 'ES2020',
    module: 'CommonJS',
    moduleResolution: 'node',
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: false,
    incremental: false,
    baseUrl: toPosix(REPO),
    paths: { '@/*': ['./*'] },
    rootDir: toPosix(REPO),
    outDir: toPosix(BUILD_DIR),
  },
  files: libFiles.map((f) => toPosix(path.join(REPO, 'lib', f))),
};

fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

let compileOk = true;
try {
  const t0 = Date.now();
  const tsc = spawnSync(process.execPath, [TSC_ENTRY, '-p', tsconfigPath], {
    cwd: REPO,
    encoding: 'utf8',
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (tsc.error) {
    console.error(`tsc failed to launch: ${tsc.error.message}`);
    compileOk = false;
  } else if (tsc.status !== 0) {
    console.error(`tsc exited with code ${tsc.status}:\n${tsc.stdout || ''}${tsc.stderr || ''}`);
    compileOk = false;
  } else {
    console.log(
      `tsc: compiled ${libFiles.length} lib sources → scripts/tests/.build/lib ` +
        `(${secs}s, transient)`,
    );
  }
} catch (err) {
  console.error(`tsc invocation threw: ${err && err.stack ? err.stack : err}`);
  compileOk = false;
}

/* ------------------------------------------------------------------ */
/* Step 2 — run every test file                                        */
/* ------------------------------------------------------------------ */

// Summary-line dialects across the thirteen files:
//   "PASS x.test.mjs — 37 assertions"        (stripe, freelance)
//   "x.test: 62 assertions passed"           (breakeven, captable, runway)
//   "x.test.mjs: 87/87 assertions passed"    (estimated, homeoffice, qbi, setax)
//   "x.test.mjs: 44 assertions passed."      (llccorp, paytype, retirement, scorpfull)
// Parse the LAST "<n>[/<m>] assertions" occurrence in the combined output.
function parseCounts(text) {
  const re = /(\d+)(?:\s*\/\s*(\d+))?\s+assertions?\b/g;
  let m;
  let last = null;
  while ((m = re.exec(text)) !== null) last = m;
  if (!last) return null;
  const a = Number(last[1]);
  const b = last[2] === undefined ? a : Number(last[2]);
  return { passed: Math.min(a, b), total: Math.max(a, b) };
}

const results = [];

if (compileOk) {
  const env = { ...process.env, CALC_TEST_BUILD: BUILD_DIR };
  for (let i = 0; i < testFiles.length; i += 1) {
    const file = testFiles[i];
    const run = spawnSync(process.execPath, [path.join(TESTS_DIR, file)], {
      cwd: REPO,
      env,
      encoding: 'utf8',
    });
    const out = `${run.stdout || ''}\n${run.stderr || ''}`;
    const ok = !run.error && run.status === 0;
    const counts = parseCounts(out);
    let passed;
    let failed;
    if (counts) {
      // A passing file's summary is authoritative; a failing file that still
      // printed one (unlikely) is trusted for its passed-count only.
      passed = counts.passed;
      failed = ok ? counts.total - counts.passed : Math.max(1, counts.total - counts.passed);
    } else {
      // No summary line: for verbose-style files count per-assertion PASS
      // lines emitted before the abort; the failure itself counts as 1.
      const trail = (run.stdout || '').split('\n').filter((l) => /^PASS\s/.test(l)).length;
      passed = ok ? null : trail;
      failed = ok ? null : 1;
    }
    results.push({ file, ok, passed, failed, status: run.status, out });
    const tag = ok ? 'PASS' : 'FAIL';
    const countsTxt =
      counts && ok
        ? `${counts.passed} assertion${counts.passed === 1 ? '' : 's'}`
        : passed !== null || failed !== null
          ? `${passed ?? '?'} passed / ${failed ?? '?'} failed`
          : 'no count parsed';
    console.log(`[${String(i + 1).padStart(2, ' ')}/${testFiles.length}] ${tag} ${file} — ${countsTxt}`);
    if (!ok) {
      const excerpt = (run.stderr || run.stdout || `(no output; status ${run.status})`).trim();
      console.log(
        excerpt
          .split('\n')
          .map((l) => `    │ ${l}`)
          .join('\n'),
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Step 3 — summary + exit code                                        */
/* ------------------------------------------------------------------ */

const failedFiles = results.filter((r) => !r.ok);
const passedFiles = results.filter((r) => r.ok);
const totalPassed = results.reduce((s, r) => s + (r.passed ?? 0), 0);
const totalFailed = results.reduce((s, r) => s + (r.failed ?? 0), 0);

console.log('');
if (!compileOk) {
  console.log('RESULT: FAILED — compilation error (see tsc output above)');
} else if (failedFiles.length > 0) {
  console.log(`RESULT: FAILED — ${failedFiles.length}/${testFiles.length} file(s) failing:`);
  for (const r of failedFiles) console.log(`  - ${r.file} (exit ${r.status})`);
} else {
  console.log(
    `RESULT: PASS — ${passedFiles.length}/${testFiles.length} files green, ` +
      `${totalPassed} assertions passed, 0 failed`,
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — always clean the transient build dir                       */
/* ------------------------------------------------------------------ */

try {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  if (buildDirPreExisted) {
    console.log('note: scripts/tests/.build pre-existed before this run and was removed');
  }
} catch (err) {
  console.error(`warning: failed to remove ${toPosix(BUILD_DIR)}: ${err.message}`);
  process.exitCode = 1;
}

process.exitCode = compileOk && failedFiles.length === 0 ? 0 : process.exitCode || 1;
