#!/usr/bin/env node
/**
 * Verify each demo's .env.example declares every process.env.X that its
 * source code reads.
 *
 * Catches the "added a new env var but forgot to document it" gap that
 * surfaced on compass-live in 2026-06 (COMPASS_API_KEY_AUTH + COMPASS_BIN
 * were read by the spawned MCP wrapper but missing from .env.example,
 * so a fresh-clone partner would hit cryptic "API key missing" errors).
 *
 * Scope: walks each demo's src/ for `process.env.X` references.
 * Cross-process deps (env vars read by spawned subprocesses or vendored
 * packages like _mcp-compass/) are NOT auto-detected — those need to be
 * added to .env.example by hand. Convention: include them under a
 * dedicated section with a comment explaining who reads them at runtime.
 *
 * Run from repo root: `node scripts/check-env-examples.mjs`
 * CI: see .github/workflows/check-env-examples.yml
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Standard runtime-provided vars; never expected in .env.local.
const STD_VARS = new Set([
  'NODE_ENV', 'PATH', 'HOME', 'PWD', 'USER', 'SHELL', 'TERM',
  'VERCEL', 'VERCEL_URL', 'VERCEL_ENV', 'VERCEL_REGION',
  'PORT',
]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) yield p;
  }
}

async function envVarsInSrc(srcDir) {
  const seen = new Set();
  for await (const f of walk(srcDir)) {
    const txt = await readFile(f, 'utf8');
    for (const m of txt.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
      const v = m[1];
      if (!STD_VARS.has(v)) seen.add(v);
    }
  }
  return seen;
}

async function envVarsInExample(envExamplePath) {
  const seen = new Set();
  try {
    const txt = await readFile(envExamplePath, 'utf8');
    for (const line of txt.split('\n')) {
      // Match both `FOO=bar` and `# FOO=bar` (commented-out optional vars).
      const m = line.match(/^#?\s*([A-Z_][A-Z0-9_]*)\s*=/);
      if (m) seen.add(m[1]);
    }
  } catch { /* file missing */ }
  return seen;
}

const demos = (await readdir(REPO_ROOT, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'scripts')
  .map((d) => d.name)
  .sort();

let missingCount = 0;
const results = [];

for (const demo of demos) {
  const srcDir = `${REPO_ROOT}/${demo}/src`;
  try { await stat(srcDir); } catch { continue; }
  const envExample = `${REPO_ROOT}/${demo}/.env.example`;
  let hasExample = true;
  try { await stat(envExample); } catch { hasExample = false; }

  const used = await envVarsInSrc(srcDir);
  if (used.size === 0) continue;

  if (!hasExample) {
    results.push({ demo, missing: [...used].sort(), extra: [], reason: 'no .env.example file' });
    missingCount++;
    continue;
  }

  const declared = await envVarsInExample(envExample);
  const missing = [...used].filter((v) => !declared.has(v)).sort();
  const extra = [...declared].filter((v) => !used.has(v)).sort();
  if (missing.length || extra.length) results.push({ demo, missing, extra });
  if (missing.length) missingCount++;
}

if (results.length === 0) {
  console.log('✅ All demos: .env.example declares every process.env.X used in src/.');
  process.exit(0);
}

for (const r of results) {
  const tag = r.missing.length ? '❌' : '⚠️ ';
  console.log(`${tag} ${r.demo}${r.reason ? `  (${r.reason})` : ''}`);
  if (r.missing.length) {
    console.log(`   missing in .env.example: ${r.missing.join(', ')}`);
  }
  if (r.extra.length) {
    // Extras are warnings, not failures — they may be intentional
    // (cross-process deps documented for the partner) or stale.
    console.log(`   in .env.example but not used in src/: ${r.extra.join(', ')}`);
  }
}

if (missingCount > 0) {
  console.log(`\n${missingCount} demo(s) with missing env declarations. Add them to .env.example or remove the process.env reference.`);
  process.exit(1);
}
console.log(`\n0 missing — ${results.length} demo(s) have warnings only.`);
process.exit(0);
