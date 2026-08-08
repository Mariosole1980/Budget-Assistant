# Family Management v2 — Detailed Implementation Plan

## Goal
Improve the Family Management (Διαχείριση Οικογένειας) connected-family view by:
1. **Refactoring** the monolithic `renderPartnerSection()` into smaller, maintainable helper functions.
2. Making the **invite code visible/copyable for all members** (read-only), not just admin.
3. **Integrating the "Add Member" invite into a modal** (Option B) instead of a separate card below.

> **Removed per user request:** summary strip (overview stats) and per-member visibility control (deferred to a later iteration).

---

## Current State (baseline)

- [`renderPartnerSection()`](app.js:19683) renders 3 states: no-login → no-group (setup) → connected (`if (familyId)`).
- The connected branch (lines ~19715–19967) is a single large function with inline HTML for:
  - Hero banner card
  - Members list (`membersHtml`, lines 19728–19797)
  - Admin invite block (`inviteBlockHtml`, lines 19799–19893)
  - Feature highlights card
- Invite-related functions already exist and are bound to `window`:
  - `inviteMemberByEmail()` (line 20227)
  - `selectInviteRole(role)` (line 20347)
  - `sendFamilyInviteVia(channel, code)` (line 19626)
  - `copyDirectInviteLink(code)` (line 19670)
  - `toggleMemberMenu(event, id)` (line 20317)

---

## Change 1 — Refactor into helper functions

**File:** `app.js`

Extract the connected-branch HTML generation into small pure functions that return HTML strings. Keep `renderPartnerSection()` as the orchestrator.

New helper functions (place near `renderPartnerSection`):

```
function renderFamilyHero(familyName, memberCount, isAdmin) -> string
function renderFamilyMembersList(members, myRole) -> string
function renderFamilyFeatures() -> string
```

- Each function uses `state.lang` for i18n and existing CSS variables.
- `renderPartnerSection()` calls them in order and concatenates into `container.innerHTML`.
- No behavior change — pure HTML extraction. This makes the code maintainable and testable.

---

## Change 2 — Invite code visible for all members (read-only)

**File:** `app.js`

Currently the invite code block is only rendered when `myRole === 'admin'` (line 19801).

**New behavior:**
- **Admin:** full invite flow via modal (see Change 3).
- **Member (non-admin):** show a compact read-only "Invite Code" row with a **copy** button (📋) and **share** button (🔗), so members can also invite others. No role selection, no email invite.

Implementation:
- Add a small `renderMemberInviteCode(inviteCode)` helper used for non-admins.
- Reuse `copyDirectInviteLink(code)` and a copy-to-clipboard handler (same pattern as line 19842).
- Place it at the bottom of the Members card.

---

## Change 3 — "Add Member" invite in a modal (Option B)

**File:** `app.js`

**Problem:** The invite panel is currently a separate card below the members list, which feels disconnected.

**New design (modal):**
- In the Members card header, add a **"+ Πρόσθεση Μέλους" button** (admin only) next to the member count badge.
- Clicking it opens a **modal** (overlay dialog) containing all invite options together: invite code + copy/share, role selection, WhatsApp/Viber/SMS buttons, and email invite.
- The modal keeps the Members card clean and uncluttered — nothing is always-visible inline.

Implementation:
- Add an `openInviteModal()` function that shows the invite modal overlay (reuse existing modal patterns in the app, e.g. `showAuthOverlay`/`openEditTransactionModal` styling).
- Add a `closeInviteModal()` function and a backdrop-click / ✕ close handler.
- Move the existing `inviteBlockHtml` content (role selection, code, messaging buttons, email) into the modal body.
- Remove the separate invite card from the main layout.
- For non-admins, render a compact read-only "Invite Code" row (Change 2) — no modal needed.

Resulting connected-view layout:
```
[ Hero banner ]
[ Members card: header(+count, +btn) | member list | member invite-code row (non-admin) ]
[ Feature highlights card ]
[ Invite modal (opens on "+" click, admin only) ]
```

---

## Files to modify
- `app.js` (source of truth; copied to `www/app.js` by build script)

## Validation
- `node -c app.js` — syntax check
- Manual review of rendered HTML for both admin and member roles

## Build & Deploy
- Run `powershell -ExecutionPolicy Bypass -File .\build_and_deploy.ps1`
- This bumps version to 1163, rebuilds APK, and deploys to Cloudflare Pages.
- Verify live `version.json` and `app.js` contain the new code.
