export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // JWT Token Verification Check
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token. Please log in.' }), {
      status: 401,
      headers: corsHeaders
    });
  }
  
  const token = authHeader.substring(7);
  const supabaseUrl = env.SUPABASE_URL || 'https://nnatvvahoeiemkfmzpwp.supabase.co';
  const supabaseKey = env.SUPABASE_ANON_KEY || 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured.' }), {
      status: 500,
      headers: corsHeaders
    });
  }
  
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

    // 2. Cascade delete database tables for this user via SQL or simple delete API calls if there's no foreign key constraints blocking it.
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
