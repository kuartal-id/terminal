#!/usr/bin/env node
/**
 * Guardrails for multi-AI development (Claude, Codex, Gemini, humans).
 * Run locally with `npm run check` (or `node scripts/check-guardrails.mjs`); CI runs it on every push/PR.
 *
 * Fails when:
 *  1. A secret or private key is committed.
 *  2. A protected path (.ai/protected.txt) changed without the "owner-approved" PR label.
 *  3. A stable contract (.ai/contracts.json) was broken: a panel code, API route,
 *     storage key or premium entitlement default disappeared.
 *
 * Env: BASE_REF (git ref/sha to diff against; default origin/main), PR_LABELS (comma list).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const warnings = [];
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ── 1. Secrets ─────────────────────────────────────────────────
let tracked = [];
try {
  tracked = sh('git ls-files').split('\n').filter(Boolean);
} catch {
  warnings.push('Not a git checkout — skipped secret scan of tracked files.');
}
const badNames = [/(^|\/)\.env$/, /(^|\/)\.env\.(?!example$)[^/]+$/, /\.pem$/, /\.p12$/, /\.pfx$/, /(^|\/)id_(rsa|ed25519)$/, /oauth-(private|public)\.key$/, /\.keystore$/];
const badContent = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}/, 'API secret key (OpenAI/Anthropic style)'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
];
for (const f of tracked) {
  if (badNames.some((re) => re.test(f))) errors.push(`Secret-looking file is committed: ${f} (remove it and rotate the secret)`);
  if (/\.(png|jpe?g|webp|ico|icns|gif|woff2?|ttf|lock)$|package-lock\.json$|fixtures\//.test(f)) continue;
  const text = read(f);
  if (text.length > 2_000_000) continue;
  for (const [re, what] of badContent) if (re.test(text)) errors.push(`Possible ${what} in ${f}`);
}

// ── 2. Protected paths ─────────────────────────────────────────
const globToRe = (g) =>
  new RegExp(
    '^' +
      g
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\/?/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*') +
      '$',
  );
const protectedGlobs = read('.ai/protected.txt')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const protectedRes = protectedGlobs.map(globToRe);

const base = process.env.BASE_REF && !/^0+$/.test(process.env.BASE_REF) ? process.env.BASE_REF : 'origin/main';
let changed = null;
try {
  sh(`git rev-parse --verify --quiet ${base}^{commit}`);
  changed = sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean);
} catch {
  warnings.push(`Could not diff against ${base} — skipped protected-path check (fine for a first commit).`);
}
const labels = (process.env.PR_LABELS ?? '').split(',').map((s) => s.trim());
const approved = labels.includes('owner-approved');
if (changed) {
  const hits = changed.filter((f) => protectedRes.some((re) => re.test(f)));
  if (hits.length && !approved) {
    errors.push(
      `Protected files changed without owner approval:\n    - ${hits.join('\n    - ')}\n  Ask Diemas to review, then add the "owner-approved" label to the PR.`,
    );
  } else if (hits.length) {
    warnings.push(`Protected files changed (owner-approved): ${hits.join(', ')}`);
  }
  if (changed.length && !changed.includes('docs/HANDOFF.md')) warnings.push('docs/HANDOFF.md was not updated — please log what you changed for the next agent.');
}

// ── 3. Stable contracts ────────────────────────────────────────
const contracts = JSON.parse(read('.ai/contracts.json') || '{}');
const panelsSrc = read('web/src/lib/panels.ts');
const storeSrc = read('web/src/lib/store.ts');
const serverSrc = read('server/src/index.ts');
const configSrc = read('server/src/config.ts');
for (const code of contracts.panelCodes ?? []) {
  if (!new RegExp(`\\b${code}:\\s*\\{\\s*type:\\s*'${code}'`).test(panelsSrc)) errors.push(`Panel code "${code}" was removed or renamed in web/src/lib/panels.ts — saved user layouts depend on it.`);
}
if (contracts.storageKey && !storeSrc.includes(`'${contracts.storageKey}'`)) {
  errors.push(`STORAGE_KEY changed from "${contracts.storageKey}". Add a migration in store.ts load() and update .ai/contracts.json in the same PR (owner approval needed).`);
}
for (const route of contracts.apiRoutes ?? []) {
  if (!serverSrc.includes(`'${route}'`)) errors.push(`API route ${route} disappeared from server/src/index.ts — the web app, desktop app or other Kuartal apps may call it.`);
}
if (contracts.premiumEntitlementDefault && !configSrc.includes(`'${contracts.premiumEntitlementDefault}'`)) {
  errors.push(`Default premium entitlement is no longer "${contracts.premiumEntitlementDefault}" — this must match Kuartal ID (kuartal-login CatalogSeeder).`);
}

// ── Report ─────────────────────────────────────────────────────
for (const w of warnings) console.log(`⚠  ${w}`);
if (errors.length) {
  console.error(`\n✖ Guardrails failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  • ${e}\n`);
  console.error('Read AGENTS.md before changing protected areas.');
  process.exit(1);
}
console.log(`✔ Guardrails passed (${tracked.length} files scanned, ${protectedGlobs.length} protected globs, ${(contracts.panelCodes ?? []).length} panel codes, ${(contracts.apiRoutes ?? []).length} routes).`);
