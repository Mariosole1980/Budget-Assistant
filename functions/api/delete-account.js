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
  const { request, env } = context;

  // Shared security: CORS origin check, rate limiting, body size guard.
  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  // JWT Token Verification Check
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token. Please log in.' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const token = authHeader.substring(7);
  const supabase = getSupabasePublicConfig(env);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabase || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not configured.' }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const { supabaseUrl, supabaseKey } = supabase;

  try {
    // 1. Authenticate access token with Supabase Auth API
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid session token. Details: ${errText}` }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID not found in session.' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // 2. Family-safety guard (prevents data loss for other family members).
    // When a user belongs to a family group, their family-shared rows (transactions,
    // accounts, categories, notes) carry BOTH user_id (this user) AND family_id.
    // Deleting the auth user cascades on user_id and would destroy those shared rows
    // for every other member. It could also orphan a family group if this user is its
    // last admin. To keep account deletion family-safe, refuse deletion while the user
    // is still a member of a family group and instruct them to leave it first.
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=family_id,role&id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (profileRes.ok) {
      const profileData = await profileRes.json();
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profile && profile.family_id) {
        return new Response(JSON.stringify({
          error: 'Cannot delete account while you are a member of a family group. Please leave the family group first (or transfer admin to another member if you are the only admin), then try again.',
          code: 'FAMILY_MEMBERSHIP_REQUIRED'
        }), {
          status: 409,
          headers: corsHeaders
        });
      }
    }
    // If the profile lookup fails (e.g. transient error), we do NOT block deletion —
    // the lookup is a best-effort safety check and must not lock users out of deleting
    // their own account.

    // 3. Cascade delete database tables for this user via SQL or simple delete API calls if there's no foreign key constraints blocking it.
    // GoTrue admin delete user endpoint:
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!deleteRes.ok) {
      const deleteErrText = await deleteRes.text();
      return new Response(JSON.stringify({ error: `Failed to delete user account: ${deleteErrText}` }), {
        status: deleteRes.status,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Account permanently deleted.' }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error during deletion: ${err.message}` }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
