import { validateRequest, getSupabasePublicConfig, generateWithGeminiFallback } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Validate CORS, Rate Limit, max body size (up to 4MB for image base64)
  const sec = validateRequest(request, { maxBodyBytes: 4 * 1024 * 1024 });
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  // 2. JWT Token Verification (Optional - supports Guest Mode & Logged-in users).
  // When a token IS present it must be valid; invalid tokens are rejected.
  // For authenticated users we also capture the user_id so we can enforce the
  // AI receipt scan fair-use limit server-side (authoritative, not bypassable).
  const authHeader = request.headers.get('Authorization') || '';
  let authenticatedUserId = null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = getSupabasePublicConfig(env);
    if (supabase) {
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
        try {
          const userData = await userRes.json();
          if (userData && userData.id) {
            authenticatedUserId = userData.id;
          }
        } catch (_) { /* ignore parse errors */ }
      } catch (err) {
        console.warn('Session verification error:', err.message);
        return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session' }), {
          status: 401,
          headers: corsHeaders
        });
      }
    }
  }

  // 3. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { imageBase64, mimeType = 'image/jpeg' } = body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing imageBase64 in request body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Strip data:image/...;base64, prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  // --------------------------------------------------------------------------
  // 3b. SCAN FAIR-USE LIMIT (server-side, authoritative)
  // Only authenticated users are tracked server-side. Guest mode (no token)
  // relies on the client-side gate.
  // Free: 5/month. Premium: 100/month.
  // --------------------------------------------------------------------------
  if (authenticatedUserId) {
    const supabase = getSupabasePublicConfig(env);
    if (supabase) {
      const { supabaseUrl, supabaseKey } = supabase;
      const authToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

      const rpcCall = async (rpcName) => {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: '{}'
          });
          if (!res.ok) return null;
          try { return await res.json(); } catch (_) { return null; }
        } catch (_) { return null; }
      };

      // Determine the user's plan limit.
      let premiumActive = false;
      try {
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=premium_active&id=eq.${authenticatedUserId}&limit=1`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        if (profileRes.ok) {
          const rows = await profileRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            premiumActive = rows[0].premium_active === true;
          }
        }
      } catch (_) { /* ignore profile fetch errors */ }

      const limit = premiumActive ? 100 : 5;
      const currentUsage = await rpcCall('get_scan_usage');

      if (currentUsage != null && currentUsage >= limit) {
        return new Response(JSON.stringify({
          error: 'SCAN_LIMIT_REACHED',
          message: premiumActive
            ? 'Monthly AI scan limit (100) reached.'
            : 'Monthly AI scan limit (5) reached. Upgrade to Premium for 100/month.'
        }), {
          status: 429,
          headers: corsHeaders
        });
      }

      // Increment usage BEFORE calling Gemini so concurrent requests cannot
      // exceed the limit. If the increment fails, still allow the call (best-effort).
      await rpcCall('increment_scan_usage');
    }
  }

  // 4. Prepare Prompt for Gemini Vision
  const categoriesList = [
    '🏠 Σπίτι', '🍔 Τρόφιμα', '🚗 Μεταφορές', '❤️ Υγεία',
    '🎓 Εκπαίδευση', '🎉 Διασκέδαση', '👕 Αγορές', '📱 Συνδρομές',
    '🧾 Φόροι', '📦 Διάφορα'
  ].join(', ');

  const promptText = `You are an expert OCR receipt and invoice parser for the Budget Assistant finance app.
Analyze the provided image of a receipt, bill, or invoice (Greek or English) and extract the financial data.

Allowed Expense Categories: ${categoriesList}

Return ONLY valid JSON matching this exact schema:
{
  "merchant": "Clean store or business name (e.g. Σκλαβενίτης, Shell, Zara, Goody's, Pharmacy)",
  "amount": 0.00,
  "currency": "EUR",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "category": "The best matching category from the allowed list",
  "subcategory": "A concise subcategory name in Greek (e.g. Σουπερμάρκετ, Βενζίνες, Εστιατόριο, Καφές, Φάρμακα, Ρούχα, Ρεύμα)",
  "confidence": 0.95
}

Strict Rules:
- Return ONLY pure JSON. No markdown code blocks, no explanation.
- "amount" MUST be the total final amount paid (number, positive). If no total is found, return 0.
- "merchant" should be clean and capitalized properly.
- If date is not visible on receipt, return today's date in YYYY-MM-DD format.`;

  const reqBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const modelNames = [
    'models/gemini-2.5-flash',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-latest'
  ];

  const result = await generateWithGeminiFallback({
    env,
    modelNames,
    reqBody,
    timeoutMs: 14000
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: 'AI Receipt Parsing failed', details: result.errorText }), {
      status: result.status || 500,
      headers: corsHeaders
    });
  }

  // 5. Parse result JSON & validate
  try {
    let parsedText = result.text.trim();
    if (parsedText.startsWith('```json')) {
      parsedText = parsedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (parsedText.startsWith('```')) {
      parsedText = parsedText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const receiptData = JSON.parse(parsedText);
    return new Response(JSON.stringify({ success: true, data: receiptData }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (parseErr) {
    return new Response(JSON.stringify({ error: 'Failed to parse AI output', raw: result.text }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
