import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

export async function onRequestOptions(context) {
    const { request } = context;
    const corsHeaders = corsHeadersFor(request, {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    });
    if (!corsHeaders) {
        return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { request } = context;

    // ⚠️ NEUTRALIZED (forensic data-integrity fix).
    //
    // This endpoint was a resurrection vector: it used the service-role key to
    // re-activate ALL soft-deleted transactions for a user/partner/family, which is
    // exactly how permanently-deleted transactions were coming back. It is now
    // permanently disabled and returns 410 Gone. No transaction is ever restored by
    // this endpoint. Legitimate restore-from-trash is handled client-side by
    // restoreTrashGroup() / restoreTransaction() on explicit user intent.
    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

    return new Response(JSON.stringify({
        error: 'Gone: The restore-transactions endpoint has been permanently disabled to prevent resurrection of deleted transactions.',
        disabled: true
    }), {
        status: 410,
        headers: corsHeaders
    });
}
