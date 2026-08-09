# RLS Policy Inventory & Expected Access Rules

**Baseline:** v1181 (current production baseline)
**Purpose:** Single source of truth for every Row Level Security (RLS) policy in the Budget Assistant Supabase schema, and the expected access rules each policy enforces. This document is the reference for the canonical schema ([`supabase-schema.sql`](../supabase-schema.sql)) and all feature migrations.

---

## 1. Summary of RLS state

- **Production RLS is ENABLED** on all tenant tables. This is enforced by the migrations, not by the legacy `supabase-schema.sql` (which was an early bootstrap file that disabled RLS — now rewritten to be RLS-enabled and idempotent).
- **Tenant isolation model:** a row is accessible if it belongs to the current user (`user_id = auth.uid()`) OR to the user's family (`family_id = <user's family_id>`).
- **Family role model:** `profiles.role` is `'admin'` or `'member'`. Admins can update/delete shared family accounts & categories; members can only read them.
- **Read-only catalogs:** `currencies`, `exchange_rates` (select), and `profiles` (select) are intentionally readable by all authenticated users.

---

## 2. Tables and their RLS status

| Table | RLS enabled | Defined in | Tenant-isolated? |
|---|---|---|---|
| `accounts` | ✅ | `supabase-schema.sql` | Yes (user or family) |
| `categories` | ✅ | `supabase-schema.sql` | Yes (user or family) |
| `transactions` | ✅ | `supabase-schema.sql` | Yes (user or family) |
| `profiles` | ✅ | `family-budget-migration.sql` | Partial (select = all auth; update = self/admin) |
| `family_groups` | ✅ | `family-budget-migration.sql` | Members + invite-code lookup |
| `pending_invitations` | ✅ | `family-budget-migration.sql` | Invitee / inviter / family admin |
| `recurring_templates` | ✅ | `supabase-recurring-migration.sql` | Yes (user or partner) |
| `notes` | ✅ | `notes-migration.sql` | Yes (user or family) |
| `currencies` | ✅ | `multi-currency-migration.sql` | Read-only catalog |
| `exchange_rates` | ✅ | `multi-currency-migration.sql` | Read-only catalog (insert = any auth) |
| `budgets` | ✅ | `multi-currency-migration.sql` | Yes (user or family) |
| `category_budgets` | ✅ | (see category-budgets plan) | Yes (user or family) |
| `feedback` | ✅ | (dashboard-created) | Insert-only |
| `deleted_transactions` | ✅ | (legacy trash table) | Yes (user or family) |

> **Note:** `profiles`, `feedback`, `deleted_transactions`, and `category_budgets` are **not** created by any repo SQL file — they are created manually in the Supabase dashboard. This is a known gap (see §6).

---

## 3. Policy inventory (by table)

### 3.1 `accounts`

| Policy | Command | Role | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| Allow select accounts | SELECT | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |
| Allow insert accounts | INSERT | authenticated | — | `(family_id = user's family AND user_id = auth.uid()) OR (family_id IS NULL AND user_id = auth.uid())` | `supabase-schema.sql` |
| Allow update accounts | UPDATE | authenticated | `(family_id = user's family AND role = 'admin') OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |
| Allow delete accounts | DELETE | authenticated | `(family_id = user's family AND role = 'admin') OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |

**Expected access:** A user can read their own accounts and their family's accounts. They can create their own accounts. Only the owner (personal) or a family admin (family) can update/delete.

### 3.2 `categories`

Identical structure to `accounts` (select/insert/update/delete), with the same tenant-isolation + admin rules. Source: `supabase-schema.sql`.

### 3.3 `transactions`

| Policy | Command | Role | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| Allow select transactions | SELECT | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |
| Allow insert transactions | INSERT | authenticated | — | `(family_id = user's family AND user_id = auth.uid()) OR (family_id IS NULL AND user_id = auth.uid())` | `supabase-schema.sql` |
| Allow update transactions | UPDATE | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |
| Allow delete transactions | DELETE | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | — | `supabase-schema.sql` |

**Expected access:** Any family member can read/update/delete family transactions (unlike accounts/categories, transactions do NOT require admin role). Personal transactions are owner-only.

### 3.4 `profiles`

| Policy | Command | Role | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| Allow read-only profile access by email or id | SELECT | authenticated | `true` | — | `family-budget-migration.sql` |
| Allow user or family admin update | UPDATE | authenticated | `(id = auth.uid()) OR (same family AND role = 'admin')` | same | `family-budget-migration.sql` |

**Expected access:** Any authenticated user can read any profile (needed for partner/family member lookup by email/id). A user can update their own profile; a family admin can update family members' profiles.

### 3.5 `family_groups`

| Policy | Command | Role | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| Allow members to read family group | SELECT | authenticated | `(member of family) OR (invite_code IS NOT NULL)` | — | `family-budget-migration.sql` |

**Expected access:** Family members can read their group; anyone can look up a group by invite code before joining.

### 3.6 `pending_invitations`

| Policy | Command | Role | USING / WITH CHECK | Source |
|---|---|---|---|---|
| Allow select pending invitations | SELECT | authenticated | `(invited_email = my email) OR (invited_by = auth.uid()) OR (family admin)` | `family-budget-migration.sql` |
| Allow insert pending invitations | INSERT | authenticated | WITH CHECK: `(invited_by = auth.uid() AND family admin)` | `family-budget-migration.sql` |
| Allow delete pending invitations | DELETE | authenticated | `(invited_email = my email) OR (invited_by = auth.uid()) OR (family admin)` | `family-budget-migration.sql` |

### 3.7 `recurring_templates`

| Policy | Command | Role | USING / WITH CHECK | Source |
|---|---|---|---|---|
| Allow user and partner access to recurring templates | ALL | authenticated | `(user_id = auth.uid()) OR (user_id IN (partner_id of my profile))` | `supabase-recurring-migration.sql` |

> **Note:** This policy uses the **partner** model (`profiles.partner_id`), not the family model. It predates the family migration and may be inconsistent with the family-based policies on other tables. Flagged in §6.

### 3.8 `notes`

| Policy | Command | Role | USING / WITH CHECK | Source |
|---|---|---|---|---|
| Allow user or family select | SELECT | authenticated | `(user_id = auth.uid()) OR (family_id = user's family)` | `notes-migration.sql` |
| Allow user or family insert | INSERT | authenticated | WITH CHECK: `(user_id = auth.uid()) OR (family_id = user's family)` | `notes-migration.sql` |
| Allow user or family update | UPDATE | authenticated | `(user_id = auth.uid()) OR (family_id = user's family)` | `notes-migration.sql` |
| Allow user or family delete | DELETE | authenticated | `(user_id = auth.uid()) OR (family_id = user's family)` | `notes-migration.sql` |

### 3.9 `currencies` (read-only catalog)

| Policy | Command | Role | USING | Source |
|---|---|---|---|---|
| Allow select currencies | SELECT | authenticated | `true` | `multi-currency-migration.sql` |

### 3.10 `exchange_rates`

| Policy | Command | Role | USING / WITH CHECK | Source |
|---|---|---|---|---|
| Allow select exchange rates | SELECT | authenticated | `true` | `multi-currency-migration.sql` |
| Allow insert exchange rates | INSERT | authenticated | WITH CHECK: `true` | `multi-currency-migration.sql` |

> **⚠️ Medium risk:** `exchange_rates` allows **any authenticated user** to insert rows (`WITH CHECK (true)`). This is intended for the service role but is currently open to all authenticated users. See §6.

### 3.11 `budgets`

| Policy | Command | Role | USING / WITH CHECK | Source |
|---|---|---|---|---|
| Allow select budgets | SELECT | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | `multi-currency-migration.sql` |
| Allow insert budgets | INSERT | authenticated | WITH CHECK: `(family_id = user's family AND user_id = auth.uid()) OR (family_id IS NULL AND user_id = auth.uid())` | `multi-currency-migration.sql` |
| Allow update budgets | UPDATE | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | `multi-currency-migration.sql` |
| Allow delete budgets | DELETE | authenticated | `(family_id = user's family) OR (family_id IS NULL AND user_id = auth.uid())` | `multi-currency-migration.sql` |

### 3.12 `category_budgets`

Defined in the category-budgets plan (not a repo SQL file). Policies: select/update/delete allow `(user_id = auth.uid()) OR (family_id = user's family)`; insert requires `user_id = auth.uid()`.

---

## 4. `USING (true)` / `WITH CHECK (true)` policies — risk assessment

| Table | Policy | Type | Risk | Justification |
|---|---|---|---|---|
| `profiles` | read-only select | `USING(true)` | **Low** | Needed for partner/family lookup by email/id; SELECT only, no sensitive financial data |
| `currencies` | select | `USING(true)` | **Low** | Read-only ISO catalog |
| `exchange_rates` | select | `USING(true)` | **Low** | Read-only rate history |
| `exchange_rates` | insert | `WITH CHECK(true)` | **Medium** | Any authenticated user can insert rates; should be service-role only |
| ~~transactions/accounts/categories~~ | ~~"Allow public"~~ | ~~`USING(true)`/`WITH CHECK(true)`~~ | **Removed** | These existed only in the legacy `supabase-schema.sql`, which has been rewritten to remove them and enable RLS |

---

## 5. Expected access rules (behavioral contract)

1. **Personal mode (no family):** a user sees/edits only rows where `user_id = auth.uid()`.
2. **Family mode:** a user sees all rows where `family_id = their family_id`, plus their own personal rows.
3. **Family admin** can update/delete shared `accounts` and `categories`; **members** can only read them.
4. **Transactions** are editable by all family members (no admin requirement).
5. **Profiles** are readable by all authenticated users; only self or family admin can update.
6. **Catalogs** (`currencies`, `exchange_rates`) are readable by all authenticated users.

---

## 6. Known gaps & recommendations (documented, NOT yet changed)

1. **`recurring_templates` uses the legacy partner model** (`partner_id`) while all other tables use the family model. This is an inconsistency that should be reconciled in a future migration (out of scope for this remediation).
2. **`exchange_rates` insert is open to all authenticated users** (`WITH CHECK(true)`). Recommend restricting to service role only. **Not changed** in this remediation to avoid altering production behavior without explicit approval.
3. **`profiles`, `feedback`, `deleted_transactions`, `category_budgets` are not in any repo SQL file** — they are dashboard-created. The repo has no complete canonical schema for these. Consider adding them to the canonical schema in a future phase.
4. **No migration tooling / ordering** — the 8 SQL files have no enforced order or idempotency guarantee. This remediation makes `supabase-schema.sql` idempotent and RLS-safe, but a proper migration tool is a future recommendation.

---

## 7. Verification checklist

- [ ] `supabase-schema.sql` contains **no** `DROP TABLE`, **no** `DISABLE ROW LEVEL SECURITY`, **no** "Allow public" policies.
- [ ] All tenant tables in `supabase-schema.sql` have `ENABLE ROW LEVEL SECURITY`.
- [ ] The README no longer instructs users to run a destructive schema file.
- [ ] Production database is **untouched** by this remediation (repo-level consistency fix only).
