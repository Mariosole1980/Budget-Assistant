import { validateRequest, getSupabasePublicConfig } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://www.budgetassistant.org',
    'https://budgetassistant.org',
    'https://budget-assistant-pwa.pages.dev',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost'
  ];
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: missing session token' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const token = authHeader.substring(7);
  const supabase = getSupabasePublicConfig(env);
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const { supabaseUrl, supabaseKey } = supabase;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid session token' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const senderUser = await userRes.json();
    const senderId = senderUser.id;

    const payload = await request.json();
    const { recipient_user_id, title, body, data } = payload || {};

    if (!recipient_user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing recipient_user_id, title or body' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Lookup recipient's FCM token from Supabase user_profiles
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${recipient_user_id}&select=fcm_token`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!profileRes.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch recipient profile' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const profiles = await profileRes.json();
    const fcmToken = profiles && profiles[0] ? profiles[0].fcm_token : null;

    if (!fcmToken) {
      return new Response(JSON.stringify({ success: false, message: 'Recipient has no registered FCM token' }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // If FCM_SERVER_KEY is present in env, send via FCM Legacy or HTTP v1
    const fcmServerKey = env.FCM_SERVER_KEY;
    if (fcmServerKey) {
      const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`
        },
        body: JSON.stringify({
          to: fcmToken,
          priority: 'high',
          notification: {
            title: title,
            body: body,
            sound: 'default',
            icon: 'ic_stat_icon_config_sample'
          },
          data: {
            ...data,
            sender_id: senderId
          }
        })
      });

      const fcmResult = await fcmRes.json();
      return new Response(JSON.stringify({ success: true, fcmResult }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Recipient token recorded, FCM key pending' }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
