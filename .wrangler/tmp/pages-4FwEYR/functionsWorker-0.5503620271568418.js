var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/ai.js
async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");
async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabaseUrl = env.SUPABASE_URL || "https://nnatvvahoeiemkfmzpwp.supabase.co";
    const supabaseKey = env.SUPABASE_ANON_KEY || "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
    try {
      await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.warn("Session verification warning:", err.message);
    }
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  const mode = body.mode || "extract";
  const queryText = body.queryText;
  if (!queryText && mode !== "test_models") {
    return new Response(JSON.stringify({ error: "Missing queryText" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (mode === "test_models") {
    if (!env.GEMINI_API_KEY) return new Response("No key", { status: 400, headers: corsHeaders });
    try {
      let models = [];
      let pageToken = "";
      do {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}${pageToken ? "&pageToken=" + pageToken : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) models = models.concat(data.models.map((m) => m.name));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return new Response(JSON.stringify({ models }), { headers: corsHeaders });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
  }
  let prompt = "";
  if (mode === "advisor") {
    const statsStr = body.stats ? JSON.stringify(body.stats) : "No stats available";
    prompt = `\u0395\u03AF\u03C3\u03B1\u03B9 \u03BF \u039F\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03CC\u03C2 \u03A3\u03CD\u03BC\u03B2\u03BF\u03C5\u03BB\u03BF\u03C2 AI (AI Coach) \u03C4\u03B7\u03C2 \u03B5\u03C6\u03B1\u03C1\u03BC\u03BF\u03B3\u03AE\u03C2 Budget Assistant.
\u039F \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03C3\u03BF\u03C5 \u03BA\u03AC\u03BD\u03B5\u03B9 \u03BC\u03B9\u03B1 \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7 \u03C3\u03C7\u03B5\u03C4\u03B9\u03BA\u03AC \u03BC\u03B5 \u03C4\u03B1 \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03AC \u03C4\u03BF\u03C5 \u03AE \u03C3\u03C5\u03BD\u03BF\u03BC\u03B9\u03BB\u03B5\u03AF \u03BC\u03B1\u03B6\u03AF \u03C3\u03BF\u03C5.
\u0391\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B5 \u03C6\u03B9\u03BB\u03B9\u03BA\u03AC, \u03C3\u03CD\u03BD\u03C4\u03BF\u03BC\u03B1 \u03BA\u03B1\u03B9 \u03C5\u03C0\u03BF\u03C3\u03C4\u03B7\u03C1\u03B9\u03BA\u03C4\u03B9\u03BA\u03AC \u03C3\u03C4\u03B1 \u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC (\u03AE \u03C3\u03C4\u03B7 \u03B3\u03BB\u03CE\u03C3\u03C3\u03B1 \u03C4\u03B7\u03C2 \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7\u03C2).
\u0394\u03CE\u03C3\u03B5 \u03C0\u03C1\u03B1\u03BA\u03C4\u03B9\u03BA\u03AD\u03C2 \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03AD\u03C2 \u03C3\u03C5\u03BC\u03B2\u03BF\u03C5\u03BB\u03AD\u03C2.
\u03A7\u03C1\u03B7\u03C3\u03B9\u03BC\u03BF\u03C0\u03BF\u03AF\u03B7\u03C3\u03B5 \u03C4\u03B1 \u03C0\u03B1\u03C1\u03B1\u03BA\u03AC\u03C4\u03C9 \u03C3\u03C4\u03B1\u03C4\u03B9\u03C3\u03C4\u03B9\u03BA\u03AC \u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1 \u03C4\u03BF\u03C5 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7 (\u03B1\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03BD) \u03B3\u03B9\u03B1 \u03BD\u03B1 \u03B4\u03CE\u03C3\u03B5\u03B9\u03C2 \u03C0\u03B9\u03BF \u03B5\u03BE\u03B1\u03C4\u03BF\u03BC\u03B9\u03BA\u03B5\u03C5\u03BC\u03AD\u03BD\u03B5\u03C2 \u03C3\u03C5\u03BC\u03B2\u03BF\u03C5\u03BB\u03AD\u03C2:
${statsStr}

\u039F\u0394\u0397\u0393\u0399\u0395\u03A3 \u0391\u039D\u0391\u039B\u03A5\u03A3\u0397\u03A3:
1. \u0397 \u03C3\u03B7\u03BC\u03B5\u03C1\u03B9\u03BD\u03AE \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03C4\u03B7\u03C2 \u03C3\u03C5\u03C3\u03BA\u03B5\u03C5\u03AE\u03C2 \u03C4\u03BF\u03C5 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7 \u03BF\u03C1\u03AF\u03B6\u03B5\u03C4\u03B1\u03B9 \u03C3\u03C4\u03BF \u03C0\u03B5\u03B4\u03AF\u03BF 'currentDate' \u03C4\u03C9\u03BD \u03C3\u03C4\u03B1\u03C4\u03B9\u03C3\u03C4\u03B9\u03BA\u03CE\u03BD. \u038C\u03C4\u03B1\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B1\u03BD\u03B1\u03C6\u03AD\u03C1\u03B5\u03C4\u03B1\u03B9 \u03C3\u03B5 \u03C3\u03C7\u03B5\u03C4\u03B9\u03BA\u03AD\u03C2 \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B5\u03C2 (\u03C0.\u03C7. '\u03B1\u03C5\u03C4\u03CC\u03BD \u03C4\u03BF\u03BD \u03BC\u03AE\u03BD\u03B1', '\u03C4\u03BF\u03BD \u03C0\u03C1\u03BF\u03B7\u03B3\u03BF\u03CD\u03BC\u03B5\u03BD\u03BF \u03BC\u03AE\u03BD\u03B1', '\u03C7\u03B8\u03B5\u03C2'), \u03C5\u03C0\u03BF\u03BB\u03CC\u03B3\u03B9\u03C3\u03B5 \u03C0\u03BF\u03B9\u03BF\u03C2 \u03BC\u03AE\u03BD\u03B1\u03C2/\u03AD\u03C4\u03BF\u03C2 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B5 \u03B2\u03AC\u03C3\u03B7 \u03C4\u03BF 'currentDate'. \u0391\u03A3\u03A7\u0395\u03A4\u03A9\u03A3 \u03B1\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03BD \u03BC\u03B5\u03BB\u03BB\u03BF\u03BD\u03C4\u03B9\u03BA\u03AD\u03C2 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 (\u03C0.\u03C7. \u03C4\u03BF\u03C5 2027) \u03BA\u03B1\u03C4\u03B1\u03C7\u03C9\u03C1\u03B7\u03BC\u03AD\u03BD\u03B5\u03C2, \u03BF '\u03C0\u03C1\u03BF\u03B7\u03B3\u03BF\u03CD\u03BC\u03B5\u03BD\u03BF\u03C2 \u03BC\u03AE\u03BD\u03B1\u03C2' \u03C5\u03C0\u03BF\u03BB\u03BF\u03B3\u03AF\u03B6\u03B5\u03C4\u03B1\u03B9 \u03B7\u03BC\u03B5\u03C1\u03BF\u03BB\u03BF\u03B3\u03B9\u03B1\u03BA\u03AC \u03C0\u03C1\u03B9\u03BD \u03B1\u03C0\u03CC \u03C4\u03BF 'currentDate'.
2. \u03A3\u03C4\u03BF \u03C0\u03B5\u03B4\u03AF\u03BF 'allTransactions' \u03AD\u03C7\u03B5\u03B9\u03C2 \u03CC\u03BB\u03BF \u03C4\u03BF \u03B9\u03C3\u03C4\u03BF\u03C1\u03B9\u03BA\u03CC \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03CE\u03BD \u03C4\u03BF\u03C5 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7. \u039A\u03AC\u03B8\u03B5 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE \u03AD\u03C7\u03B5\u03B9 \u03AD\u03BD\u03B1 \u03BC\u03BF\u03BD\u03B1\u03B4\u03B9\u03BA\u03CC \u03B1\u03BD\u03B1\u03B3\u03BD\u03C9\u03C1\u03B9\u03C3\u03C4\u03B9\u03BA\u03CC id (UUID string), \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 (date), \u03C4\u03CD\u03C0\u03BF (type: expense/income), \u03C0\u03BF\u03C3\u03CC (amount), \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 (category), \u03C5\u03C0\u03BF\u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 (subcategory) \u03BA\u03B1\u03B9 \u03C3\u03B7\u03BC\u03B5\u03AF\u03C9\u03C3\u03B7 (note).
3. \u038C\u03C4\u03B1\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03C1\u03C9\u03C4\u03AC\u03B5\u03B9 \u03B3\u03B9\u03B1 \u03BC\u03B9\u03B1 \u03C3\u03C5\u03B3\u03BA\u03B5\u03BA\u03C1\u03B9\u03BC\u03AD\u03BD\u03B7 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 (category) \u03AE \u03C5\u03C0\u03BF\u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 (subcategory) \u03AE \u03C3\u03C5\u03B3\u03BA\u03B5\u03BA\u03C1\u03B9\u03BC\u03AD\u03BD\u03BF \u03BC\u03AE\u03BD\u03B1, \u03C6\u03B9\u03BB\u03C4\u03C1\u03AC\u03C1\u03B9\u03C3\u03B5 \u03BA\u03B1\u03B9 \u03C5\u03C0\u03BF\u03BB\u03CC\u03B3\u03B9\u03C3\u03B5 \u03C4\u03BF \u03AC\u03B8\u03C1\u03BF\u03B9\u03C3\u03BC\u03B1 \u03C7\u03C1\u03B7\u03C3\u03B9\u03BC\u03BF\u03C0\u03BF\u03B9\u03CE\u03BD\u03C4\u03B1\u03C2 \u0391\u03A5\u03A3\u03A4\u0397\u03A1\u0391 \u03BC\u03CC\u03BD\u03BF \u03C4\u03B9\u03C2 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 \u03C0\u03BF\u03C5 \u03AD\u03C7\u03BF\u03C5\u03BD \u03C4\u03B7\u03BD \u03B1\u03BD\u03C4\u03AF\u03C3\u03C4\u03BF\u03B9\u03C7\u03B7 \u03C4\u03B9\u03BC\u03AE \u03C3\u03C4\u03BF \u03C0\u03B5\u03B4\u03AF\u03BF 'category' \u03AE 'subcategory'. \u039C\u03B7\u03BD \u03C3\u03C5\u03BC\u03C0\u03B5\u03C1\u03B9\u03BB\u03B1\u03BC\u03B2\u03AC\u03BD\u03B5\u03B9\u03C2 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 \u03AC\u03BB\u03BB\u03C9\u03BD \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03B9\u03CE\u03BD \u03B5\u03C0\u03B5\u03B9\u03B4\u03AE \u03C4\u03B1\u03B9\u03C1\u03B9\u03AC\u03B6\u03B5\u03B9 \u03B7 \u03C3\u03B7\u03BC\u03B5\u03AF\u03C9\u03C3\u03B7 (note) \u03BC\u03B5 \u03C4\u03BF \u03CC\u03BD\u03BF\u03BC\u03B1 \u03C4\u03B7\u03C2 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1\u03C2 (\u03C0.\u03C7. \u03B1\u03BD \u03BC\u03B9\u03B1 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE \u03AD\u03C7\u03B5\u03B9 category '\u0394\u03B9\u03AC\u03C6\u03BF\u03C1\u03B1' \u03BC\u03B5 note 'Lidl', \u03BC\u03B7\u03BD \u03C4\u03B7 \u03BC\u03B5\u03C4\u03C1\u03AE\u03C3\u03B5\u03B9\u03C2 \u03C3\u03C4\u03BF '\u03A3\u03BF\u03CD\u03C0\u03B5\u03C1 \u039C\u03AC\u03C1\u03BA\u03B5\u03C4' \u03B5\u03BA\u03C4\u03CC\u03C2 \u03B1\u03BD \u03C4\u03BF \u03B6\u03B7\u03C4\u03AE\u03C3\u03B5\u03B9 \u03C1\u03B7\u03C4\u03AC \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2). \u03A5\u03C0\u03BF\u03BB\u03CC\u03B3\u03B9\u03C3\u03B5 \u03C4\u03BF \u03AC\u03B8\u03C1\u03BF\u03B9\u03C3\u03BC\u03B1 \u03BC\u03B5 \u03B1\u03C0\u03CC\u03BB\u03C5\u03C4\u03B7 \u03BC\u03B1\u03B8\u03B7\u03BC\u03B1\u03C4\u03B9\u03BA\u03AE \u03B1\u03BA\u03C1\u03AF\u03B2\u03B5\u03B9\u03B1.
4. \u03A3\u03C4\u03BF \u03C0\u03B5\u03B4\u03AF\u03BF 'budgets' \u03AD\u03C7\u03B5\u03B9\u03C2 \u03C4\u03B1 \u03BC\u03B7\u03BD\u03B9\u03B1\u03AF\u03B1 \u03CC\u03C1\u03B9\u03B1 \u03C0\u03C1\u03BF\u03CB\u03C0\u03BF\u03BB\u03BF\u03B3\u03B9\u03C3\u03BC\u03BF\u03CD \u03B1\u03BD\u03AC \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1. \u03A3\u03CD\u03B3\u03BA\u03C1\u03B9\u03BD\u03B5 \u03C4\u03B1 \u03AD\u03BE\u03BF\u03B4\u03B1 \u03C4\u03B7\u03C2 \u03B1\u03BD\u03C4\u03AF\u03C3\u03C4\u03BF\u03B9\u03C7\u03B7\u03C2 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1\u03C2 \u03BC\u03B5 \u03C4\u03BF budget \u03C4\u03B7\u03C2 \u03B1\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03C1\u03C9\u03C4\u03AC\u03B5\u03B9 \u03B3\u03B9\u03B1 \u03C4\u03B7\u03BD \u03BA\u03B1\u03C4\u03AC\u03C3\u03C4\u03B1\u03C3\u03B7 \u03C4\u03BF\u03C5 budget.
5. \u0391\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B5 \u03BC\u03B5 \u03B2\u03AC\u03C3\u03B7 \u03C4\u03B1 \u03C0\u03C1\u03B1\u03B3\u03BC\u03B1\u03C4\u03B9\u03BA\u03AC \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1 \u03C0\u03BF\u03C5 \u03B2\u03BB\u03AD\u03C0\u03B5\u03B9\u03C2 \u03BA\u03B1\u03B9 \u03BC\u03B7\u03BD \u03C5\u03C0\u03BF\u03B8\u03AD\u03C4\u03B5\u03B9\u03C2/\u03C6\u03B1\u03BD\u03C4\u03AC\u03B6\u03B5\u03C3\u03B1\u03B9 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 \u03AE \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B5\u03C2 \u03C0\u03BF\u03C5 \u03B4\u03B5\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03BD.
6. \u038C\u03C4\u03B1\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03C1\u03C9\u03C4\u03AC\u03B5\u03B9 \u03B3\u03B5\u03BD\u03B9\u03BA\u03AC '\u03A0\u03CE\u03C2 \u03C4\u03B1 \u03C0\u03AE\u03B3\u03B1 \u03C6\u03AD\u03C4\u03BF\u03C2;' \u03AE \u03B3\u03B9\u03B1 \u03C4\u03B1 \u03B5\u03C4\u03AE\u03C3\u03B9\u03B1 \u03C3\u03CD\u03BD\u03BF\u03BB\u03B1 \u03C4\u03BF\u03C5 \u03C4\u03C1\u03AD\u03C7\u03BF\u03BD\u03C4\u03BF\u03C2 \u03AD\u03C4\u03BF\u03C5\u03C2, \u03C7\u03C1\u03B7\u03C3\u03B9\u03BC\u03BF\u03C0\u03BF\u03AF\u03B7\u03C3\u03B5 \u0391\u03A5\u03A3\u03A4\u0397\u03A1\u0391 \u03C4\u03B1 \u03C0\u03C1\u03BF-\u03C5\u03C0\u03BF\u03BB\u03BF\u03B3\u03B9\u03C3\u03BC\u03AD\u03BD\u03B1 \u03B5\u03C4\u03AE\u03C3\u03B9\u03B1 \u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1 'ytdCurrentYearIncome', 'ytdCurrentYearExpense' \u03BA\u03B1\u03B9 'ytdCurrentYearNetBalance' \u03B1\u03C0\u03CC \u03C4\u03BF \u03B1\u03BD\u03C4\u03B9\u03BA\u03B5\u03AF\u03BC\u03B5\u03BD\u03BF stats, \u03C4\u03B1 \u03BF\u03C0\u03BF\u03AF\u03B1 \u03C3\u03C5\u03BC\u03C6\u03C9\u03BD\u03BF\u03CD\u03BD 100% \u03BC\u03B5 \u03C4\u03B7\u03BD \u03BA\u03B1\u03C1\u03C4\u03AD\u03BB\u03B1 \u0395\u03C0\u03B9\u03C3\u03BA\u03CC\u03C0\u03B7\u03C3\u03B7\u03C2.

\u0397 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03AE \u03C3\u03BF\u03C5 \u03A0\u03A1\u0395\u03A0\u0395\u0399 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u0391\u03A5\u03A3\u03A4\u0397\u03A1\u0391 \u03AD\u03BD\u03B1 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF JSON object (\u03C7\u03C9\u03C1\u03AF\u03C2 markdown backticks, \u03C7\u03C9\u03C1\u03AF\u03C2 \u03AD\u03BE\u03C4\u03C1\u03B1 \u03BA\u03B5\u03AF\u03BC\u03B5\u03BD\u03BF) \u03BC\u03B5 \u03C4\u03B1 \u03B5\u03BE\u03AE\u03C2 \u03C0\u03B5\u03B4\u03AF\u03B1:
{
  "responseHtml": "\u0397 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03AE \u03C3\u03BF\u03C5 \u03C3\u03B5 \u03BC\u03BF\u03C1\u03C6\u03AE HTML/markdown (\u03C7\u03C1\u03B7\u03C3\u03B9\u03BC\u03BF\u03C0\u03BF\u03AF\u03B7\u03C3\u03B5 <strong> \u03B3\u03B9\u03B1 \u03AD\u03BD\u03C4\u03BF\u03BD\u03B1 \u03B3\u03C1\u03AC\u03BC\u03BC\u03B1\u03C4\u03B1, <br> \u03B3\u03B9\u03B1 \u03B1\u03BB\u03BB\u03B1\u03B3\u03AE \u03B3\u03C1\u03B1\u03BC\u03BC\u03AE\u03C2, \u2022 \u03B3\u03B9\u03B1 bullet points). \u0391\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B6\u03B7\u03C4\u03AC\u03B5\u03B9 \u03BA\u03B1\u03C4\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B5\u03BE\u03CC\u03B4\u03C9\u03BD \u03AE \u03B5\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03B1\u03C3\u03AF\u03B1, \u03B3\u03C1\u03AC\u03C8\u03B5 \u03BC\u03B9\u03B1 \u03C3\u03CD\u03BD\u03C4\u03BF\u03BC\u03B7 \u03B5\u03C0\u03B9\u03B2\u03B5\u03B2\u03B1\u03AF\u03C9\u03C3\u03B7 (\u03C0.\u03C7. '\u03A6\u03C5\u03C3\u03B9\u03BA\u03AC, \u03B5\u03C4\u03BF\u03AF\u03BC\u03B1\u03C3\u03B1 \u03C4\u03B9\u03C2 \u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 \u03B3\u03B9\u03B1 \u03B5\u03C3\u03AD\u03BD\u03B1...').",
  "classifiedIntent": "\u0397 \u03C0\u03C1\u03CC\u03B8\u03B5\u03C3\u03B7 \u03C4\u03B7\u03C2 \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7\u03C2. \u03A0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03AF\u03B1 \u03B1\u03C0\u03CC \u03C4\u03B9\u03C2 \u03B5\u03BE\u03AE\u03C2 \u03C4\u03B9\u03BC\u03AD\u03C2: 'overspending', 'savings_advice', 'forecast', 'category_spending', 'budget_status', 'what_if', 'milestone', 'search_query', 'unknown'.",
  "alternativePhrasings": ["3 \u03B4\u03B9\u03B1\u03C6\u03BF\u03C1\u03B5\u03C4\u03B9\u03BA\u03BF\u03AF \u03B5\u03BD\u03B1\u03BB\u03BB\u03B1\u03BA\u03B1\u03BD\u03BF\u03AF \u03C4\u03C1\u03CC\u03C0\u03BF\u03B9 (\u03C3\u03C4\u03B1 \u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC) \u03B3\u03B9\u03B1 \u03BD\u03B1 \u03C1\u03C9\u03C4\u03AE\u03C3\u03B5\u03B9 \u03BA\u03B1\u03BD\u03B5\u03AF\u03C2 \u03C4\u03BF \u03AF\u03B4\u03B9\u03BF \u03B1\u03BA\u03C1\u03B9\u03B2\u03CE\u03C2 \u03C0\u03C1\u03AC\u03B3\u03BC\u03B1."],
  "extractedEntities": [
    { "text": "\u03BC\u03B9\u03B1 \u03BB\u03AD\u03BE\u03B7 \u03AE \u03C6\u03C1\u03AC\u03C3\u03B7-\u03BA\u03BB\u03B5\u03B9\u03B4\u03AF \u03B1\u03C0\u03CC \u03C4\u03B7\u03BD \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7 (\u03C0.\u03C7. '\u03BA\u03B1\u03C6\u03AD')", "concept": "\u03B7 \u03AD\u03BD\u03BD\u03BF\u03B9\u03B1 (\u03C0.\u03C7. 'coffee')", "category": "\u03B7 \u03C0\u03B9\u03BF \u03BA\u03B1\u03C4\u03AC\u03BB\u03BB\u03B7\u03BB\u03B7 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 \u03B5\u03BE\u03CC\u03B4\u03C9\u03BD \u03B1\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03B5\u03B9 (\u03C0.\u03C7. '\u039A\u0391\u03A6\u0395\u03A3' \u03AE '\u0395\u03A3\u03A4\u0399\u0391\u03A3\u0397')" }
  ],
  "transactionsToAdd": [
    { "amount": 15.0, "note": "\u03B2\u03B5\u03BD\u03B6\u03AF\u03BD\u03B7", "type": "expense" }
  ],
  "transactionsToUpdate": [
    { "id": "\u03C4\u03BF ID \u03C4\u03B7\u03C2 \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03C3\u03B1\u03C2 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE\u03C2 \u03B1\u03C0\u03CC \u03C4\u03BF allTransactions", "amount": 2.20, "note": "\u03BD\u03AD\u03BF\u03C2 \u03C4\u03AF\u03C4\u03BB\u03BF\u03C2/\u03C3\u03B7\u03BC\u03B5\u03AF\u03C9\u03C3\u03B7", "category": "\u03BD\u03AD\u03B1 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 \u03B1\u03BD \u03B6\u03B7\u03C4\u03AE\u03B8\u03B7\u03BA\u03B5 \u03B1\u03BB\u03BB\u03B1\u03B3\u03AE", "subcategory": "\u03BD\u03AD\u03B1 \u03C5\u03C0\u03BF\u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 \u03B1\u03BD \u03B6\u03B7\u03C4\u03AE\u03B8\u03B7\u03BA\u03B5", "account_from": "\u03BD\u03AD\u03BF\u03C2 \u03BB\u03BF\u03B3\u03B1\u03C1\u03B9\u03B1\u03C3\u03BC\u03CC\u03C2 \u03B1\u03BD \u03B6\u03B7\u03C4\u03AE\u03B8\u03B7\u03BA\u03B5", "date": "\u03BD\u03AD\u03B1 \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03C3\u03B5 ISO format (\u03C0.\u03C7. 2026-06-27T17:09:52.000Z) \u03B1\u03BD \u03B6\u03B7\u03C4\u03AE\u03B8\u03B7\u03BA\u03B5 \u03B1\u03BB\u03BB\u03B1\u03B3\u03AE", "type": "expense" }
  ],
  "transactionsToDelete": [
    "\u03C4\u03BF ID \u03C4\u03B7\u03C2 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE\u03C2 \u03C0\u03BF\u03C5 \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B4\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03B5\u03AF"
  ]
}

\u0391\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B6\u03AE\u03C4\u03B7\u03C3\u03B5 \u03C1\u03B7\u03C4\u03AC \u03BD\u03B1 \u03C0\u03C1\u03BF\u03C3\u03B8\u03AD\u03C3\u03B5\u03B9/\u03BA\u03B1\u03C4\u03B1\u03B3\u03C1\u03AC\u03C8\u03B5\u03B9 \u03BD\u03AD\u03B1 \u03AD\u03BE\u03BF\u03B4\u03B1/\u03AD\u03C3\u03BF\u03B4\u03B1, \u03C3\u03C5\u03BC\u03C0\u03BB\u03AE\u03C1\u03C9\u03C3\u03B5 \u03C4\u03BF "transactionsToAdd".
\u0391\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B6\u03AE\u03C4\u03B7\u03C3\u03B5 \u03BD\u03B1 \u03B5\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03B1\u03C3\u03C4\u03B5\u03AF, \u03BD\u03B1 \u03B1\u03BB\u03BB\u03AC\u03BE\u03B5\u03B9, \u03BD\u03B1 \u03BC\u03B5\u03C4\u03B1\u03C6\u03AD\u03C1\u03B5\u03B9, \u03BD\u03B1 \u03B4\u03B9\u03BF\u03C1\u03B8\u03CE\u03C3\u03B5\u03B9 \u03BC\u03B9\u03B1 \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03C3\u03B1 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE (\u03C0.\u03C7. "\u03AC\u03BB\u03BB\u03B1\u03BE\u03B5 \u03C4\u03B7\u03BD \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03C4\u03BF\u03C5 \u03A6\u03BF\u03CD\u03C1\u03BD\u03BF\u03C5 2.20 \u03C3\u03C4\u03B9\u03C2 27/6"), \u03B2\u03C1\u03B5\u03C2 \u03C4\u03B7\u03BD \u03B1\u03BD\u03C4\u03AF\u03C3\u03C4\u03BF\u03B9\u03C7\u03B7 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE \u03C3\u03C4\u03BF "allTransactions", \u03C0\u03AC\u03C1\u03B5 \u03C4\u03BF "id" \u03C4\u03B7\u03C2 \u03BA\u03B1\u03B9 \u03B2\u03AC\u03BB\u03B5 \u03AD\u03BD\u03B1 \u03B1\u03BD\u03C4\u03B9\u03BA\u03B5\u03AF\u03BC\u03B5\u03BD\u03BF \u03C3\u03C4\u03BF "transactionsToUpdate" \u03BC\u03B5 \u03C4\u03BF \u03C3\u03C9\u03C3\u03C4\u03CC "id" \u03BA\u03B1\u03B9 \u03C4\u03B9\u03C2 \u03B1\u03BB\u03BB\u03B1\u03B3\u03AD\u03C2 \u03C0\u03BF\u03C5 \u03B6\u03AE\u03C4\u03B7\u03C3\u03B5.
\u0391\u03BD \u03BF \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B6\u03AE\u03C4\u03B7\u03C3\u03B5 \u03BD\u03B1 \u03B4\u03B9\u03B1\u03B3\u03C1\u03AC\u03C8\u03B5\u03B9/\u03B1\u03BA\u03C5\u03C1\u03CE\u03C3\u03B5\u03B9 \u03BC\u03B9\u03B1 \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03C3\u03B1 \u03C3\u03C5\u03BD\u03B1\u03BB\u03BB\u03B1\u03B3\u03AE, \u03B2\u03C1\u03B5\u03C2 \u03C4\u03B7\u03BD \u03C3\u03C4\u03BF "allTransactions", \u03C0\u03AC\u03C1\u03B5 \u03C4\u03BF "id" \u03C4\u03B7\u03C2 \u03BA\u03B1\u03B9 \u03C0\u03C1\u03CC\u03C3\u03B8\u03B5\u03C3\u03AD \u03C4\u03BF \u03C3\u03C4\u03BF "transactionsToDelete".

\u0395\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7: "${queryText}"`;
  } else {
    const categoriesStr = body.categoriesStr || "";
    const SYSTEM_PROMPT = `\u0395\u03AF\u03C3\u03B1\u03B9 \u03AD\u03BD\u03B1\u03C2 \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03CC\u03C2 \u03B2\u03BF\u03B7\u03B8\u03CC\u03C2 (Expense Tracker AI). 
\u039F \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7\u03C2 \u03B8\u03B1 \u03C3\u03BF\u03C5 \u03B4\u03CE\u03C3\u03B5\u03B9 \u03BC\u03B9\u03B1 \u03C0\u03C1\u03CC\u03C4\u03B1\u03C3\u03B7 (\u03C3\u03C5\u03BD\u03AE\u03B8\u03C9\u03C2 \u03C3\u03C4\u03B1 \u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC) \u03C3\u03C7\u03B5\u03C4\u03B9\u03BA\u03AC \u03BC\u03B5 \u03BA\u03AC\u03C0\u03BF\u03B9\u03BF \u03AD\u03BE\u03BF\u03B4\u03BF.
\u0397 \u03B4\u03BF\u03C5\u03BB\u03B5\u03B9\u03AC \u03C3\u03BF\u03C5 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BD\u03B1 \u03B5\u03BE\u03AC\u03B3\u03B5\u03B9\u03C2 \u03C4\u03BF \u03C0\u03BF\u03C3\u03CC (amount), \u03C4\u03B7\u03BD \u03C4\u03BF\u03C0\u03BF\u03B8\u03B5\u03C3\u03AF\u03B1/\u03AD\u03BC\u03C0\u03BF\u03C1\u03BF (merchant) \u03BA\u03B1\u03B9 \u03C4\u03B7\u03BD \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1 (category).

\u039A\u0391\u039D\u039F\u039D\u0395\u03A3:
1. \u03A4\u03BF "amount" \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BD\u03BF\u03CD\u03BC\u03B5\u03C1\u03BF (float). \u0391\u03BD \u03B4\u03B5\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03B5\u03B9, \u03B2\u03AC\u03BB\u03B5 null.
2. \u03A4\u03BF "merchant" \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03AD\u03BD\u03B1 \u03BC\u03B9\u03BA\u03C1\u03CC string (\u03C0.\u03C7. "\u03A3\u03BA\u03BB\u03B1\u03B2\u03B5\u03BD\u03AF\u03C4\u03B7\u03C2", "\u0394\u0395\u0397"). \u0391\u03BD \u03B4\u03B5\u03BD \u03B1\u03BD\u03B1\u03C6\u03AD\u03C1\u03B5\u03C4\u03B1\u03B9, \u03B2\u03AC\u03BB\u03B5 null.
3. \u03A4\u03BF "category" \u03A0\u03A1\u0395\u03A0\u0395\u0399 \u039F\u03A0\u03A9\u03A3\u0394\u0397\u03A0\u039F\u03A4\u0395 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03AF\u03B1 \u03B1\u03C0\u03CC \u03C4\u03B9\u03C2 \u03B4\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B5\u03C2 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B5\u03C2 \u03C0\u03BF\u03C5 \u03B8\u03B1 \u03C3\u03BF\u03C5 \u03B4\u03BF\u03B8\u03BF\u03CD\u03BD. \u0391\u03BD \u03B4\u03B5\u03BD \u03C4\u03B1\u03B9\u03C1\u03B9\u03AC\u03B6\u03B5\u03B9 \u03BA\u03B1\u03BC\u03AF\u03B1, \u03B4\u03B9\u03AC\u03BB\u03B5\u03BE\u03B5 \u03C4\u03B7\u03BD \u03C0\u03B9\u03BF \u03BA\u03BF\u03BD\u03C4\u03B9\u03BD\u03AE \u03AE "\u0393\u03B5\u03BD\u03B9\u03BA\u03AC \u0388\u03BE\u03BF\u03B4\u03B1".
4. \u0397 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03AE \u03C3\u03BF\u03C5 \u03A0\u03A1\u0395\u03A0\u0395\u0399 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u0391\u03A5\u03A3\u03A4\u0397\u03A1\u0391 \u03AD\u03BD\u03B1 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF JSON object, \u03C7\u03C9\u03C1\u03AF\u03C2 markdown, \u03C7\u03C9\u03C1\u03AF\u03C2 backticks, \u03C7\u03C9\u03C1\u03AF\u03C2 \u03AD\u03BE\u03C4\u03C1\u03B1 \u03BA\u03B5\u03AF\u03BC\u03B5\u03BD\u03BF. \u03A0\u03B1\u03C1\u03AC\u03B4\u03B5\u03B9\u03B3\u03BC\u03B1: {"amount": 50, "merchant": "\u03A3\u03BA\u03BB\u03B1\u03B2\u03B5\u03BD\u03AF\u03C4\u03B7\u03C2", "category": "\u03A4\u03A1\u039F\u03A6\u0399\u039C\u0391"}
`;
    prompt = `${SYSTEM_PROMPT}
\u0394\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B5\u03C2 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B5\u03C2: ${categoriesStr}

\u03A0\u03C1\u03CC\u03C4\u03B1\u03C3\u03B7 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7: "${queryText}"`;
  }
  let debugInfo = [];
  try {
    if (env.GEMINI_API_KEY) {
      const modelsToTry = [
        "models/gemini-flash-lite-latest",
        "models/gemini-3.1-flash-lite",
        "models/gemini-2.5-flash",
        "models/gemini-3.5-flash"
      ];
      const reqBody = {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: mode === "advisor" ? 0.7 : 0.1
        }
      };
      if (mode === "advisor") {
        let contents = [];
        if (body.history && Array.isArray(body.history)) {
          contents = body.history.map((h) => ({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.content }]
          }));
        }
        contents.push({
          role: "user",
          parts: [{ text: queryText }]
        });
        reqBody.contents = contents;
        reqBody.systemInstruction = {
          parts: [{ text: prompt }]
        };
      } else {
        reqBody.contents = [{ parts: [{ text: prompt }] }];
      }
      let response;
      let lastErrText = "";
      for (const modelName of modelsToTry) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8e3);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
          response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(reqBody)
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            break;
          } else {
            lastErrText = await response.text();
            debugInfo.push(`${modelName} Error: ` + lastErrText);
          }
        } catch (e) {
          clearTimeout(timeoutId);
          debugInfo.push(`${modelName} Exception: ` + e.message);
        }
      }
      if (response && response.ok) {
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return new Response(text, { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ error: "Gemini API failure", debug: debugInfo }), {
          status: response && response.status ? response.status : 500,
          headers: corsHeaders
        });
      }
    } else {
      debugInfo.push("GEMINI_API_KEY is not defined in env.");
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing from environment", debug: debugInfo }), {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug: debugInfo }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
__name(onRequestPost, "onRequestPost");

// api/coach.js
async function onRequestOptions2(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");
async function onRequestPost2(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabaseUrl = env.SUPABASE_URL || "https://nnatvvahoeiemkfmzpwp.supabase.co";
    const supabaseKey = env.SUPABASE_ANON_KEY || "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
    try {
      await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.warn("Session verification warning:", err.message);
    }
  }
  let question, lang, financialContext;
  try {
    const body = await request.json();
    question = body.question || "";
    lang = body.lang || "el";
    financialContext = body.financialContext || {};
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const ctxLines = [];
  if (financialContext.monthName) ctxLines.push(`\u039C\u03AE\u03BD\u03B1\u03C2: ${financialContext.monthName}`);
  if (financialContext.monthIncome != null) ctxLines.push(`\u0395\u03B9\u03C3\u03CC\u03B4\u03B7\u03BC\u03B1 \u03C4\u03C1\u03AD\u03C7\u03BF\u03BD\u03C4\u03BF\u03C2 \u03BC\u03AE\u03BD\u03B1: ${financialContext.monthIncome}\u20AC`);
  if (financialContext.monthExpense != null) ctxLines.push(`\u0388\u03BE\u03BF\u03B4\u03B1 \u03C4\u03C1\u03AD\u03C7\u03BF\u03BD\u03C4\u03BF\u03C2 \u03BC\u03AE\u03BD\u03B1: ${financialContext.monthExpense}\u20AC`);
  if (financialContext.savingsRate) ctxLines.push(`\u03A0\u03BF\u03C3\u03BF\u03C3\u03C4\u03CC \u03B1\u03C0\u03BF\u03C4\u03B1\u03BC\u03AF\u03B5\u03C5\u03C3\u03B7\u03C2: ${financialContext.savingsRate}`);
  if (financialContext.totalBalance != null) ctxLines.push(`\u03A3\u03C5\u03BD\u03BF\u03BB\u03B9\u03BA\u03CC \u03C5\u03C0\u03CC\u03BB\u03BF\u03B9\u03C0\u03BF: ${financialContext.totalBalance}\u20AC`);
  if (financialContext.topCategories && financialContext.topCategories.length > 0) {
    ctxLines.push("\u039A\u03BF\u03C1\u03C5\u03C6\u03B1\u03AF\u03B5\u03C2 \u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B5\u03C2 \u03B5\u03BE\u03CC\u03B4\u03C9\u03BD:");
    financialContext.topCategories.forEach((c) => ctxLines.push(`  - ${c.name}: ${c.total}\u20AC`));
  }
  const contextBlock = ctxLines.length > 0 ? ctxLines.join("\n") : "\u0394\u03B5\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03BD \u03B4\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B1 \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03AC \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1.";
  const SYSTEM_PROMPT = `\u0395\u03AF\u03C3\u03B1\u03B9 \u03AD\u03BD\u03B1\u03C2 \u03AD\u03BE\u03C5\u03C0\u03BD\u03BF\u03C2 \u03C0\u03C1\u03BF\u03C3\u03C9\u03C0\u03B9\u03BA\u03CC\u03C2 \u03BF\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03CC\u03C2 \u03B2\u03BF\u03B7\u03B8\u03CC\u03C2 \u039A\u0391\u0399 \u03C0\u03B1\u03C1\u03B1\u03B3\u03C9\u03B3\u03CC\u03C2 \u03B5\u03BA\u03C0\u03B1\u03B9\u03B4\u03B5\u03C5\u03C4\u03B9\u03BA\u03CE\u03BD \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03C9\u03BD \u03B3\u03B9\u03B1 offline AI \u03C3\u03CD\u03C3\u03C4\u03B7\u03BC\u03B1.

\u0393\u03BB\u03CE\u03C3\u03C3\u03B1 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7\u03C2: ${lang === "el" ? "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC" : "\u0391\u03B3\u03B3\u03BB\u03B9\u03BA\u03AC"}

\u039F\u03B9\u03BA\u03BF\u03BD\u03BF\u03BC\u03B9\u03BA\u03AC \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7:
${contextBlock}

\u039A\u0391\u039D\u039F\u039D\u0395\u03A3:
1. \u0392\u03B1\u03C3\u03AF\u03C3\u03BF\u03C5 \u0391\u03A0\u039F\u039A\u039B\u0395\u0399\u03A3\u03A4\u0399\u039A\u0391 \u03C3\u03C4\u03B1 \u03C0\u03B1\u03C1\u03B1\u03C0\u03AC\u03BD\u03C9 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1. \u039C\u03B7\u03BD \u03BA\u03AC\u03BD\u03B5\u03B9\u03C2 \u03C5\u03C0\u03BF\u03B8\u03AD\u03C3\u03B5\u03B9\u03C2.
2. \u0391\u03C0\u03AC\u03BD\u03C4\u03B1 \u03BC\u03B5 \u03C6\u03B9\u03BB\u03B9\u03BA\u03CC, \u03B1\u03C0\u03BB\u03CC \u03C4\u03CC\u03BD\u03BF. \u03A7\u03C1\u03B7\u03C3\u03B9\u03BC\u03BF\u03C0\u03BF\u03AF\u03B7\u03C3\u03B5 \u03C3\u03C5\u03B3\u03BA\u03B5\u03BA\u03C1\u03B9\u03BC\u03AD\u03BD\u03BF\u03C5\u03C2 \u03B1\u03C1\u03B9\u03B8\u03BC\u03BF\u03CD\u03C2 \u03B1\u03C0\u03CC \u03C4\u03B1 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1.
3. \u0397 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03AE \u03C3\u03BF\u03C5 \u0394\u0395\u039D \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03BE\u03B5\u03C0\u03B5\u03C1\u03BD\u03AC \u03C4\u03B9\u03C2 3-4 \u03C0\u03C1\u03BF\u03C4\u03AC\u03C3\u03B5\u03B9\u03C2.
4. \u03A0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03C0\u03B9\u03C3\u03C4\u03C1\u03AD\u03C8\u03B5\u03B9\u03C2 \u0391\u03A5\u03A3\u03A4\u0397\u03A1\u0391 valid JSON (\u03C7\u03C9\u03C1\u03AF\u03C2 markdown, \u03C7\u03C9\u03C1\u03AF\u03C2 backticks).

\u03A4\u03BF JSON \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 \u0391\u039A\u03A1\u0399\u0392\u03A9\u03A3 \u03B1\u03C5\u03C4\u03AE \u03C4\u03B7 \u03BC\u03BF\u03C1\u03C6\u03AE:
{
  "answer": "\u0397 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03AE \u03C3\u03BF\u03C5 \u03C3\u03C4\u03BF\u03BD \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7 \u03B5\u03B4\u03CE",
  "training": {
    "intent": "\u03AD\u03BD\u03B1 \u03B1\u03C0\u03CC: overspending|savings_advice|forecast|category_spending|budget_status|what_if|milestone|search_query|general_advice",
    "new_examples": ["\u03BA\u03B1\u03BD\u03BF\u03BD\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C6\u03C1\u03AC\u03C3\u03B7 1", "\u03BA\u03B1\u03BD\u03BF\u03BD\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C6\u03C1\u03AC\u03C3\u03B7 2", "\u03BA\u03B1\u03BD\u03BF\u03BD\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C6\u03C1\u03AC\u03C3\u03B7 3"],
    "entities": [
      { "text": "\u0391\u039D \u03C5\u03C0\u03AC\u03C1\u03C7\u03B5\u03B9 \u03B1\u03BD\u03B1\u03B3\u03BD\u03C9\u03C1\u03B9\u03C3\u03BC\u03AD\u03BD\u03BF\u03C2 \u03AD\u03BC\u03C0\u03BF\u03C1\u03BF\u03C2/brand \u03C3\u03C4\u03B7\u03BD \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7", "concept": "\u03AD\u03BD\u03BD\u03BF\u03B9\u03B1", "category": "\u03BA\u03B1\u03C4\u03B7\u03B3\u03BF\u03C1\u03AF\u03B1" }
    ]
  }
}

\u0393\u03B9\u03B1 \u03C4\u03BF "new_examples": \u03B3\u03C1\u03AC\u03C8\u03B5 3-5 \u0394\u0399\u0391\u03A6\u039F\u03A1\u0395\u03A4\u0399\u039A\u0395\u03A3 \u03B4\u03B9\u03B1\u03C4\u03C5\u03C0\u03CE\u03C3\u03B5\u03B9\u03C2 \u03C4\u03B7\u03C2 \u03AF\u03B4\u03B9\u03B1\u03C2 \u03B5\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7\u03C2, \u03BA\u03B1\u03BD\u03BF\u03BD\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B5\u03C2 (\u03C7\u03C9\u03C1\u03AF\u03C2 \u03C4\u03CC\u03BD\u03BF\u03C5\u03C2, lowercase).
\u0393\u03B9\u03B1 \u03C4\u03BF "entities": \u03B1\u03BD \u03B4\u03B5\u03BD \u03C5\u03C0\u03AC\u03C1\u03C7\u03BF\u03C5\u03BD entities, \u03B2\u03AC\u03BB\u03B5 \u03BA\u03B5\u03BD\u03CC array [].`;
  const promptText = `${SYSTEM_PROMPT}

\u0395\u03C1\u03CE\u03C4\u03B7\u03C3\u03B7 \u03C7\u03C1\u03AE\u03C3\u03C4\u03B7: "${question}"`;
  try {
    let flashModelName = null;
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
    const mRes = await fetch(modelsUrl);
    if (mRes.ok) {
      const mData = await mRes.json();
      let selectedModel = mData.models.find((m) => m.name === "models/gemini-flash-latest" && m.supportedGenerationMethods.includes("generateContent"));
      if (!selectedModel) {
        selectedModel = mData.models.find((m) => m.name.includes("gemini-1.5-flash") && m.supportedGenerationMethods.includes("generateContent"));
      }
      if (!selectedModel) {
        selectedModel = mData.models.find((m) => m.name.includes("gemini-2.0-flash") && !m.name.includes("lite") && m.supportedGenerationMethods.includes("generateContent"));
      }
      if (!selectedModel) {
        selectedModel = mData.models.find((m) => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent"));
      }
      if (selectedModel) {
        flashModelName = selectedModel.name;
      }
    }
    if (!flashModelName) {
      flashModelName = "models/gemini-1.5-flash";
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/${flashModelName}:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 512
        }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      if (flashModelName !== "models/gemini-1.5-flash") {
        const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response2 = await fetch(url2, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 512 }
          })
        });
        if (response2.ok) {
          const data2 = await response2.json();
          const text2 = data2.candidates[0].content.parts[0].text;
          return new Response(text2, { headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify({ error: "Gemini API error", detail: errText }), { status: 502, headers: corsHeaders });
    }
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return new Response(text, { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
__name(onRequestPost2, "onRequestPost");

// api/delete-account.js
async function onRequestOptions3(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions3, "onRequestOptions");
async function onRequestPost3(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing session token. Please log in." }), {
      status: 401,
      headers: corsHeaders
    });
  }
  const token = authHeader.substring(7);
  const supabaseUrl = env.SUPABASE_URL || "https://nnatvvahoeiemkfmzpwp.supabase.co";
  const supabaseKey = env.SUPABASE_ANON_KEY || "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured." }), {
      status: 500,
      headers: corsHeaders
    });
  }
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${token}`
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
      return new Response(JSON.stringify({ error: "Unauthorized: User ID not found in session." }), {
        status: 401,
        headers: corsHeaders
      });
    }
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`
      }
    });
    if (!deleteRes.ok) {
      const deleteErrText = await deleteRes.text();
      return new Response(JSON.stringify({ error: `Failed to delete user account: ${deleteErrText}` }), {
        status: deleteRes.status,
        headers: corsHeaders
      });
    }
    return new Response(JSON.stringify({ success: true, message: "Account permanently deleted." }), {
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
__name(onRequestPost3, "onRequestPost");

// ../.wrangler/tmp/pages-4FwEYR/functionsRoutes-0.6319374918180356.mjs
var routes = [
  {
    routePath: "/api/ai",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/ai",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/coach",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/coach",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/delete-account",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/delete-account",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  }
];

// ../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
