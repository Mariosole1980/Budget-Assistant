import { validateRequest, corsHeadersFor } from './_security.js';
import { BankService } from './_bank_service.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const corsHeaders = corsHeadersFor(request, {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
  if (!corsHeaders) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  try {
    const url = new URL(request.url);
    const requested = (url.searchParams.get('country') || 'GR').trim().toUpperCase();
    const country = /^[A-Z]{2}$/.test(requested) ? requested : 'GR';

    const bankService = new BankService(env);
    const { institutions, source, configured } = await bankService.getInstitutionsDetailed(country);

    // `source`/`configured` let the app warn when it is showing the built-in
    // list instead of the provider's live catalogue (a bank picked from a stale
    // list is exactly what makes /auth fail with "ASPSP not found").
    return new Response(JSON.stringify({ institutions, source, configured }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (err) {
    console.error('[bank-institutions] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to list banks' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
