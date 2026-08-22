import { validateRequest, generateWithGeminiFallback } from './_security.js';

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

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { imageBase64, mimeType = 'image/jpeg', currentLang = 'el' } = body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing imageBase64 in request body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Strip data:image/...;base64, prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  // 3. Prepare Prompt for Gemini Vision
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
- "amount" MUST be the total final amount paid (number, positive).
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
    timeoutMs: 12000
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: 'AI Receipt Parsing failed', details: result.errorText }), {
      status: result.status || 500,
      headers: corsHeaders
    });
  }

  // 4. Parse result JSON
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
