# Canonical SQL Migration Order — Budget Assistant

> **Purpose:** Document the **canonical, dependency-safe order** in which the SQL
> migration files in this repository must be applied to a fresh Supabase project
> (or a disaster-recovery rebuild).
>
> **Why this file exists (finding DB2):** Every migration is individually
> **idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
> `CREATE OR REPLACE`, `DROP ... IF EXISTS`), so re-running any single file is a
> no-op. **However, the files are collectively ORDER-SENSITIVE** because several
> of them add foreign-key columns that reference tables created by *other* files.
> If applied in the wrong order, the FK `REFERENCES` clauses fail and the
> migration aborts mid-way.
>
> **Rule of thumb:** *Create the referenced table before any file that adds a
> foreign key pointing at it.* The two foundational tables are
> `public.family_groups` and `public.currencies`.

---

## 1. Dependency Map (who references whom)

| Referenced table | Created by | Referenced (FK) by |
|---|---|---|
| `auth.users` | Supabase (built-in) | every `user_id` column |
| `public.family_groups` | `family-budget-migration.sql` | `profiles.family_id`, `transactions.family_id`, `accounts.family_id`, `categories.family_id`, `notes.family_id`, `pending_invitations.family_id` |
| `public.currencies` | `multi-currency-migration.sql` | `profiles.base_currency`, `profiles.display_currency`, `accounts.currency` |
| `public.profiles` | `profiles-canonical-schema.sql` | `profiles.partner_id` (self-FK), tenant-isolation RLS policies |
| `public.transactions` | `supabase-schema.sql` | `trash-status-migration.sql`, `multi-currency-migration.sql`, `supabase-recurring-migration.sql` |

**Critical ordering constraints:**
1. `family-budget-migration.sql` **must run before** any file that adds a
   `family_id` FK column (because it creates `family_groups`).
2. `multi-currency-migration.sql` **must run before** any file that adds a
   `base_currency` / `display_currency` / `accounts.currency` FK column
   (because it creates `currencies`).
3. `profiles-canonical-schema.sql` should run before `tenant-isolation-migration.sql`
   (the RLS policies reference `public.profiles`).

---

## 2. Canonical Application Order

Apply the files **in this exact order** on a fresh database:

| Step | File | Creates / modifies | Dependency satisfied |
|---|---|---|---|
| 1 | `supabase-schema.sql` | Base tables: `accounts`, `categories`, `transactions`, `currencies` FK, `family_id` FKs, RLS | Requires `family_groups` + `currencies` (see note below) |
| 2 | `family-budget-migration.sql` | `family_groups`, `pending_invitations`, `profiles.family_id`/`role`, `transactions/accounts/categories.family_id` | **Creates** `family_groups` |
| 3 | `multi-currency-migration.sql` | `currencies`, `exchange_rates`, `budgets`, `amount_base`, `base_currency`/`display_currency` | **Creates** `currencies` |
| 4 | `profiles-canonical-schema.sql` | Canonical `profiles` definition + backfill | Requires `family_groups` + `currencies` |
| 5 | `tenant-isolation-migration.sql` | `user_id` columns, RLS policies on `transactions/accounts/categories/profiles` | Requires `profiles` |
| 6 | `notes-migration.sql` | `notes` table + `family_id` FK | Requires `family_groups` |
| 7 | `trash-status-migration.sql` | `transactions.status/deleted_at/deleted_by` + indexes | Requires `transactions` |
| 8 | `supabase-recurring-migration.sql` | Recurring templates/installments | Requires `transactions` |
| 9 | `category-budgets-migration.sql` | Category budgets | Requires `categories` |
| 10 | `ai-conversations-migration.sql` | AI advisor conversations | — |
| 11 | `feedback-schema-migration.sql` | User feedback table | — |
| 12 | `premium-subscription-migration.sql` | `profiles.premium_active`/`premium_purchased_at` | Requires `profiles` |
| 13 | `premium-security-fix-migration.sql` | Premium enforcement triggers | Requires `profiles` |
| 14 | `exchange-rates-security-fix.sql` | Exchange-rate security hardening | Requires `exchange_rates` |
| 15 | `family-security-fixes-migration.sql` | Family RLS recursion fixes | Requires `family_groups` + `profiles` |
| 16 | `family-security-fix2-recursion.sql` | Family RLS recursion fix (v2) | Requires `family_groups` + `profiles` |

> **Note on Step 1 (`supabase-schema.sql`):** This canonical file already contains
> `family_id` and `currency` FK columns in its `CREATE TABLE` statements. On a
> **fresh** database it therefore expects `family_groups` and `currencies` to
> already exist. Two safe strategies:
>
> - **Strategy A (recommended for fresh builds):** Run `family-budget-migration.sql`
>   and `multi-currency-migration.sql` **first** (steps 2 & 3 above), then
>   `supabase-schema.sql`. The `CREATE TABLE IF NOT EXISTS` in
>   `supabase-schema.sql` becomes a no-op for already-created tables.
> - **Strategy B (existing DB):** On an already-migrated database, run
>   `supabase-schema.sql` first — it is a no-op because the tables already exist,
>   and the FK columns already exist from the earlier feature migrations.

---

## 3. Idempotency & Safety Properties

- ✅ Every file uses `IF NOT EXISTS` / `IF EXISTS` / `CREATE OR REPLACE`.
- ✅ No file issues `DROP TABLE` on core tenant tables.
- ✅ No file disables Row Level Security.
- ✅ No file creates `USING(true)` / `WITH CHECK(true)` "allow public" policies
  on tenant data.
- ⚠️ **Order matters** only because of FK `REFERENCES` clauses — a wrong order
  aborts the file, it does **not** corrupt data.

---

## 4. Regression Safety Rule for Future Migrations

1. **Never** add a FK column referencing a table that is not guaranteed to exist
   at that point in the canonical order.
2. If a new migration introduces a new foundational table (like `family_groups`
   or `currencies`), place it **before** any file that references it, and update
   this document.
3. Prefer `ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS` for all new
   schema changes so re-runs are safe.
4. After any schema change, re-run `scripts/verify-health.js` and the relevant
   RLS policy inventory (`plans/rls-policy-inventory.md`).
