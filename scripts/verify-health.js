#!/usr/bin/env node
/**
 * verify-health.js — Deterministic/static safety gate for the budget-assistant project.
 *
 * PURPOSE
 *   Runs BEFORE a deploy to catch obvious regressions without requiring a browser or
 *   network. It is the STATIC complement to scripts/release-verify-live.js (which does
 *   live HTTP verification after deploy).
 *
 * SCOPE (Phase 0 of plans/app-js-modularization-plan.md)
 *   - Syntax-check (node --check) every critical JS file in the deploy pipeline.
 *   - Run the existing unit tests (npm test).
 *   - Verify every <script src="..."> in index.html resolves to an existing file,
 *     and cross-check against the ASSETS list in sw.js.
 *   - Verify version consistency (CURRENT_BUILD / sw.js SW Version / app.js build).
 *   - Lightweight balanced-brace/backtick sanity heuristic on the big inline files.
 *
 * DESIGN CONSTRAINTS
 *   - Deterministic & static only. No browser automation, no network.
 *   - Does NOT change runtime behavior, does NOT modify any file.
 *   - Does NOT convert anything to ES modules.
 *   - Excludes build artifacts (www/, android/app/build, android/app/src/main/assets)
 *     and throwaway diagnostics (scratch/).
 *   - Files generated only during release-native (ota-boot-loader.js, js/OTAEngine.js)
 *     are treated as OPTIONAL: WARN if missing, never FAIL.
 *
 * EXIT CODES
 *   0  all checks passed (WARNs allowed)
 *   1  at least one FAIL
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------
let failures = 0;
let warnings = 0;

function pass(msg) {
    console.log(`  [PASS] ${msg}`);
}
function warn(msg) {
    warnings++;
    console.warn(`  [WARN] ${msg}`);
}
function fail(msg) {
    failures++;
    console.error(`  [FAIL] ${msg}`);
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// 1. Syntax check (node --check) on critical JS files
// ---------------------------------------------------------------------------
// Files that are part of the deploy pipeline. Generated-only files are listed
// separately as OPTIONAL (WARN if missing).
// Cloudflare Pages Functions use ES module syntax (import/export). The root
// package.json is "type": "commonjs", so `node --check file.js` treats them as
// CommonJS and fails. They must be syntax-checked as ES modules (via stdin with
// --input-type=module). They are listed separately below.
const CRITICAL_JS = [
    // Root app files
    'app.js',
    'web-ui.js',
    'sw.js',
    'xlsx.full.min.js',
    // js/ modules referenced by index.html (plus transactionMerge)
    'js/supabase.js',
    'js/chart.js',
    'js/chartjs-plugin-datalabels.js',
    'js/NLPProcessor.js',
    'js/MemoryEngine.js',
    'js/DecisionEngine.js',
    'js/OnlineAIProvider.js',
    'js/AIEngine.js',
    'js/IntentCorpus.js',
    'js/KnowledgeGraph.js',
    'js/CurrencyService.js',
    'js/transactionMerge.js',
    // Build/release scripts (including this file itself)
    'scripts/generate-android-icons.js',
    'scripts/generate-app-icon-variants.js',
    'scripts/generate-logo.js',
    'scripts/release-all.js',
    'scripts/release-deploy.js',
    'scripts/release-native.js',
    'scripts/release-verify-live.js',
    'scripts/version-bump.js',
    'scripts/version-check.js',
    'scripts/version-sync.js',
    'scripts/verify-health.js',
];

// Cloudflare Pages Functions — ES modules (checked with --input-type=module).
const CRITICAL_JS_ESM = [
    'functions/api/_security.js',
    'functions/api/ai.js',
    'functions/api/cleanup-recurring-duplicates.js',
    'functions/api/coach.js',
    'functions/api/delete-account.js',
    'functions/api/feedback.js',
    'functions/api/play-billing.js',
    'functions/api/gpay-purchase.js',
    'functions/api/premium-status.js',
    'functions/api/purchase.js',
    'functions/api/webhook.js',
    'functions/api/migrate-incremental-sync.js',
    'functions/api/migrate-insert-updated-at.js',
    'functions/api/restore-transactions.js',
    'functions/api/scan-receipt.js',
];

// Generated only during release-native; absent in a clean checkout.
const OPTIONAL_JS = [
    'ota-boot-loader.js',
    'js/OTAEngine.js',
];

function syntaxCheckFile(relPath, { esm = false } = {}) {
    const abs = path.join(rootDir, relPath);
    if (!fs.existsSync(abs)) {
        fail(`syntax: file missing: ${relPath}`);
        return;
    }
    let res;
    if (esm) {
        // Cloudflare Functions use ES module syntax; the root package.json is
        // commonjs, so we must check them as modules via stdin.
        const content = fs.readFileSync(abs, 'utf8');
        res = spawnSync(process.execPath, ['--check', '--input-type=module'], {
            cwd: rootDir,
            encoding: 'utf8',
            input: content,
        });
    } else {
        res = spawnSync(process.execPath, ['--check', relPath], {
            cwd: rootDir,
            encoding: 'utf8',
        });
    }
    if (res.status !== 0) {
        const err = (res.stderr || res.stdout || '').trim();
        fail(`syntax: ${relPath}${err ? ' — ' + err.split('\n')[0] : ''}`);
    } else {
        pass(`syntax: ${relPath}`);
    }
}

function runSyntaxChecks() {
    section('1. Syntax check (node --check)');
    CRITICAL_JS.forEach((f) => syntaxCheckFile(f));
    CRITICAL_JS_ESM.forEach((f) => syntaxCheckFile(f, { esm: true }));

    // Optional (release-native generated) files: WARN if missing, check if present.
    OPTIONAL_JS.forEach((relPath) => {
        const abs = path.join(rootDir, relPath);
        if (!fs.existsSync(abs)) {
            warn(`syntax: optional file not present (generated at release-native): ${relPath}`);
        } else {
            syntaxCheckFile(relPath);
        }
    });
}

// ---------------------------------------------------------------------------
// 2. Unit tests (npm test)
// ---------------------------------------------------------------------------
function runUnitTests() {
    section('2. Unit tests (npm test)');
    // On Windows, `npm` resolves to npm.cmd (a batch file) which spawnSync cannot
    // launch directly. Using shell:true with the FULL command as a single string
    // (NOT an args array) works cross-platform and avoids the DEP0190 deprecation
    // warning (which only fires when separate args are passed with shell:true).
    const res = spawnSync('npm test', {
        cwd: rootDir,
        encoding: 'utf8',
        shell: true,
    });
    if (res.status !== 0) {
        const out = (res.stdout || '') + (res.stderr || '');
        const tail = out.trim().split('\n').slice(-15).join('\n');
        fail(`npm test failed (exit ${res.status}). Last output:\n${tail || '(no output)'}`);
    } else {
        pass('npm test passed');
    }
}

// ---------------------------------------------------------------------------
// 3. Script dependency / order check
// ---------------------------------------------------------------------------
function extractScriptSrcs(html) {
    const srcs = [];
    const re = /<script[^>]*\bsrc\s*=\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        // Strip cache-busting query (?v=NNN)
        srcs.push(m[1].split('?')[0]);
    }
    return srcs;
}

function extractSwAssets(swContent) {
    const assets = [];
    const re = /^\s*'([^']+)',?\s*$/gm;
    let m;
    while ((m = re.exec(swContent)) !== null) {
        assets.push(m[1]);
    }
    return assets;
}

function runDependencyCheck() {
    section('3. Script dependency / order check');
    const indexPath = path.join(rootDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        fail('dependency: index.html missing');
        return;
    }
    const html = fs.readFileSync(indexPath, 'utf8');
    const srcs = extractScriptSrcs(html);
    if (srcs.length === 0) {
        fail('dependency: no <script src> found in index.html');
        return;
    }

    let missing = 0;
    srcs.forEach((src) => {
        const abs = path.join(rootDir, src);
        if (!fs.existsSync(abs)) {
            missing++;
            fail(`dependency: <script src="${src}"> in index.html does not resolve to a file`);
        }
    });
    if (missing === 0) {
        pass(`all ${srcs.length} <script src> entries in index.html resolve to files`);
    }

    // Order sanity: app.js must be loaded AFTER its dependencies (js/*.js).
    const appIdx = srcs.indexOf('app.js');
    if (appIdx === -1) {
        fail('dependency: app.js is not referenced in index.html');
    } else {
        const afterApp = srcs.slice(appIdx + 1);
        // Only web-ui.js (deferred) is expected after app.js.
        const unexpectedAfter = afterApp.filter((s) => s !== 'web-ui.js');
        if (unexpectedAfter.length > 0) {
            fail(`dependency: scripts loaded AFTER app.js may not be available to it: ${unexpectedAfter.join(', ')}`);
        } else {
            pass('dependency: app.js is loaded after its js/*.js dependencies');
        }
    }

    // Cross-check with sw.js ASSETS list (every sw.js asset must exist).
    const swPath = path.join(rootDir, 'sw.js');
    if (fs.existsSync(swPath)) {
        const swAssets = extractSwAssets(fs.readFileSync(swPath, 'utf8'));
        let swMissing = 0;
        swAssets.forEach((asset) => {
            if (!fs.existsSync(path.join(rootDir, asset))) {
                swMissing++;
                fail(`dependency: sw.js ASSETS entry missing on disk: ${asset}`);
            }
        });
        if (swMissing === 0) {
            pass(`all ${swAssets.length} sw.js ASSETS entries exist on disk`);
        }
    } else {
        warn('dependency: sw.js not found (skipping ASSETS cross-check)');
    }
}

// ---------------------------------------------------------------------------
// 4. Version consistency
// ---------------------------------------------------------------------------
function runVersionCheck() {
    section('4. Version consistency');
    const versionJsonPath = path.join(rootDir, 'version.json');
    if (!fs.existsSync(versionJsonPath)) {
        fail('version: version.json missing');
        return;
    }
    let canonical;
    try {
        canonical = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;
    } catch (e) {
        fail(`version: version.json is not valid JSON (${e.message})`);
        return;
    }
    if (typeof canonical !== 'number') {
        fail(`version: version.json version is not a number (${canonical})`);
        return;
    }

    const indexTxt = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    if (!indexTxt.includes(`const CURRENT_BUILD = ${canonical};`)) {
        fail(`version: index.html CURRENT_BUILD does not match canonical v${canonical}`);
    } else {
        pass(`version: index.html CURRENT_BUILD matches v${canonical}`);
    }

    const swTxt = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
    if (!swTxt.includes(`// SW Version ${canonical}`)) {
        fail(`version: sw.js SW Version does not match v${canonical}`);
    } else {
        pass(`version: sw.js SW Version matches v${canonical}`);
    }

    // The app_version label is now DYNAMIC — getActiveBuildLabel() (app.js)
    // constructs "(build vN)" at runtime from window.OTA_ACTIVE_VERSION /
    // CURRENT_BUILD (fallback template: 'Έκδοση 1.0.0 (build v' + ...). The
    // static "(build vN)" marker no longer exists in app.js or translations.js,
    // so we verify the dynamic template pattern exists in app.js instead.
    const appTxt = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    if (!appTxt.includes(`(build v' + (build != null ? build : '?') + ')'`)) {
        fail(`version: app.js dynamic app_version build label template missing`);
    } else {
        pass(`version: app.js dynamic app_version build label template present`);
    }
}

// ---------------------------------------------------------------------------
// 5. Balanced brace sanity heuristic (static, no browser)
// ---------------------------------------------------------------------------
// NOTE on backticks: template-literal validity is ALREADY enforced by the
// `node --check` syntax pass (section 1), which is the authoritative validator.
// A naive raw backtick count is NOT reliable here because backticks legitimately
// appear inside string literals and comments, producing false positives (e.g. an
// "odd" count on a perfectly valid file). We therefore do NOT count backticks in
// this heuristic. We keep only the brace-balance check, which uses a GROSS
// imbalance threshold (>50) so it only flags a truncated/corrupted file and never
// fails on legitimate code.
function countBalanced(content) {
    let braces = 0;
    for (const ch of content) {
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
    }
    return braces;
}

function runBalanceHeuristic() {
    section('5. Balanced brace sanity (static heuristic)');
    const targets = [
        { rel: 'app.js', label: 'app.js' },
        { rel: 'index.html', label: 'index.html (inline scripts)' },
        { rel: 'web-ui.js', label: 'web-ui.js' },
    ];
    targets.forEach(({ rel, label }) => {
        const abs = path.join(rootDir, rel);
        if (!fs.existsSync(abs)) {
            warn(`balance: ${label} missing (skipped)`);
            return;
        }
        const content = fs.readFileSync(abs, 'utf8');
        const braces = countBalanced(content);
        // A gross imbalance (e.g. > 50) strongly suggests a truncated/corrupted file.
        if (Math.abs(braces) > 50) {
            fail(`balance: ${label} has unbalanced braces (net ${braces > 0 ? '+' : ''}${braces})`);
        } else if (Math.abs(braces) > 5) {
            warn(`balance: ${label} brace net is ${braces > 0 ? '+' : ''}${braces} (verify manually)`);
        } else {
            pass(`balance: ${label} braces balanced (net ${braces})`);
        }
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
    console.log('====================================================');
    console.log('🩺 VERIFY-HEALTH — Static pre-deploy safety gate');
    console.log('====================================================');

    runSyntaxChecks();
    runUnitTests();
    runDependencyCheck();
    runVersionCheck();
    runBalanceHeuristic();

    console.log('\n====================================================');
    console.log(`RESULT: ${failures} FAIL, ${warnings} WARN`);
    if (failures > 0) {
        console.log('❌ HEALTH CHECK FAILED — do not deploy.');
        process.exit(1);
    }
    if (warnings > 0) {
        console.log('⚠️  HEALTH CHECK PASSED with warnings — review before deploy.');
    } else {
        console.log('✅ HEALTH CHECK PASSED — safe to deploy.');
    }
    console.log('====================================================');
}

main();
