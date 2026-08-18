// One-shot admin migration endpoint for the Incremental Sync feature.
//
// PURPOSE: Apply the additive, idempotent schema migration (updated_at columns,
// triggers, composite indexes, sync_tombstones table) to the live Supabase
// database using the server-side service-role key.
//
// WHY THIS EXISTS: The client only holds the publishable anon key, which cannot
// run DDL. The service-role key lives only as a Cloudflare secret
// (env.SUPABASE_SERVICE_ROLE_KEY), so the migration must run server-side.
//
// SECURITY MODEL:
//   * It does NOT accept arbitrary SQL from the caller. The SQL is HARDCODED in
//     this file (the exact contents of incremental-sync-migration.sql), so an
//     attacker cannot use this endpoint to run destructive queries.
//   * It is guarded by a secret admin token (env.MIGRATION_ADMIN_TOKEN) passed
//     in the `x-admin-token` header. Without the correct token it returns 403.
//   * The migration is IDEMPOTENT and ADDITIVE: re-running it is a no-op, so
//     even a repeated call is harmless.
//   * It is intended to be triggered ONCE, then this file can be removed from
//     the codebase in a follow-up commit.
//
// USAGE (after setting env.MIGRATION_ADMIN_TOKEN in Cloudflare):
//   curl -X POST https://budget-assistant-pwa.pages.dev/api/migrate-incremental-sync \
//        -H "x-admin-token: <TOKEN>"

// The exact, idempotent migration SQL (mirrors incremental-sync-migration.sql).
const MIGRATION_SQL = `
-- 1. ADD updated_at COLUMNS (idempotent)
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. BACKFILL existing rows so old data has a valid cursor baseline.
UPDATE public.transactions
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.accounts
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.categories
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.recurring_templates
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;

-- 3. NOT NULL after backfill (idempotent)
ALTER TABLE public.transactions
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.accounts
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.categories
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.recurring_templates
    ALTER COLUMN updated_at SET NOT NULL;

-- 4. AUTO-UPDATE TRIGGER (shared function + per-table triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_templates_updated_at ON public.recurring_templates;
CREATE TRIGGER trg_recurring_templates_updated_at
    BEFORE UPDATE ON public.recurring_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. COMPOSITE INDEXES for keyset pagination (updated_at, id)
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at_id
    ON public.transactions (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at_id
    ON public.accounts (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_categories_updated_at_id
    ON public.categories (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_updated_at_id
    ON public.recurring_templates (updated_at, id);

-- 6. SYNC TOMBSTONES TABLE (durable deletion sync)
CREATE TABLE IF NOT EXISTS public.sync_tombstones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  TEXT NOT NULL,
    row_id      UUID NOT NULL,
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id     UUID,
    family_id   UUID,
    UNIQUE (table_name, row_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_tombstones_scope
    ON public.sync_tombstones (deleted_at, id, user_id, family_id);

-- 7. RLS for sync_tombstones (tenant isolation)
ALTER TABLE public.sync_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow select own tombstones" ON public.sync_tombstones
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow insert own tombstones" ON public.sync_tombstones
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow delete own tombstones" ON public.sync_tombstones
    FOR DELETE TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );
`;

export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. Guard: require the admin token.
    const adminToken = env.MIGRATION_ADMIN_TOKEN;
    if (!adminToken) {
        return new Response(JSON.stringify({
            ok: false,
            error: 'Server configuration error: MIGRATION_ADMIN_TOKEN not configured.'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const providedToken = request.headers.get('x-admin-token') || '';
    if (providedToken !== adminToken) {
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden: invalid admin token.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 2. Resolve Supabase config.
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const managementToken = env.SUPABASE_MANAGEMENT_TOKEN;
    if (!supabaseUrl) {
        return new Response(JSON.stringify({
            ok: false,
            error: 'Server configuration error: SUPABASE_URL not configured.'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Run the migration. Two supported mechanisms:
    //    A) Supabase Management API (official, works on ALL projects):
    //       POST https://api.supabase.com/v1/projects/{ref}/database/query
    //       Requires a Management API access token (env.SUPABASE_MANAGEMENT_TOKEN).
    //    B) Legacy SQL-over-HTTP (pg/query) using the service-role key.
    //       Only available on OLDER Supabase projects; returns 404 on newer ones.
    try {
        let res;
        let text;

        if (managementToken) {
            // Extract the project ref from the Supabase URL, e.g.
            // https://<ref>.supabase.co -> <ref>
            const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
            const projectRef = refMatch ? refMatch[1] : null;
            if (!projectRef) {
                return new Response(JSON.stringify({
                    ok: false,
                    error: 'Could not determine Supabase project ref from SUPABASE_URL.'
                }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${managementToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: MIGRATION_SQL })
            });
            text = await res.text();
        } else if (serviceRoleKey) {
            res = await fetch(`${supabaseUrl}/pg/query`, {
                method: 'POST',
                headers: {
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: MIGRATION_SQL })
            });
            text = await res.text();
        } else {
            return new Response(JSON.stringify({
                ok: false,
                error: 'Server configuration error: neither SUPABASE_MANAGEMENT_TOKEN nor SUPABASE_SERVICE_ROLE_KEY configured.'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        let data = null;
        try { data = JSON.parse(text); } catch (e) { /* keep raw text */ }

        if (!res.ok) {
            return new Response(JSON.stringify({
                ok: false,
                status: res.status,
                error: data && data.message ? data.message : text
            }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ ok: true, result: data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err && err.message || err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
