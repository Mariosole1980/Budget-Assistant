# Budget Assistant — Desktop Web UX Architecture
## Phase 1: Analysis & Design Proposal

> **Status:** Design Proposal  
> **Scope:** Web/PWA desktop redesign only. Android/Native app untouched.  
> **Date:** 2026-08-09 | Build v1189

---

## 1. Current Web UX Audit

### Αρχιτεκτονική
- **Ενιαία SPA** — index.html (5.032 γραμμές), app.js (~1.27 MB, 29.621 γραμμές), style.css (8.759 γραμμές)
- **4 tabs** μέσω bottom navigation: Κινήσεις / Στατιστικά / Λογαριασμοί / Περισσότερα
- **Web-mode detection** μέσω html.web-mode class (JS αν !Capacitor.isNativePlatform())
- **Υπάρχον desktop block** στο style.css lines 4735-5117: @media (min-width: 768px) με html.web-mode gate

### Τι κάνει το υπάρχον desktop block
- .app-container: CSS Grid 260px sidebar + 1fr content
- .bottom-nav: μετατρέπεται σε left sidebar (260px, vertical flex)
- Trans screen: 2-column grid (2.2fr list + 1fr summary panel)
- Stats screen: 2-column grid (1fr chart + 1.2fr list)
- Accounts screen: 2-column grid (0.9fr overview + 1.6fr accounts)
- More screen: CSS column-count 2

### Κρίσιμα προβλήματα

| Πρόβλημα | Σοβαρότητα |
|----------|-----------|
| Mobile-ported layout — δεν εκμεταλλεύεται το desktop space | CRITICAL |
| Touch-first interactions (user-select:none, scale:0.94 on active) | CRITICAL |
| overflow: hidden on body — anti-pattern για desktop | CRITICAL |
| Scrollbars hidden globally (scrollbar-width: none) | MEDIUM |
| Custom calculator keypad — αντί για keyboard | MEDIUM |
| Bottom sheet modals — αντί για centered dialogs | MEDIUM |
| AI Advisor = bottom sheet 90vh — αντί για split view | MEDIUM |
| Statistics: single donut chart 260px max — σπατάλη space | MEDIUM |
| Search: full-screen overlay — αντί για inline | MEDIUM |
| No keyboard shortcuts | LOW |

### Τι λείπει εντελώς
- Dashboard overview screen
- Persistent top bar (global search, user menu)
- Side panel για edit/details
- Table view για transactions
- Keyboard navigation
- Visible focus rings
- Proper scrollbars
- Wide-screen statistics layout

---

## 2. Desktop Information Architecture

### Βασική αρχή
Design for 1440px, degrade gracefully to 768px.
Mobile (< 768px) = existing layout, ZERO changes.
Desktop (>= 768px) = ξεχωριστό UX layer, same data/logic.

### Layout Structure

`
+---------------------------------------------------------------------+
|  TOPBAR (64px) [Logo][Search......................][Period][Sync][Me] |
+---------+-----------------------------------------------------------+
|         |                                                            |
| SIDEBAR |              MAIN CONTENT AREA                            |
| (220px) |                                                            |
|         |   +------------------------+   +----------------------+   |
| * Dash  |   |   PRIMARY PANEL        |   |  DETAIL PANEL        |   |
| o Trans |   |   (flexible width)     |   |  (360px contextual)  |   |
| o Stats |   |                        |   |                      |   |
| o Acc   |   |                        |   |  * Trans details     |   |
| o Budget|   |                        |   |  * Edit form         |   |
| ------- |   |                        |   |  * Account activity  |   |
| o Notes |   |                        |   |  * AI context        |   |
| o Recur |   +------------------------+   +----------------------+   |
| ------- |                                                            |
| o Sett  |                                                            |
| ------- |                                                            |
| [AI Bot]|                                                            |
| [Avatar]|                                                            |
+---------+------------------------------------------------------------+
`

### Navigation Model

**Sidebar (220px):**
- Logo + Brand name
- Dashboard (νέα οθόνη)
- Κινήσεις
- Στατιστικά
- Λογαριασμοί
- Προϋπολογισμοί
- ---
- Σημειωματάριο
- Επαναλαμβανόμενες
- ---
- Ρυθμίσεις
- [AI Σύμβουλος button]
- User avatar + sync

**Top Bar (64px):**
- Left: section title
- Center: global search (inline, always visible)
- Right: period nav + sync + user menu

**Αποφάσεις:**
- Bottom nav: κρυφό εντελώς στο desktop
- FAB: αντικαθίσταται από Νέα Κίνηση button στο topbar (shortcut N)
- Sidebar collapses to 60px icons-only στο 768-1024px
- Mobile (< 768px): zero changes — existing bottom nav

---

## 3. Dashboard Screen (Νέα οθόνη — Desktop Only)

Λόγοι για dashboard:
- Desktop users χρειάζονται overview χωρίς να ψάχνουν tabs
- Δεν απαιτεί αλλαγές στο business logic

### Dashboard Cards

| Card | Priority |
|------|----------|
| KPI Row (Income/Expenses/Balance/Health Score) | Always visible |
| Spending Chart (Bar 6 months ή Donut toggle) | Primary |
| Budget Progress Bars | Primary |
| Accounts Overview | Primary |
| AI Insights + Open Chat button | Secondary |
| Recent Transactions (last 5) | Secondary |
| Forecast Card | Tertiary |

`
+------------------------------------------------------------------+
|  DASHBOARD                               [+ Νέα Κίνηση]         |
+------------------------------------------------------------------+
|  +--------+  +--------+  +--------+  +-------+                   |
|  | ΕΣΟΔΑ  |  | ΕΞΟΔΑ  |  | ΥΠΟΛ.  |  | SCORE |                   |
|  | €2.400 |  |-€1.847 |  | +€553  |  |  78   |                   |
|  +--------+  +--------+  +--------+  +-------+                   |
|                                                                   |
|  +---------------------------+  +----------------------------+    |
|  |   BAR CHART (6 months)    |  |  AI INSIGHTS               |   |
|  |   Income vs Expenses      |  |  Φαγητό +34% αυτό τον | |
| +---------------------------+ | μήνα...                  |   |
|  +---------------------------+  |  [Open Chat >]              |   |
|  |  BUDGET PROGRESS BARS     |  +----------------------------+    |
|  |  Φαγητό   ████░░  67%     |  +----------------------------+    |
|  |  Ψυχαγωγία ███░  90% (!)  |  |  RECENT TRANSACTIONS       |   |
|  +---------------------------+  |  Φαγητό        -€12,50     |   |
|  +---------------------------+  |  BP            -€85,00     |   |
|  |   ACCOUNTS OVERVIEW       |  |  Μισθός       +€1.400     |   |
|  |  Τράπεζα   €1.240          |  |  [Όλες >]                  |   |
|  |  Μετρητά   €380            |  +----------------------------+    |
|  +---------------------------+                                    |
+------------------------------------------------------------------+
`

---

## 4. Transactions Desktop

### Layout: Card List + Side Panel

`
+--------------------------------------+----------------------------+
|  TRANSACTIONS                         |   DETAIL PANEL (360px)    |
|  [<- Μάιος 2026 ->] [Search] [+]     |   ----------------------  |
|  [All][Category][Account][Sort]       |   SUPER MARKET            |
|  ──────────────────────────────────  |   -€45,80                 |
|  Wed 28 May              +120  -85   |   ----------------------  |
|  ● Super Market   -€45,80       (x) <--- Wed 28 May 2026         |
|  ● BP Βενζίνη     -€85,00       (x)  |   Visa Card               |
|  ──────────────────────────────────  |   Τρόφιμα → Φαγητό        |
|  Tue 27 May               +0  -42   |   ----------------------  |
|  ● Εστιατόριο     -€42,00       (x)  |   [Edit] [Delete] [Copy]  |
|                                      +----------------------------+
+--------------------------------------+
`

**Features:**
- Inline filter toolbar (search, category, account, type, sort)
- Click → Detail Side Panel
- Double-click / E → Edit form in panel
- Checkbox + Shift+click για multi-select
- Arrow keys για navigation
- Escape για κλείσιμο panel
- Amount input: native keyboard (no calculator keypad)

---

## 5. Statistics Desktop

### Dual Chart Layout

`
+-------------------------------------------------------------------+
|  ΣΤΑΤΙΣΤΙΚΑ    [<- Μάιος 2026 ->]  [Μηνιαία] [Μέλος]            |
+-------------------------------------------------------------------+
|  +---------------------------+  +-------------------------------+ |
|  |  DONUT (current month)    |  |  BAR CHART (6 months trend)   | |
|  |  €1.847 total expenses    |  |  Income vs Expenses bars      | |
|  +---------------------------+  +-------------------------------+ |
|                                                                   |
|  [Έσοδα €2.400]  [Έξοδα €1.847]  Net: +€553                     |
|  ──────────────────────────────────────────────────────────────   |
|  Τρόφιμα    ████████░░  45%  €830   [expand subcategories]       |
|  Μεταφορά   ████░░░░░░  22%  €406                                |
|  Υγεία      ██░░░░░░░░  10%  €185                                |
|                                                                   |
|  [Κατανομή]  [Προϋπολογισμοί]                                    |
+-------------------------------------------------------------------+
`

---

## 6. AI Advisor Desktop

### Dedicated Screen με Split Layout

`
+---------------------+--------------------------------------------+
|  AI ΣΥΜΒΟΥΛΟΣ       |  ΟΙΚΟΝΟΜΙΚΟ ΠΛΑΙΣΙΟ                        |
|  Συνομιλίες:        |  Μάιος 2026                                |
|                     |  Έσοδα: €2.400  Έξοδα: €1.847              |
|  📅 Σήμερα          |  ─────────────────────────────────          |
|  > Πού ξοδεύω...    |  Εστιατόρια: 92% budget (!)                |
|  📅 Χθες            |  +15% vs Απρίλιος                          |
|  > Πρόβλεψη...      |  ─────────────────────────────────          |
|                     |  Top: Τρόφιμα €556 / Μεταφορά €406         |
|  [+ Νέα]            |                                            |
|  ─────────────────  |                                            |
|  🤖 Βλέπω ότι...    |                                            |
|  👤 Πώς να αποτ..   |                                            |
|  ─────────────────  |                                            |
|  [Input........] >  |                                            |
+---------------------+--------------------------------------------+
`

---

## 7. Responsive Strategy

| Breakpoint | Range | Layout |
|------------|-------|--------|
| **Mobile** | < 768px | Existing layout — ZERO CHANGES |
| **Tablet** | 768px-1024px | Sidebar 60px (icons only) + content |
| **Desktop** | 1024px-1440px | Sidebar 220px + content + optional panel |
| **Wide** | > 1440px | Sidebar 260px + wider content + panel |

### CSS Pattern
`css
/* Mobile: untouched */

@media (min-width: 768px) {
  html.web-mode .bottom-nav { display: none !important; }
  html.web-mode .desktop-sidebar { display: flex; width: 60px; }
  html.web-mode .desktop-topbar { display: flex; }
}

@media (min-width: 1024px) {
  html.web-mode .desktop-sidebar { width: 220px; }
  html.web-mode .desktop-detail-panel { display: flex; width: 360px; }
}

@media (min-width: 1440px) {
  html.web-mode .desktop-sidebar { width: 260px; }
  html.web-mode .desktop-detail-panel { width: 400px; }
}
`

---

## 8. Visual Language — Desktop Design System

### Design Tokens

`css
html.web-mode {
  --desktop-sidebar-width: 220px;
  --desktop-topbar-height: 64px;
  --desktop-panel-width: 360px;
  --desktop-content-padding: 32px;
  --desktop-gap: 20px;
  --touch-target: 36px;
  --card-radius: 16px;
  --glass-bg: rgba(34, 39, 49, 0.85);
  --glass-blur: blur(20px);
  --glass-border: 1px solid rgba(255,255,255,0.06);
}
`

### Typography (Desktop)
- H1: Outfit 28px, w800, ls -0.5px
- H2: Outfit 20px, w700
- Body: Inter 15px, w400, lh 1.6
- Label: Inter 12px, w600, uppercase, ls 0.8px
- Amount: Outfit 28-36px, w800, tabular-nums

### Component Changes
| Component | Mobile | Desktop |
|-----------|--------|---------|
| Touch targets | 44px | 36px |
| Cards | 16px radius | 20px radius, hover shadow |
| Scale on :active | 0.94 | disabled |
| Scrollbars | hidden | styled 6px thin |
| Focus rings | none | 2px accent outline |
| Modals | bottom sheets | centered dialogs |
| Toasts | top | bottom-right, 320px |
| Loading | spinner | skeleton shimmer |

---

## 9. Shared vs Desktop-Specific

### 100% Shared
- Supabase sync, authentication, offline
- app.js business logic + calculations
- All render functions (renderTransactions, renderStats, etc.)
- AI/Advisor engine
- CurrencyService
- i18n strings
- Chart.js instances

### Desktop-Only (new files)
- desktop.css — layout + components
- web-ui.js — sidebar, panel, shortcuts, dashboard
- #dashboard-screen HTML section
- .desktop-sidebar HTML element
- .desktop-topbar HTML element
- .desktop-detail-panel HTML element

---

## 10. Technical Implementation

### Architecture: CSS Layer Extension (safest)

`html
<!-- index.html: add one line -->
<link rel=stylesheet href=desktop.css id=desktop-stylesheet>
<script src=web-ui.js defer></script>
`

All rules scoped to html.web-mode → inert on Android.

### New HTML Structure

`html
<div class=app-container>
  <nav class=desktop-sidebar>   <!-- NEW -->
  <div class=desktop-topbar>    <!-- NEW -->
  <header class=app-header>     <!-- existing, hidden on desktop -->
  <nav class=bottom-nav>        <!-- existing, hidden on desktop -->
  <main class=app-content>
    <!-- existing screens unchanged -->
    <section id=dashboard-screen class=tab-screen> <!-- NEW -->
  </main>
  <div class=desktop-detail-panel>  <!-- NEW -->
</div>
`

### New JS Functions (web-ui.js, ~400 lines)

`js
function initDesktopUI()          // main entry point
function initDesktopSidebar()     // navigation + active states
function renderDashboard()        // dashboard aggregation
function openDetailPanel(id)      // slide-in panel
function closeDetailPanel()       // close panel
function initKeyboardShortcuts()  // N, Escape, /, arrows
function initDesktopSearch()      // inline search
`

### Single hook in app.js (1 line)

`js
// At end of initApp():
if (document.documentElement.classList.contains('web-mode')) {
  if (typeof initDesktopUI === 'function') initDesktopUI();
}
`

### Files Created vs Modified

| File | Action | Risk |
|------|--------|------|
| desktop.css | CREATE | Zero — no mobile impact |
| web-ui.js | CREATE | Zero — no mobile impact |
| index.html | MODIFY (add elements) | Low |
| style.css | MODIFY (move web-mode block to desktop.css) | Medium |
| pp.js | MODIFY (add 1 hook line) | Very Low |

---

## 11. Rollback Strategy

Επειδή όλα τα desktop changes είναι scoped σε html.web-mode:

1. **Immediate rollback:** Remove desktop.css + web-ui.js links → Android/mobile untouched
2. **Partial rollback:** Remove specific rules from desktop.css
3. **Feature flags:** localStorage flag per feature

**Android isolation guarantee:**
- Capacitor → JS never adds html.web-mode
- CSS loads αλλά κανένας κανόνας δεν εφαρμόζεται χωρίς html.web-mode

---

## 12. Phased Implementation Plan

### Phase 2A — Foundation & Navigation
- Create desktop.css + web-ui.js
- Sidebar HTML + CSS (icons, labels, active, hover)
- Topbar HTML + CSS (search, period nav, user menu)
- Hide bottom nav + mobile header on desktop
- Fix P0 issues: overflow, user-select, touch-action, scrollbars
- Keyboard shortcuts: N, Escape, /, arrows
- FAB → topbar button

**Exit criteria:** Professional sidebar nav in desktop browser

### Phase 2B — Dashboard Screen
- Add #dashboard-screen to HTML
- renderDashboard() in web-ui.js
- KPI cards, 6-month bar chart, budget bars, accounts, AI card, recent

**Exit criteria:** Complete financial overview on one screen

### Phase 2C — Transactions Desktop
- .desktop-detail-panel HTML + CSS
- Click transaction → panel (not modal)
- Edit in panel, not full-screen form
- Inline filter toolbar
- Keyboard navigation
- Native amount input (no calculator)

**Exit criteria:** Browse + edit transactions without modals

### Phase 2D — Statistics Enhancement
- Dual chart (donut + bar trend side by side)
- Wider breakdown list
- Period comparison toggle

**Exit criteria:** Full horizontal space utilization

### Phase 2E — Accounts + AI Advisor
- Accounts detail panel
- AI Advisor: dedicated screen, split layout

**Exit criteria:** Both screens feel native to desktop

### Phase 2F — Polish
- Settings: tabs layout
- Empty/loading states, skeleton screens
- Toast notifications
- Budgets + Notes + Recurring desktop layouts
- Keyboard accessibility audit
- Cross-browser testing

---

## 13. P0 Issues to Fix in Phase 2A

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | overflow: hidden on body | overflow: auto in web-mode |
| P0 | user-select: none globally | Override in web-mode |
| P0 | 	ouch-action: manipulation | Override in web-mode |
| P0 | Scrollbars hidden | Restore styled 6px in web-mode |
| P1 | scale(0.94) on :active | Disable in web-mode |
| P1 | Calculator keypad on desktop | Skip via web-mode class detect |
| P2 | No focus rings | Add 2px outline in web-mode |
| P2 | Bottom sheets → centered modals | Refine existing rules |

---

*Βασίζεται σε πλήρη ανάλυση: index.html (5.032 γρ.) / app.js (29.621 γρ.) / style.css (8.759 γρ.)*
