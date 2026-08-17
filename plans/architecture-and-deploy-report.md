# Budget Assistant — Architecture & Universal Deploy Report

**Scope:** Read-only architectural analysis of (A) the 32,565-line `app.js` for modularization opportunities, and (B) the Universal Deploy/release pipeline for optimization opportunities.

**Rule honored:** No files were modified. This report is for review only. Implementation proceeds only after explicit approval per phase (REPORT → APPROVAL → IMPLEMENT → VERIFY → STOP).

---

# PART A — APP.JS MODULARIZATION ANALYSIS

## 1. Executive Summary

`app.js` is a **32,565-line** single-file application containing **333+ functions** spanning every feature of the app: currency, premium, recurring templates, calculator, stats, categories, notifications, boot/init, Supabase auth, financial health/forecasting, data loading, recurring processing, transaction CRUD, UI rendering, all 5 tabs, event listeners, modal management, transaction form, currency picker, premium purchase, export, search, month picker, pull-to-refresh, selection mode, swipe-to-back, category manager, notes, tab swipe, currency display, settings, lock screen, auth, family, guest mode, sync, profile, date picker, note autocomplete, settings subscreens, notifications/alerts, time picker, feedback, financial health modal, recurring modal, advisor/AI, recurring templates modal, trash bin, onboarding/demo, import/export, data reset, user guide, recurring delete, and calendar.

The file is **not** a monolith by accident — it is a monolith by *architecture*: it uses plain `<script>` tags with **global scope sharing**, a central mutable `state` object, and heavy DOM coupling. The existing 5 extracted modules (`constants.js`, `utils.js`, `translations.js`, `transactionMerge.js`, `receiptStorage.js`) prove the **UMD wrapper pattern** works and is the sanctioned extraction mechanism.

**Key finding:** The single biggest coupling hotspot is the central `state` object (line 365) and the `window.*` global namespace. Any extraction must preserve these contracts. The safest extractions are **pure/stateless helper clusters** that already depend only on `BAConstants`/`BAUtils` or on `state` read-only.

**Bottom line:** Full modularization is a **multi-phase, high-risk** endeavor. The first 5–10 extractions are safe and low-risk. The remaining features (sync, notes, family, AI advisor) are deeply entangled and should be extracted **later or never** without a state-access refactor first.

---

## 2. Architecture Map (Current State)

### 2.1 Execution Model
- **Plain `<script>` tags** (NOT ES modules). All functions and the `state` object live on the **global scope**.
- Extracted modules use a **UMD wrapper** (CommonJS for `node:test` + browser global assignment).
- Existing module globals: `window.BAConstants`, `window.BAUtils`, `window.TransactionMerge`, `window.ReceiptStorage`, `window.translations`.
- `state` is exposed as `window.state` for `web-ui.js` (desktop web UX).

### 2.2 Boot Sequence
`DOMContentLoaded → _bootApp() → initApp()`:
1. `forceCloseAllModals()`
2. `loadConfig()`
3. `initSettingsFromStorage()`
4. `initOverlayPlacement()`
5. `_initAutoLock()`
6. `initMultiCurrency()`
7. `loadNotifications()`
8. `initLocalNotifications()`
9. `initSupabase()`
10. `setupEventListeners()`
11. `initPullToRefresh()`
12. `initSwipeToBack()`
13. `initTabSwipeNavigation()`
14. `resetAllTabScreenStyles()`
15. `initRippleEffects()`
16. `initLightboxPinchZoom()`
17. `loadOfflineData()`
18. `restoreActiveModalsWithoutTransition()`
19. Premium return handler, cold-start fade-in, desktop web UX hook

There is a **half-init watchdog** (lines 2162–2192) that detects partial initialization.

### 2.3 Data Flow
- **Supabase** is the source of truth (RLS-protected). Tables: `transactions`, `categories`, `accounts`, `recurring_templates`, `notes`, `notes_trash`, `budgets`, `profiles`, `family_members`, `invites`, `ai_conversations`, `feedback`, `trash`.
- **Offline-first:** localStorage caches (`offline_transactions`, `offline_accounts`, `offline_categories`, `offline_transactions_owner`) + a sync queue (`money_manager_sync_queue`).
- **Realtime:** Supabase realtime subscriptions with suppression guards (`_suppressRealtimeEvents`, `suppressRealtimeFor`, `withRealtimeSuppression`).
- **IndexedDB:** receipts (`BudgetReceiptsDB`/`receipts` store) via `ReceiptStorage`.

---

## 3. Function/Feature Dependency Map

The function map (333+ functions) organizes into these feature clusters with their line ranges:

| Feature | Lines | Functions | Coupling |
|---------|-------|-----------|----------|
| Currency bootstrap guard | 1–344 | `ensureCurrencyService`, `FallbackCurrencyService` | `window.CurrencyService` |
| Global state + premium | 345–507 | `state`, `PREMIUM_LIMITS`, `isPremium`, `requirePremium` | `state`, `window` |
| Recurring template mapping | 508–776 | `mapTemplateToDb/FromDb`, dedup helpers | `state`, supabase |
| Language/date helpers | 777–944 | `applyLanguage`, `getMonthName`, `formatGreekDateTime` | `state.lang`, DOM |
| Calculator | 945–1036 | `evaluateCalcBuffer`, `formatCalcDisplay` | DOM |
| Stats date helpers | 1037–1122 | `getStatsDateRange`, `formatStatsPeriodTitle` | `state` |
| Category helpers | 1123–1209 | `resolveCategoryInfo`, emoji helpers | `BAConstants` |
| Notifications | 1210–1601 | `loadNotifications`, `scheduleDailyReminder`, `scheduleNoteReminder` | `state`, Capacitor |
| Boot/init | 1602–2266 | `initApp`, `_bootApp`, dialogs | `state`, DOM |
| Supabase/auth | 2267–3015 | `initSupabase`, `initSupabaseAuth`, `loadUserProfiles` | `state.supabaseClient` |
| Financial health/forecasting | 3036–3552 | `calculateFinancialHealthScore`, `calculateForecasting` | `state` |
| Data loading | 3553–4116 | `loadData`, `loadOfflineData`, dedup | `state`, supabase |
| Recurring processing | 4117–4637 | `processRecurringTemplates`, `generateDeterministicUUID` | `state`, supabase |
| Save/delete transactions | 4638–4983 | `saveTransaction`, `deleteTransaction`, offline variants | `state`, supabase |
| UI rendering | 4984–5748 | `updateUI`, `renderTransactionsTab` | `state`, DOM |
| Stats tab | 5749–7005 | `renderStatsTab`, budgets, chart | `state`, Chart.js |
| Accounts tab | 7006–7970 | `renderAccountsTab` | `state`, DOM |
| Event listeners | 7971–9044 | `setupEventListeners` | DOM, `state` |
| Modal management | 9045–9661 | `openModal`, `closeModal`, `switchTab` | DOM |
| Transaction form | 9662–11174 | `openAddTransactionModal`, category/subcategory CRUD | `state`, supabase |
| Currency picker | 11175–11603 | `openCurrencyPickerModal`, multi-currency | `state`, `CurrencyService` |
| Premium purchase | 11604–12028 | `startPremiumPurchase`, Play Billing | `fetch`, Capacitor |
| Export | 12029–12604 | `exportToExcel`, `generatePdfBlob`, CSV | `state`, Filesystem |
| Search | 12605–14452 | `handleSearchChange`, `renderGroupedTransactions` | `state`, DOM |
| Month picker | 14453–14599 | `renderMonthPickerBS` | DOM |
| Pull to refresh | 14600–14767 | `initPullToRefresh` | DOM |
| Selection mode | 14768–14980 | `deleteSelectedTransactions` | `state`, supabase |
| Swipe to back | 14981–15421 | `initSwipeToBack` | Capacitor, DOM |
| Category manager | 15422–16140 | `renderCategoryManagerList` | `state`, supabase |
| Notes | 16141–18058 | `loadNotes`, `syncNotes`, `renderNotesList` | `state`, supabase |
| Tab swipe | 18127–18609 | `initTabSwipeNavigation`, ripple, pinch zoom | DOM |
| Currency display | 18610–18883 | `getCurrencySymbol`, `computeNetWorth` | `state`, `CurrencyService` |
| Settings | 18884–19607 | `openSettingsPicker`, `applyTheme`, auto-lock | `state`, DOM |
| Lock screen | 19608–20147 | PIN, biometrics, secure mode | Capacitor, `state` |
| Auth | 20148–20894 | `handlePasswordAuth`, Google, logout | `state.supabaseClient` |
| Family | 20895–22065 | `renderPartnerSection`, invite, roles | `state`, supabase |
| Guest mode/force update | 22066–22553 | `forceAppUpdate`, `enterGuestMode` | Capacitor |
| Sync | 22554–23871 | `syncLocalTransactionsToCloud`, `processSyncQueue`, realtime | `state`, supabase |
| Profile | 23872–24495 | `openProfileSheet`, avatar | `state`, supabase |
| Date picker | 24496–25642 | `openCustomDatePicker`, calendar | DOM |
| Note autocomplete | 25643–25855 | `renderNoteAutocomplete` | `state` |
| Settings subscreens | 25856–26040 | `openSettingsSubscreen` | DOM |
| Notifications/alerts | 26041–26500 | `checkRecurringPaymentAlerts`, digests | Capacitor |
| Time picker | 26501–26855 | `openModernTimePicker`, clock dial | DOM |
| Feedback | 26856–26976 | `submitUserFeedback` | supabase |
| Financial health modal | 26977–27300 | `openFinancialHealthModal` | `state` |
| Recurring modal | 27301–27590 | `openRecurringModal`, `saveRecurringSettings` | `state`, supabase |
| Advisor/AI | 27591–29431 | `submitCoachQuery`, `processCoachQuery`, coach analyses | `state`, AIEngine |
| Recurring templates modal | 29432–29900 | `openRecurringTemplatesModal`, edit | `state`, supabase |
| Trash bin | 30089–30425 | `fetchTrashFromCloud`, `restoreTransaction` | supabase |
| Onboarding/demo | 30426–30665 | `onboardingAddDemoData` | `state`, supabase |
| Import/export | 30666–31068 | `importExcelData`, CSV parse | `state`, supabase |
| Data reset/delete account | 31069–31347 | `clearLocalData`, delete account | supabase |
| User guide | 31348–31879 | guide rendering | DOM |
| Recurring delete | 31880–32337 | recurring delete flows | `state`, supabase |
| Calendar/date picker | 32426–32565 | calendar rendering | DOM |

---

## 4. Shared State Map

The central `state` object (line 365) is the **primary coupling hotspot**. Its properties:

- **Identity/auth:** `currentUser`, `userProfile`, `partnerProfile`, `familyProfiles`, `isLoggingOut`, `isSupabaseEnabled`, `supabaseClient`, `supabaseConfig`
- **Data:** `transactions`, `trashTransactions`, `accounts`, `categories`, `notes`, `recurringTemplates`, `deletedRecurringDates`, `notifications`, `budgets`
- **UI:** `activeTab`, `selectionMode`, `selectedIds`, `lang`, `selectedYear/Month`, `overviewYear`, `statsType/PeriodType/Date`
- **Sync:** `syncStatus`

**Global mutable state beyond `state`:**
- `_recentlySavedTxIds`, `_RECENTLY_SAVED_LS_KEY`, `_RECENTLY_SAVED_GRACE_MS` (dedup guard)
- `_pendingReceiptFiles` (transaction form)
- `_lastSubcatDeleteBackup` (undo)
- `statsChartInstance` (Chart.js)
- `_suppressRealtimeEvents` (window property)
- `window._settingsSubscreenHistory`

---

## 5. Coupling Hotspots

1. **The `state` object** — read/written by nearly every function. Highest blast radius.
2. **`setupEventListeners()`** (7971–9044) — a 1,000+ line function binding every DOM event; touches every feature.
3. **`loadData()`** (3705–3984) — orchestrates categories, accounts, recurring templates, paginated transactions, dedup, balances, localStorage. Depends on nearly everything.
4. **`processRecurringTemplates()`** (4403–4626) — reads `state.transactions`, `state.recurringTemplates`, `state.deletedRecurringDates`; writes via `saveTransactionOffline`, `_markRecentlySaved`, `enqueueSyncMutation`, `calculateInitialBalances`.
5. **`syncLocalTransactionsToCloud` / `processSyncQueue`** — the offline/cloud reconciliation core; touches supabase, localStorage queue, realtime suppression.
6. **`updateUI()` / `_updateUIImpl()`** — the render pipeline; reads all data, writes all DOM.
7. **`initApp()`** — the boot orchestrator; init-order dependencies.
8. **`renderTransactionsTab()`** — reads transactions, accounts, categories, recurring templates, currency; writes the main tab DOM.

---

## 6. Hidden Side Effects

- **`_markRecentlySaved(id)` / `_markRecentlyDeleted(id)`** — dedup guards with localStorage keys and grace timers; must be called in exact order relative to saves/deletes.
- **`suppressRealtimeFor` / `withRealtimeSuppression`** — realtime event suppression must wrap cloud writes to avoid echo loops.
- **`saveTransactionOffline`** — writes to localStorage cache AND enqueues a sync mutation; order matters.
- **`enqueueSyncMutation` / `dequeueSyncMutation`** — mutate the localStorage sync queue; must stay consistent with cloud writes.
- **`calculateInitialBalances()`** — recomputes account balances from transactions; called after data load and after recurring generation.
- **`backfillRecurringTemplateIds()` / `autoRecoverTemplatesFromHistory()`** — mutate transactions and templates during load.
- **`applyLanguage(lang)`** — re-renders large parts of the UI; called on language change.
- **`applyTheme` / `applyFontSize`** — mutate CSS variables and native theme state.
- **`_initAutoLock` / `_resetAutoLockTimer` / `_triggerAutoLock`** — timer-based side effects.
- **`updateOTADiagnostic()`** — writes OTA diagnostic info.
- **`_notifyNativeContentPainted()`** — native bridge notification after first paint.

---

## 7. Candidate Module Boundaries

Based on **actual architecture** (cohesion + coupling), not forced categories:

### Tier 1 — Pure/stateless helpers (SAFEST)
- **Date/time helpers:** `getMonthName`, `formatGreekDateTime`, `formatRelativeTime`, `formatNoteTimestamp`, `getTransactionTime`, `compareTransactions`
- **Currency formatting:** `getCurrencySymbol`, `formatCurrency`, `formatDisplayAmount`, `displayAmountInBaseCurrency`, `getDisplayCurrency`
- **Category helpers:** `stripLeadingEmoji`, `getFirstEmojiCodepoint`, `normalizeCategoryName`, `getCategoryDisplayName`, `getSubcategoryDisplayName`, `isDefaultSubcategory`, `classifyCategory`
- **String/calc helpers:** `evaluateCalcBuffer`, `hasPendingMathOperator`, `formatCalcDisplay`, `normalizeText`, `highlightMatch`, `promiseTimeout`

### Tier 2 — Read-only `state` consumers (SAFE)
- **Financial health/forecasting:** `calculateFinancialHealthScore`, `calculateForecasting`, `getActiveTransactions`, `isTransferTransaction`, `calculateInitialBalances`
- **Stats aggregation:** `getStatsDateRange`, `syncStatsDate`, `formatStatsPeriodTitle`, `wrapPeriodTitleWithSpans`

### Tier 3 — Feature islands with moderate coupling (EXTRACT LATER)
- **Export:** `exportToExcel`, `generatePdfBlob`, `blobToBase64`, `downloadBlob`, `shareViaWebApi`, `exportRowsAsCSV` (depends on `state.transactions` + Filesystem/Share)
- **Import:** `parseCSV`, `autoMapColumns`, `normalizeImportDate`, `normalizeImportAmount`, `resolveImportType` (pure-ish)
- **Search:** `handleSearchChange`, `renderGroupedTransactions`, filter helpers (depends on `state` + DOM)
- **Calculator UI:** keypad functions (DOM + `state`)

### Tier 4 — Deeply entangled (EXTRACT LATER or NEVER without refactor)
- **Sync:** `syncLocalTransactionsToCloud`, `processSyncQueue`, realtime handlers
- **Notes:** `loadNotes`, `syncNotes`, `renderNotesList`, note editor (state + supabase + DOM + Capacitor)
- **Family:** `renderPartnerSection`, invite/role management
- **AI Advisor:** `submitCoachQuery`, `processCoachQuery`, all `runCoach*` analyses
- **Recurring:** `processRecurringTemplates`, recurring modals (state + supabase + dedup guards)

---

## 8. What MUST / SHOULD Stay Together

**MUST stay together (atomic, high internal coupling):**
- **Sync core:** `enqueueSyncMutation`, `dequeueSyncMutation`, `processSyncQueue`, `syncLocalTransactionsToCloud`, `suppressRealtimeFor`, `withRealtimeSuppression`, `handleRealtimeTransactionChange`, `handleRealtimeCategoryChange` — these form one transactional unit.
- **Recurring generation:** `processRecurringTemplates`, `getRecurringDatesForMonth`, `generateDeterministicUUID`, `_markRecentlySaved`, `saveTransactionOffline` — the dedup/guard logic is inseparable.
- **Transaction CRUD:** `saveTransaction`, `saveTransactionOffline`, `deleteTransaction`, `deleteTransactionOffline` — offline/cloud duality.
- **Boot sequence:** `initApp`, `_bootApp`, `loadConfig`, `initSupabase`, `setupEventListeners` — init-order dependent.
- **Notes sync:** `loadNotes`, `syncNotes`, `mergeNotes`, `upsertNoteToCloud`, `buildNotesScopeQuery` — reconciliation unit.

**SHOULD stay together (cohesive feature islands):**
- All `render*Tab` functions with their tab-specific helpers.
- All category CRUD (form picker + category manager + subcategory global rename/delete + undo).
- All currency picker + multi-currency display functions.
- All lock screen + biometrics + secure mode functions.
- All auth functions.

---

## 9. What Can Be Safely Extracted

The **safest** extractions are pure functions that:
1. Depend only on `BAConstants`/`BAUtils` or on `state` **read-only**.
2. Have **no DOM writes**, **no supabase calls**, **no Capacitor calls**, **no localStorage writes**.
3. Are **not** part of the boot/init-order chain.

Candidate pure clusters (all Tier 1 above) plus:
- `getMonthName`, `getTransactionTime`, `compareTransactions`
- `evaluateCalcBuffer`, `hasPendingMathOperator`, `formatCalcDisplay`
- `stripLeadingEmoji`, `getFirstEmojiCodepoint`, `normalizeCategoryName`, `getCategoryDisplayName`, `getSubcategoryDisplayName`, `isDefaultSubcategory`
- `formatCurrency`, `getCurrencySymbol`, `formatDisplayAmount`, `displayAmountInBaseCurrency`, `getDisplayCurrency`
- `promiseTimeout`, `normalizeText`, `highlightMatch`
- `classifyCategory`, `isTransferTransaction`
- `getStatsDateRange`, `formatStatsPeriodTitle`, `wrapPeriodTitleWithSpans`

---

## 10. Top 10 Safest First Extractions

Ranked by **HIGH COHESION + LOW COUPLING + LOW REGRESSION RISK**:

| # | Module | Functions | Deps | Risk | Why Safe |
|---|--------|-----------|------|------|----------|
| 1 | **Date/Time helpers** | `getMonthName`, `getTransactionTime`, `compareTransactions`, `formatRelativeTime`, `formatNoteTimestamp`, `formatGreekDateTime` | `BAConstants` (months) | Very Low | Pure, no DOM/supabase |
| 2 | **Currency formatting** | `formatCurrency`, `getCurrencySymbol`, `formatDisplayAmount`, `displayAmountInBaseCurrency`, `getDisplayCurrency`, `getTransactionsBaseCurrency` | `state` (read), `CurrencyService` | Very Low | Read-only state |
| 3 | **Category helpers** | `stripLeadingEmoji`, `getFirstEmojiCodepoint`, `normalizeCategoryName`, `getCategoryDisplayName`, `getSubcategoryDisplayName`, `isDefaultSubcategory`, `classifyCategory` | `BAConstants` | Very Low | Pure |
| 4 | **Calculator logic** | `evaluateCalcBuffer`, `hasPendingMathOperator`, `formatCalcDisplay` | none | Very Low | Pure |
| 5 | **String/format helpers** | `normalizeText`, `highlightMatch`, `promiseTimeout`, `escapeHtml` (already in BAUtils) | none | Very Low | Pure |
| 6 | **Stats date helpers** | `getStatsDateRange`, `syncStatsDate`, `formatStatsPeriodTitle`, `wrapPeriodTitleWithSpans` | `state` (read) | Low | Read-only |
| 7 | **Financial health calc** | `calculateFinancialHealthScore`, `calculateForecasting`, `getActiveTransactions`, `isTransferTransaction`, `calculateInitialBalances` | `state` (read) | Low-Med | Pure math, but `calculateInitialBalances` writes state — split it |
| 8 | **Import parsers** | `parseCSV`, `autoMapColumns`, `normalizeImportDate`, `normalizeImportAmount`, `resolveImportType` | none | Low | Pure |
| 9 | **Export core** | `exportRowsAsCSV`, `blobToBase64`, `generatePdfBlob` (PDF part) | none | Low | Pure blob generation |
| 10 | **Notification helpers** | `uuidToNotificationId`, `addInAppNotification` (pure part) | `state` (read) | Low | Read-only |

---

## 11. Extraction Risk Matrix

| Risk Level | Meaning | Examples | Mitigation |
|------------|---------|----------|------------|
| **Very Low** | Pure, no side effects | Date/currency/category helpers | Unit tests + verify-health |
| **Low** | Read-only `state` | Stats date, financial health | Unit tests with fixture state |
| **Medium** | DOM writes, no supabase | Export UI, search render | Manual regression on all tabs |
| **High** | supabase + localStorage + guards | Sync, recurring, notes | Full integration test, staged rollout |
| **Very High** | Boot/init-order + global side effects | `initApp`, `setupEventListeners` | DO NOT extract |

---

## 12. Proposed Future Architecture

```
index.html
  └─ <script> js/constants.js        (BAConstants)   [EXISTS]
  └─ <script> js/utils.js            (BAUtils)       [EXISTS]
  └─ <script> js/translations.js     (translations)  [EXISTS]
  └─ <script> js/transactionMerge.js (TransactionMerge) [EXISTS]
  └─ <script> js/receiptStorage.js   (ReceiptStorage) [EXISTS]
  └─ <script> js/CurrencyService.js  (CurrencyService) [EXISTS]
  └─ <script> js/dateTime.js         (BADateTime)    [NEW - Tier 1]
  └─ <script> js/currencyFormat.js   (BACurrencyFormat) [NEW - Tier 1]
  └─ <script> js/categoryHelpers.js  (BACategoryHelpers) [NEW - Tier 1]
  └─ <script> js/calcLogic.js        (BACalcLogic)   [NEW - Tier 1]
  └─ <script> js/financialHealth.js  (BAFinancialHealth) [NEW - Tier 2]
  └─ <script> js/importParsers.js    (BAImportParsers) [NEW - Tier 3]
  └─ <script> js/exportCore.js       (BAExportCore)  [NEW - Tier 3]
  └─ <script> js/app.js              (core app, shrinks over time)
```

All new modules use the **UMD wrapper** pattern (CommonJS export + `window.X` global), matching the existing 5 modules. `app.js` retains the `state` object, boot sequence, event listeners, and all DOM/supabase-heavy features.

---

## 13. Phased Migration Plan

**Phase 0 — Verify baseline (already exists):** `verify-health.js` static gate + `npm test`. Keep green.

**Phase 1 — Tier 1 pure helpers (SAFEST):**
- Extract `dateTime.js`, `currencyFormat.js`, `categoryHelpers.js`, `calcLogic.js`.
- Add `<script>` tags in `index.html` **before** `app.js`.
- Keep the original functions in `app.js` as thin wrappers delegating to the module (or remove and update all call sites — prefer delegation first, then remove in a later pass).
- Run `verify-health.js` + full manual regression.

**Phase 2 — Tier 2 read-only state consumers:**
- Extract `financialHealth.js`, `statsDate.js`.
- These read `state`; pass `state` (or the needed slices) as arguments to keep them testable.

**Phase 3 — Tier 3 feature islands:**
- Extract `importParsers.js`, `exportCore.js`.
- These are larger; extract the **pure** sub-functions first, keep the DOM/UI wrappers in `app.js`.

**Phase 4+ — Deeply entangled (OPTIONAL, HIGH RISK):**
- Sync, notes, family, AI advisor. **Require** a state-access refactor first (introduce a `state` accessor module or explicit dependency injection). Do NOT attempt without it.

---

## 14. Required Tests Per Phase

- **Phase 1:** Unit tests for each pure helper (node:test, matching `test/premiumSecurity.test.js` pattern). Verify `verify-health.js` passes.
- **Phase 2:** Unit tests with fixture `state` objects for financial health/forecasting. Golden-value tests for known inputs.
- **Phase 3:** Unit tests for CSV/Excel parsers (round-trip) and blob generation. Manual export regression.
- **Phase 4:** Full integration tests; require a staging environment with real Supabase.

---

## 15. Areas That MUST NOT Be Touched

- **Boot sequence** (`initApp`, `_bootApp`, `loadConfig`, `initSupabase`, `setupEventListeners`) — init-order critical.
- **Sync core** (`enqueueSyncMutation`, `dequeueSyncMutation`, `processSyncQueue`, `syncLocalTransactionsToCloud`, realtime handlers) — transactional integrity.
- **Recurring generation** (`processRecurringTemplates`, `generateDeterministicUUID`, `_markRecentlySaved`) — dedup/guard logic.
- **Transaction CRUD offline/cloud duality** (`saveTransactionOffline`, `deleteTransactionOffline`).
- **The `state` object itself** — its shape is a public contract (`window.state` for `web-ui.js`).
- **Currency bootstrap guard** (`ensureCurrencyService` IIFE) — must run before anything else.
- **`_suppressRealtimeEvents`** window property — realtime echo prevention.

---

## 16. Expected Final app.js Size

- **Phase 1 (Tier 1):** ~2,000–3,000 lines removed → ~29,500–30,500 lines.
- **Phase 2 (Tier 2):** ~1,000–1,500 lines removed → ~28,000–29,500 lines.
- **Phase 3 (Tier 3):** ~1,500–2,000 lines removed → ~26,000–27,500 lines.
- **Phase 4 (deep):** up to ~8,000–10,000 lines removed → ~16,000–19,000 lines (HIGH RISK, optional).

Realistic near-term target: **~26,000–28,000 lines** after Phases 1–3, with the remaining core (sync, notes, family, AI, boot) intact.

---

## 17. Single Sources of Truth / Duplicate Logic

- **Duplicate category resolution:** `resolveCategoryInfo` (1205), `getCategoryInfo` (5653), `getCategoryDisplayName` (5673), `getSubcategoryDisplayName` (5736), `normalizeCategoryName` (5622) — several overlapping category-name helpers. **Consolidate.**
- **Duplicate currency display:** `getCurrencySymbol` (18628), `getTransactionCurrencySymbol` (18727), `getDisplayCurrency` (18825), `getTransactionsBaseCurrency` (18842), `formatDisplayAmount` (18858) — overlapping. **Consolidate.**
- **Duplicate account display:** `getAccountDisplayName` (7738, inside renderAccountsTab) and `getAccountDisplayName` (11192, global) — **two functions with the same name in different scopes.** Consolidate.
- **Duplicate note editor pin functions:** `toggleNoteEditorPin`/`updateNoteEditorPinUI` defined at 17039/17046 AND again at 17987/17990 — **true duplicate definitions.** Remove one.
- **Duplicate `toggleLoader`:** defined at 2314 and again at 2392 (inside `initSupabaseAuth`). Consolidate.
- **Duplicate `clearNoteEditorReminder`:** defined at 16481 and again at 17411. Consolidate.

---

## 18. Final Recommendation

1. **Proceed with Phases 1–3** (Tier 1 pure helpers → Tier 2 read-only state → Tier 3 feature islands). These are safe, low-risk, and reduce `app.js` by ~4,500–6,500 lines.
2. **Use the UMD wrapper pattern** consistently (matches existing modules).
3. **Prefer delegation wrappers** in `app.js` initially, then remove wrappers in a later pass after regression.
4. **Consolidate the identified duplicate functions** (category resolution, currency display, account display, note pin, toggleLoader, clearNoteEditorReminder) — these are low-risk wins.
5. **Do NOT extract** the boot sequence, sync core, recurring generation, transaction CRUD duality, or the `state` object.
6. **Defer Phase 4** (sync, notes, family, AI) until a state-access refactor is approved separately.
7. **Run `verify-health.js` + `npm test` after every phase** before any deploy.

---

# PART B — UNIVERSAL DEPLOY/RELEASE PIPELINE ANALYSIS

## 19. Current Universal Deploy Architecture

The pipeline is orchestrated by `scripts/` and `package.json` scripts:

```
package.json scripts:
  test, version:sync, version:bump, version:check,
  release:deploy, release:native, release:verify-live, release:all, build-deploy
```

**Two main orchestrators:**
- **`release-all.js`** (5 steps): version-bump → version-check (WARN only) → Cloudflare deploy www → release-native → release-verify-live (WARN only)
- **`release-deploy.js`** (7 steps): git status check (aborts on dirty) → version-bump → version-check (strict) → git commit → Cloudflare deploy → release-verify-live

**Supporting scripts:**
- **`version-sync.js`** — syncs version to `index.html`, `sw.js`, `app.js`, `translations.js`, `android/app/build.gradle`, `ota-boot-loader.js`, `js/OTAEngine.js`, then mirrors to `www/`.
- **`version-check.js`** — checks version consistency across files + root/www parity + stale patterns.
- **`version-bump.js`** — increments `version.json`, calls version-sync.
- **`release-native.js`** (6 steps): configure_signing → `npx cap sync android` → `gradlew assembleDebug assembleRelease bundleRelease` → copy APK/AAB to Desktop → Capgo OTA bundle + write `www/version.json` → re-deploy www to Cloudflare.
- **`release-verify-live.js`** — live HTTP verification of `version.json`, `sw.js`, `index.html` with 4 retries/2.5s delay.
- **`verify-health.js`** (401 lines) — static pre-deploy gate: syntax check, `npm test`, script dependency/order check, version consistency, brace balance heuristic.

---

## 20. Complete Deployment Step Map

| Step | Script | Protects Against | Cost |
|------|--------|------------------|------|
| 1. git status check | release-deploy | Dirty working tree → bad commit | Fast |
| 2. version-bump | version-bump | Stale version | Fast |
| 3. version-sync | version-sync | Version drift across files | Fast |
| 4. version-check | version-check | Version inconsistency, stale cache busters | Fast |
| 5. verify-health | verify-health | Syntax errors, test failures, dep order, brace balance | Medium |
| 6. git commit | release-deploy | Reproducibility | Fast |
| 7. Cloudflare deploy (www) | wrangler | Live web update | Medium |
| 8. release-native | release-native | Android build/APK/AAB/OTA | **Slow (gradle)** |
| 9. re-deploy www | release-native | OTA version.json parity | Medium |
| 10. release-verify-live | release-verify-live | Live HTTP correctness | Medium |

---

## 21. Time/Cost Hotspots

1. **`gradlew assembleDebug assembleRelease bundleRelease`** — the dominant cost (minutes). Unavoidable for native, but **only needed when native/OTA changes**.
2. **Cloudflare deploy** — runs **twice** in `release-all` (step 3 and again inside `release-native` step 6). **Redundant.**
3. **`npx cap sync android`** — copies web assets into the Android project; only needed when web assets change.
4. **`npm test` + syntax checks** in verify-health — fast but sequential.

---

## 22. Redundant / Overlapping Checks

1. **`version-check` runs in BOTH `release-all` (WARN) and `release-deploy` (strict).** In `release-all`, the WARN mode means it does not gate — a gap.
2. **`release-all` does NOT run `verify-health.js`** (the static safety gate). **This is a real gap** — the full pipeline can deploy without syntax/test verification.
3. **`release-all` does NOT do the git status check** that `release-deploy` does.
4. **Cloudflare deploy runs twice** in `release-all` (once directly, once inside `release-native`).

---

## 23. Safe Parallelization Opportunities

**Principle: SAFETY > CORRECTNESS > REPRODUCIBILITY > SPEED.** Parallelize only steps with **no data dependency** and **no shared mutable state**.

| Parallel Group | Steps | Why Safe | Time Saved |
|----------------|-------|----------|------------|
| **A. Static checks + native build** | `verify-health.js` (syntax/test) ‖ `npx cap sync android` + `gradlew` | verify-health only reads source; gradle only reads the synced Android project. **Caveat:** `cap sync` must complete before gradle, but verify-health is independent of both. | ~1–2 min |
| **B. Cloudflare deploy ‖ native build** | `wrangler deploy www` ‖ `gradlew` | Web deploy and Android build touch disjoint artifacts (www vs android/). | ~1–3 min |
| **C. Live verification ‖ nothing** | `release-verify-live` after deploy | Must run **after** Cloudflare deploy completes (dependency). Cannot parallelize with deploy. | — |

**Not parallelizable:** version-bump → version-sync → version-check (strict ordering); Cloudflare deploy → release-verify-live (dependency); cap sync → gradle (dependency).

---

## 24. Safe Conditional Execution Opportunities

The biggest win: **skip native/OTA work when only web assets changed**, and **skip the redundant second Cloudflare deploy**.

| Condition | Skip | Why Safe |
|-----------|------|----------|
| **Web-only change** (index.html, app.js, css, js, translations) | `release-native` (gradle, cap sync, OTA) | Native binary unchanged; OTA bundle unchanged. Web deploy + verify-live is sufficient. |
| **Native-only change** (android/, gradle, signing) | Cloudflare web deploy (first one) | Web assets unchanged; only native build + OTA needed. |
| **Both changed** | Nothing | Full pipeline required. |
| **`release-all` after `release-native` already deployed www** | The second Cloudflare deploy inside `release-native` | `release-native` re-deploys www only to publish the OTA `version.json`; if the OTA bundle is unchanged, skip it. |

**Change-classification system (proposed):** A lightweight `git diff --name-only` classifier buckets the change set into `web-only` / `native-only` / `both` / `none`, then selects the appropriate path.

---

## 25. Proposed FAST / STANDARD / HIGH-RISK Paths

### FAST path (web-only change)
```
git status check → version-bump → version-sync → version-check (strict)
→ verify-health → git commit → Cloudflare deploy www → release-verify-live
```
**Skips:** native build, cap sync, OTA, second Cloudflare deploy.
**Time saved:** ~5–10 min (the gradle build).
**Risk:** None — web-only change cannot affect the native binary.

### STANDARD path (both changed, or full release)
```
git status check → version-bump → version-sync → version-check (strict)
→ verify-health → git commit
→ [PARALLEL] Cloudflare deploy www  ‖  cap sync + gradlew
→ release-native (signing, copy APK/AAB, OTA bundle + www/version.json)
→ [skip redundant re-deploy if OTA unchanged] → release-verify-live
```
**Time saved:** ~2–4 min via parallelization.
**Risk:** Low — all safety gates retained.

### HIGH-RISK path (emergency hotfix, skip verification)
```
git status check → version-bump → version-sync → version-check (WARN)
→ Cloudflare deploy www → release-verify-live
```
**Skips:** verify-health (syntax/test), strict version-check, native build.
**Risk:** HIGH — deploy without syntax/test gate. **Only for emergency rollback/hotfix.** Must be explicitly invoked, never the default.

---

## 26. Recommended Optimized Architecture

```
release-all (orchestrator):
  1. git status check            [add — currently missing]
  2. version-bump → version-sync
  3. version-check (strict)      [upgrade from WARN]
  4. verify-health               [add — currently missing]
  5. change-classifier (git diff) → web-only / native-only / both
  6. git commit
  7. if web or both: Cloudflare deploy www
  8. if native or both: cap sync + gradlew (parallel with step 7)
  9. if native or both: release-native (signing, APK/AAB, OTA)
     — skip redundant www re-deploy unless OTA version.json changed
 10. release-verify-live
```

**Key changes vs. current:**
- Add `verify-health` to `release-all` (closes the safety gap).
- Add git status check to `release-all`.
- Upgrade `version-check` from WARN to strict in `release-all`.
- Eliminate the redundant second Cloudflare deploy.
- Parallelize Cloudflare deploy with the gradle build.
- Add the change-classifier to skip native work on web-only changes.

---

## 27. Safety Gates That MUST NEVER Be Removed

1. **`verify-health.js`** (syntax check + `npm test` + dependency order + brace balance) — the only static gate that catches broken code before deploy. **Never skip in STANDARD/FAST paths.**
2. **`version-check` (strict)** — catches version drift and stale cache busters that would break the service worker / OTA. **Never downgrade to WARN in a normal release.**
3. **`release-verify-live`** — confirms the live site actually serves the new version. **Never skip.**
4. **git status check** — prevents committing a dirty tree (reproducibility). **Never skip.**
5. **`cap sync android` before gradle** — ensures the Android project reflects current web assets. **Never reorder.**
6. **Cloudflare deploy before `release-verify-live`** — verify-live depends on deploy. **Never reorder.**

---

## 28. Estimated Time Improvement

| Path | Current | Optimized | Savings |
|------|---------|-----------|---------|
| **FAST (web-only)** | ~10–15 min (full pipeline) | ~3–5 min | **~60–70%** |
| **STANDARD (both)** | ~15–20 min | ~10–13 min | **~30–40%** |
| **HIGH-RISK (hotfix)** | ~10–15 min | ~2–4 min | **~70–80%** |

The dominant savings come from **skipping the gradle build on web-only changes** (FAST path) and **eliminating the redundant Cloudflare deploy** + **parallelizing deploy with gradle** (STANDARD path).

---

## 29. Risks of Optimizing

1. **Change-classifier misclassification** — if a change is mis-bucketed as `web-only` when it actually affects native/OTA, the native binary would be stale. **Mitigation:** make the classifier conservative (any ambiguity → `both`); require explicit override.
2. **Parallelization race** — Cloudflare deploy and gradle both read source; if a file is mid-write during either, output could be inconsistent. **Mitigation:** run parallel steps only after `git commit` (immutable snapshot) or after a clean checkout.
3. **Skipping the redundant www re-deploy** — if the OTA `version.json` genuinely changed but the skip logic misfires, OTA clients could get a stale bundle. **Mitigation:** only skip when the OTA bundle hash is byte-identical to the previously deployed one.
4. **WARN→strict version-check in release-all** — could now block releases that previously passed with warnings. **Mitigation:** fix the underlying version drift first, then flip to strict.
5. **Adding verify-health to release-all** — could now block releases that previously skipped it. **Mitigation:** run it once, fix any latent failures, then make it a hard gate.

---

## 30. Recommended Implementation Order

**Phase D1 — Close safety gaps (no speed change, pure safety):**
1. Add `verify-health` to `release-all`.
2. Add git status check to `release-all`.
3. Upgrade `version-check` from WARN to strict in `release-all`.
4. Fix any latent failures these gates surface.

**Phase D2 — Remove redundancy:**
5. Eliminate the redundant second Cloudflare deploy in `release-native` (skip when OTA bundle unchanged).
6. Consolidate `version-check` to run once per release.

**Phase D3 — Add change-classification:**
7. Implement the `git diff --name-only` classifier (web-only / native-only / both).
8. Wire the FAST path (skip native on web-only).
9. Wire the STANDARD path (parallel Cloudflare deploy ‖ gradle).

**Phase D4 — Optional speed:**
10. Add the explicit HIGH-RISK hotfix path (opt-in only).
11. Add CI integration to run verify-health + tests automatically on every commit.

**After each phase:** run a real release through the pipeline and confirm `release-verify-live` passes before proceeding.

---

# END OF REPORT

**Next step (per the REPORT → APPROVAL → IMPLEMENT → VERIFY → STOP workflow):** Review this report. Approve specific phases (e.g., "App.js Phase 1", "Deploy Phase D1") for implementation. No code was changed.
