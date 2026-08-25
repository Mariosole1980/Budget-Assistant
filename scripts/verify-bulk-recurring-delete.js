#!/usr/bin/env node
/**
 * verify-bulk-recurring-delete.js — Headless-browser E2E check for the bulk
 * recurring multi-delete flow (regression for the "2 recurring selected in the
 * same month -> no options modal" bug) PLUS the post-delete integrity checks:
 *
 *   1. Selecting 2 recurring occurrences opens the 3-option recurring modal
 *      (bulk variant) instead of a plain "Delete N" confirm.
 *   2. scope='single' deletes EXACTLY the 2 selected occurrences, keeps the
 *      rest of the series + the plain transactions, and creates a trash group.
 *   3. After a reload the deleted occurrences do NOT come back (deleted-date
 *      markers persist) while the remaining ones still render.
 *   4. Restoring the trash group brings the deleted occurrences back and
 *      clears the deleted-date markers.
 *
 * It boots the real app (offline, cached local user, network fetch blocked to
 * the Supabase API so the run is deterministic).
 *
 * Usage: node scripts/verify-bulk-recurring-delete.js
 */
'use strict';

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!fs.existsSync(CHROME_PATH)) {
  console.error('No Chrome/Edge found at:', CHROME_PATH);
  process.exit(1);
}

const PORT = 8091;
const BASE = 'http://127.0.0.1:' + PORT;

// ---------------------------------------------------------------------------
// Tiny static server for the workspace root
// ---------------------------------------------------------------------------
function startServer(port) {
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
  };
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, '..', reqPath === '/' ? 'index.html' : reqPath);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

let checks = 0;
let failures = 0;
function check(name, cond, detail) {
  checks++;
  if (cond) {
    console.log('  [PASS] ' + name);
  } else {
    failures++;
    console.error('  [FAIL] ' + name + (detail ? ' — ' + detail : ''));
  }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Seed data built for the CURRENT real month so the test is date-independent
// ---------------------------------------------------------------------------
function buildSeed() {
  const now = new Date();
  const y = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const mm = String(monthNum).padStart(2, '0');
  const lastDay = new Date(y, monthNum, 0).getDate();
  const lastDayStr = y + '-' + mm + '-' + String(lastDay).padStart(2, '0');

  // Weekly template: all same-weekday occurrences from the first Saturday of
  // the month through the end of the month (>= 4 occurrences).
  const firstOfMonth = new Date(y, now.getMonth(), 1);
  const daysToSat = (6 - firstOfMonth.getDay() + 7) % 7;
  const occurrences = [];
  for (let d = 1 + daysToSat; d <= lastDay; d += 7) {
    occurrences.push(y + '-' + mm + '-' + String(d).padStart(2, '0'));
  }

  return {
    user: { id: 'e2e-user-1', email: 'e2e@budget.local', user_metadata: { name: 'E2E' } },
    templates: [{
      id: 'tplA',
      preset: 'weekly',
      startDate: occurrences[0],
      endDate: lastDayStr,
      endType: 'date',
      amount: 50,
      type: 'expense',
      category: 'Bills',
      note: 'E2E weekly',
      description: '',
      user_id: 'e2e-user-1'
    }],
    plain: [
      { id: 'txn-plain-1', date: y + '-' + mm + '-03', amount: 120, type: 'expense', category: 'Food', note: 'groceries', user_id: 'e2e-user-1' },
      { id: 'txn-plain-2', date: y + '-' + mm + '-18', amount: 80, type: 'expense', category: 'Transport', note: 'bus', user_id: 'e2e-user-1' }
    ]
  };
}

// ---------------------------------------------------------------------------
// Poll a JS expression inside the page until truthy or timeout
// ---------------------------------------------------------------------------
async function waitFor(page, fnExpr, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await page.evaluate(fnExpr)) return true;
    } catch (e) { /* page not ready yet */ }
    await sleep(150);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Evaluate in the page with retries: the app sometimes triggers its own
// navigation/reload during boot (service worker / update flow), which destroys
// the execution context. Retry until the page is stable again.
// ---------------------------------------------------------------------------
async function evaluate(page, fn, arg, timeoutMs) {
  const start = Date.now();
  const limit = timeoutMs || 25000;
  for (;;) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((/destroyed|navigation|Target closed|not defined|is not defined|context/i.test(msg)) && Date.now() - start < limit) {
        await sleep(600);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const seed = buildSeed();
  // Self-logging: also append every console line to e2e_log.txt (plain UTF-8,
  // avoids PowerShell's UTF-16 redirect issues in this environment).
  const logPath = path.join(__dirname, '..', 'e2e_log.txt');
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => { logStream.write(a.map(String).join(' ') + '\n'); origLog(...a); };
  console.error = (...a) => { logStream.write('ERR: ' + a.map(String).join(' ') + '\n'); origErr(...a); };

  // Watchdog: never hang the CI-style run.
  const watchdog = setTimeout(() => {
    console.error('E2E watchdog: forcing exit after timeout');
    process.exit(2);
  }, 180000);
  watchdog.unref();

  console.log('========================================================');
  console.log(' E2E — bulk recurring multi-delete + post-delete checks');
  console.log('========================================================');

  const server = await startServer(PORT);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
      '--disable-dev-shm-usage', '--no-first-run', '--no-zygote', '--single-process'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('  [pageerror] ' + String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error] ' + m.text().slice(0, 300)); });

    // Seed localStorage ONLY on the first document (sentinel key), so a later
    // reload keeps the post-delete state intact. Also block non-local network
    // so Supabase calls fail fast and the app stays fully offline/deterministic.
    await page.evaluateOnNewDocument((s) => {
      if (!localStorage.getItem('__e2e_seeded')) {
        localStorage.setItem('__e2e_seeded', '1');
        localStorage.setItem('cached_current_user', JSON.stringify(s.user));
        localStorage.setItem('offline_transactions', JSON.stringify(s.plain));
        localStorage.setItem('recurring_templates', JSON.stringify(s.templates));
        localStorage.setItem('deleted_recurring_dates', '[]');
        localStorage.setItem('offline_transactions_owner', s.user.id);
        localStorage.setItem('app_lang', 'el');
        localStorage.setItem('active_tab', 'trans');
        localStorage.setItem('settings_hide_amounts', 'false');
      }
      const origFetch = window.fetch;
      window.fetch = function (url, opts) {
        const u = String(url);
        if (!u.startsWith('http://127.0.0.1') && !u.startsWith('http://localhost')) {
          return Promise.reject(new Error('E2E: network blocked'));
        }
        return origFetch.apply(this, arguments);
      };
      // Force the app to consider itself offline: a failed Supabase session
      // refresh then follows the OFFLINE GUARD (keeps cached user + local data)
      // instead of the sign-out path (which wipes localStorage). This only
      // changes the app's perception — the real network still works.
      try {
        Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
      } catch (e) { }
      window.dispatchEvent(new Event('offline'));

      // Avoid app-initiated reloads from a previously-registered service worker.
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => { });
        // Also prevent NEW registration: a PWA service worker takes control and
        // triggers a `controllerchange` reload, which destroys the execution
        // context mid-test. The app works fine without it for this E2E.
        navigator.serviceWorker.register = () => Promise.resolve({});
      }
    }, seed);

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
    console.log('  [info] page loaded, waiting for app boot...');

    const booted = await waitFor(page,
      `typeof state !== 'undefined' && typeof processRecurringTemplates === 'function' && !!document.getElementById('transactions-list')`,
      25000);
    check('app boots and #transactions-list exists', booted);
    await sleep(500);

    // ------------------------------------------------------------------
    // Setup: inject the seed directly into state (self-contained) and render.
    // ------------------------------------------------------------------
    const setup = await evaluate(page, (s) => {
      state.currentUser = s.user;
      state.transactions = s.plain.map((t) => ({ ...t }));
      state.recurringTemplates = s.templates.map((t) => ({ ...t }));
      state.deletedRecurringDates = [];
      if (typeof DEFAULT_ACCOUNTS !== 'undefined') state.accounts = DEFAULT_ACCOUNTS.slice();
      if (typeof DEFAULT_CATEGORIES !== 'undefined') state.categories = DEFAULT_CATEGORIES.slice();
      const now = new Date();
      state.selectedYear = now.getFullYear();
      state.selectedMonth = now.getMonth();
      processRecurringTemplates();
      calculateInitialBalances();
      updateUI();
      renderTransactionsTab();
      // Persist everything so any later navigation boots the same data.
      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      const rec = (state.transactions || []).filter((t) => String(t.recurring_template_id) === 'tplA');
      return {
        templateCount: (state.recurringTemplates || []).length,
        recCount: rec.length,
        recDates: rec.map((t) => String(t.date).split('T')[0]).sort(),
        plainCount: (state.transactions || []).filter((t) => !t.recurring_template_id).length,
        itemCount: document.querySelectorAll('#transactions-list .transaction-item').length,
        selectedMonth: state.selectedMonth,
        selectedYear: state.selectedYear
      };
    }, seed);
    check('recurring template is loaded', setup.templateCount === 1, JSON.stringify(setup));
    check('weekly occurrences generated in this month (>= 2)', setup.recCount >= 2, JSON.stringify(setup));
    check('plain (non-recurring) transactions present', setup.plainCount === 2, JSON.stringify(setup));
    // Give the render scheduler a moment and confirm the rows are in the DOM.
    const rendered = await waitFor(page,
      `document.querySelectorAll('#transactions-list .transaction-item').length >= ${setup.recCount + setup.plainCount}`,
      8000);
    check('transactions list rendered', rendered, 'itemCount was ' + setup.itemCount);

        // ------------------------------------------------------------------
    // Select the first TWO recurring occurrences and press delete
    // ------------------------------------------------------------------
    const sel = await evaluate(page, (s) => {
      // Guard: a boot navigation may have reset in-memory state. Re-inject the
      // template if needed so the recurring detection works.
      if (!(state.recurringTemplates || []).some((t) => String(t.id) === 'tplA')) {
        state.recurringTemplates = s.templates.map((t) => ({ ...t }));
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        processRecurringTemplates();
        calculateInitialBalances();
        updateUI();
        renderTransactionsTab();
      }
      const rec = (state.transactions || [])
        .filter((t) => String(t.recurring_template_id) === 'tplA')
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const id1 = String(rec[0].id);
      const id2 = String(rec[1].id);
      const d1 = String(rec[0].date).split('T')[0];
      const d2 = String(rec[1].date).split('T')[0];
      enterSelectionMode();
      toggleSelection(id1);
      toggleSelection(id2);
      return {
        id1: id1, id2: id2, d1: d1, d2: d2,
        selected: Array.from(state.selectedIds),
        selBarActive: document.getElementById('selection-bar').classList.contains('active')
      };
    }, seed);
    check('selection mode active with exactly 2 rows', sel.selected.length === 2 && sel.selBarActive, JSON.stringify(sel));

    const clickResult = await evaluate(page, () => {
      if (state.selectedIds.size < 2) {
        // Selection was lost (e.g. after a re-render) — re-select the first two rows.
        const rec = (state.transactions || [])
          .filter((t) => String(t.recurring_template_id) === 'tplA')
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        enterSelectionMode();
        toggleSelection(String(rec[0].id));
        toggleSelection(String(rec[1].id));
      }
      const btn = document.getElementById('selection-delete-btn');
      if (!btn) return { clicked: false, reason: 'no #selection-delete-btn', selected: state.selectedIds.size };
      btn.click();
      return { clicked: true, selected: state.selectedIds.size };
    });
    await sleep(450);
    check('delete button click dispatched', clickResult.clicked, JSON.stringify(clickResult));

    // ------------------------------------------------------------------
    // The 3-option recurring modal (bulk variant) must have opened
    // ------------------------------------------------------------------
    const modal = await evaluate(page, () => {
      const m = document.getElementById('recurring-delete-step1-modal');
      const descEl = document.querySelector('#recurring-delete-step1-modal [data-i18n="recurring_delete_desc"]');
      const radios = Array.from(document.querySelectorAll('input[name="recurring_delete_scope"]')).map((r) => r.value);
      const ctx = window._activeRecurringDeleteContext;
      return {
        active: m ? m.classList.contains('active') : false,
        desc: descEl ? descEl.textContent : '',
        radios: radios,
        bulkMode: !!(ctx && ctx.bulkMode),
        entries: ctx && ctx.bulkEntries ? ctx.bulkEntries.length : 0
      };
    });
    check('3-option recurring modal opened (not a plain confirm)', modal.active, JSON.stringify(modal));
    check('modal is the bulk variant with 2 selected entries', modal.bulkMode && modal.entries === 2, JSON.stringify(modal));
    check('bulk description mentions the 2 recurring selections', /2 επαναλαμβανόμενες/.test(modal.desc), modal.desc);
    check('radio options are single/future/all', modal.radios.join(',') === 'single,future,all', modal.radios.join(','));

        // ------------------------------------------------------------------
    // Choose scope 'single' and confirm the deletion
    // ------------------------------------------------------------------
    const confirmResult = await evaluate(page, () => {
      const radio = document.querySelector('input[name="recurring_delete_scope"][value="single"]');
      const btn = document.getElementById('recurring-delete-step1-confirm-btn');
      if (!radio || !btn) return { clicked: false, hasRadio: !!radio, hasBtn: !!btn };
      radio.checked = true;
      btn.click();
      return { clicked: true };
    });
    await sleep(500);
    check('confirm button clicked', confirmResult.clicked, JSON.stringify(confirmResult));

    const after = await evaluate(page, (e2e) => {
      const ids = (state.transactions || []).map((t) => String(t.id));
      const trash = state.trashTransactions || [];
      const group = trash[0] || null;
      const domIds = Array.from(document.querySelectorAll('#transactions-list .transaction-item')).map((el) => el.getAttribute('data-id'));
      return {
        id1Gone: !ids.includes(e2e.id1),
        id2Gone: !ids.includes(e2e.id2),
        othersKept: (state.transactions || []).filter((t) => String(t.recurring_template_id) === 'tplA').length === e2e.totalRec - 2,
        plainKept: (state.transactions || []).filter((t) => !t.recurring_template_id).length === 2,
        delDates: (state.deletedRecurringDates || []).slice().sort(),
        trashCount: trash.length,
        scope: group ? group.scope : null,
        affectedIds: group ? (group.affectedTransactionIds || []).map(String).sort() : [],
        affectedSnapshotLen: group && group.affectedTransactionsSnapshot ? group.affectedTransactionsSnapshot.length : 0,
        modalClosed: !document.getElementById('recurring-delete-step1-modal').classList.contains('active'),
        domRemoved1: !domIds.includes(e2e.id1),
        domRemoved2: !domIds.includes(e2e.id2)
      };
    }, { id1: sel.id1, id2: sel.id2, totalRec: setup.recCount });

    const expectedDelKeys = ['tplA_' + sel.d1, 'tplA_' + sel.d2].sort();
    check('selected occurrence 1 removed from state', after.id1Gone, JSON.stringify(after));
    check('selected occurrence 2 removed from state', after.id2Gone, JSON.stringify(after));
    check('remaining occurrences of the series kept', after.othersKept, JSON.stringify(after));
    check('plain transactions untouched', after.plainKept, JSON.stringify(after));
    check('deleted-date markers recorded for BOTH selected dates',
      after.delDates.join(',') === expectedDelKeys.join(','), 'expected ' + expectedDelKeys.join(',') + ' got ' + after.delDates.join(','));
    check('single trash group created with the 2 ids only', after.trashCount === 1 && after.scope === 'single' &&
      after.affectedIds.join(',') === [sel.id1, sel.id2].sort().join(',') && after.affectedSnapshotLen === 2, JSON.stringify(after));
    check('modal closed after deletion', after.modalClosed);
    check('deleted rows disappear from the DOM list', after.domRemoved1 && after.domRemoved2, JSON.stringify(after));

        // ------------------------------------------------------------------
    // Reload: the app must boot from the persisted (post-delete) state and
    // must NOT resurrect the deleted occurrences.
    // ------------------------------------------------------------------
    const d1 = setup.recDates[0];
    const d2 = setup.recDates[1];
    const totalRec = setup.recCount;

    await page.reload({ waitUntil: 'load', timeout: 30000 });
    console.log('  [info] reloaded, re-booting...');
    const rebooted = await waitFor(page,
      `typeof state !== 'undefined' && typeof processRecurringTemplates === 'function' && !!document.getElementById('transactions-list')`,
      25000);
    check('app re-boots after reload', rebooted);
    await sleep(600);

    const reloaded = await evaluate(page, (e) => {
      const delDates = (state.deletedRecurringDates || []).slice().sort();
      const tplTxs = (state.transactions || []).filter((t) => String(t.recurring_template_id) === 'tplA');
      const storedIds = (JSON.parse(localStorage.getItem('offline_transactions') || '[]') || []).map((t) => String(t.id));
      const trash = state.trashTransactions || [];
      const group = trash[0] || null;
      return {
        delDates: delDates,
        hasD1: tplTxs.some((t) => String(t.date).split('T')[0] === e.d1),
        hasD2: tplTxs.some((t) => String(t.date).split('T')[0] === e.d2),
        remainingRec: tplTxs.length,
        persistedId1Gone: !storedIds.includes(e.id1),
        persistedId2Gone: !storedIds.includes(e.id2),
        trashCount: trash.length,
        scope: group ? group.scope : null
      };
    }, { d1: d1, d2: d2, id1: sel.id1, id2: sel.id2 });

    check('deleted occurrences do NOT resurrect after reload', !reloaded.hasD1 && !reloaded.hasD2, JSON.stringify(reloaded));
    check('remaining recurring occurrences still present after reload', reloaded.remainingRec === totalRec - 2, JSON.stringify(reloaded));
    check('deleted-date markers persisted across reload',
      reloaded.delDates.join(',') === ['tplA_' + d1, 'tplA_' + d2].sort().join(','), JSON.stringify(reloaded));
    check('offline_transactions cache has no deleted rows', reloaded.persistedId1Gone && reloaded.persistedId2Gone, JSON.stringify(reloaded));
    check('trash group persisted across reload', reloaded.trashCount === 1 && reloaded.scope === 'single', JSON.stringify(reloaded));

    // ------------------------------------------------------------------
    // Restore from trash: the deleted occurrences must come back and the
    // deleted-date markers must be cleared.
    // ------------------------------------------------------------------
    const restored = await evaluate(page, () => {
      state.isSupabaseEnabled = false; // keep the restore fully offline
      const group = (state.trashTransactions || [])[0];
      if (!group) return { error: 'no trash group' };
      restoreTrashGroup(String(group.id));
      const tplTxs = (state.transactions || []).filter((t) => String(t.recurring_template_id) === 'tplA');
      const snapIds = (group.affectedTransactionsSnapshot || []).map((t) => String(t.id));
      const restoredIds = tplTxs.map((t) => String(t.id));
      return {
        snapIds: snapIds,
        restoredBack: snapIds.every((sid) => restoredIds.includes(sid)),
        delDates: (state.deletedRecurringDates || []).slice(),
        trashCount: (state.trashTransactions || []).length
      };
    });
    check('restore brings the 2 deleted occurrences back', restored.restoredBack, JSON.stringify(restored));
    check('restore clears the deleted-date markers', restored.delDates.length === 0, JSON.stringify(restored));
    check('restore removes the trash group', restored.trashCount === 0, JSON.stringify(restored));

    // ------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------
    console.log('========================================================');
    console.log(' RESULT: ' + failures + ' FAIL / ' + (checks - failures) + ' PASS (of ' + checks + ')');
    console.log('========================================================');

    await browser.close();
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error('E2E crashed:', err);
    try { await browser.close(); } catch (e) { }
    server.close();
    process.exit(1);
  }
}

main();