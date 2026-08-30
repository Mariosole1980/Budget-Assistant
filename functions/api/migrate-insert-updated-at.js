// One-shot admin migration endpoint for the INSERT updated_at trigger fix.
//
// PURPOSE: Apply the additive, idempotent schema migration (BEFORE INSERT
// triggers + DEFAULT now() on updated_at) to the live Supabase database using
// the server-side service-role key. This closes the "clock skew" gap where a
// device clock ahead of the server could store a FUTURE updated_at on INSERT,
// causing the partner's incremental sync cursor to skip the new row.
//
// WHY THIS EXISTS: The client only holds the publishable anon key, which cannot
// run DDL. The service-role key lives only as a Cloudflare secret
// (env.SUPABASE_SERVICE_ROLE_KEY), so the migration must run server-side.
//
// SECURITY MODEL:
//   * It does NOT accept arbitrary SQL from the caller. The SQL is HARDCODED in
//     this file (the exact contents of insert-updated-at-trigger-migration.sql),
//     so an attacker cannot use this endpoint to run destructive queries.
//   * It is guarded by a secret admin token (env.MIGRATION_ADMIN_TOKEN) passed
//     in the `x-admin-token` header. Without the correct token it returns 403.
//   * The migration is IDEMPOTENT and ADDITIVE: re-running it is a no-op, so
//     even a repeated call is harmless.
//
// PREREQUISITE: incremental-sync-migration.sql must already be applied (i.e.
// the set_updated_at() function and the updated_at columns must exist), because
// this migration reuses set_updated_at() and alters the updated_at columns.
//
// USAGE (after setting env.MIGRATION_ADMIN_TOKEN in Cloudflare):
//   curl -X POST https://budget-assistant-pwa.pages.dev/api/migrate-insert-updated-at \
//        -H "x-admin-token: <TOKEN>"

// The exact, idempotent migration SQL (mirrors insert-updated-at-trigger-migration.sql).
const MIGRATION_SQL = `
-- 1. COLUMN DEFAULTS (idempotent safety net)
ALTER TABLE public.transactions
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.accounts
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.categories
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.recurring_templates
    ALTER COLUMN updated_at SET DEFAULT now();

-- 2. BEFORE INSERT TRIGGERS (authoritative server time)
DROP TRIGGER IF EXISTS trg_transactions_updated_at_insert ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at_insert
    BEFORE INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at_insert ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at_insert
    BEFORE INSERT ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at_insert ON public.categories;
CREATE TRIGGER trg_categories_updated_at_insert
    BEFORE INSERT ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_templates_updated_at_insert ON public.recurring_templates;
CREATE TRIGGER trg_recurring_templates_updated_at_insert
    BEFORE INSERT ON public.recurring_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
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
