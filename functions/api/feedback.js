import { validateRequest, corsHeadersFor } from './_security.js';

const RECIPIENT_EMAIL = 'budgetassistant2026@gmail.com';

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

  // Shared security validation: CORS origin, rate limit, body size
  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  try {
    const payload = await request.json();
    const { rating, type, comment, user_email, created_at, id } = payload || {};

    if (!rating) {
      return new Response(
        JSON.stringify({ error: 'Rating is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const recipient = env.FEEDBACK_RECIPIENT_EMAIL || RECIPIENT_EMAIL;
    const userSender = user_email && user_email !== 'guest' ? user_email : 'Ανώνυμος Χρήστης (Guest)';
    const stars = '⭐'.repeat(Math.min(Math.max(Number(rating) || 1, 1), 5));
    const formattedDate = created_at ? new Date(created_at).toLocaleString('el-GR') : new Date().toLocaleString('el-GR');

    const subject = `[Budget Assistant Feedback] ${stars} (${type || 'Γενικό'}) από ${userSender}`;

    let emailSent = false;
    let dispatchResult = null;

    // 1. Try Resend API if RESEND_API_KEY is set in environment
    if (env.RESEND_API_KEY) {
      try {
        const htmlContent = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #4f46e5;">📩 Νέο User Feedback - Budget Assistant</h2>
            <p><strong>Αξιολόγηση:</strong> ${stars} (${rating}/5)</p>
            <p><strong>Κατηγορία:</strong> ${type || 'Γενικό'}</p>
            <p><strong>Χρήστης:</strong> <a href="mailto:${user_email}">${userSender}</a></p>
            <p><strong>Ημερομηνία:</strong> ${formattedDate}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
            <p><strong>Σχόλιο:</strong></p>
            <blockquote style="background: #f1f5f9; padding: 12px; border-radius: 6px;">${comment || '(Χωρίς σχόλιο)'}</blockquote>
          </div>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL || 'Budget Assistant <onboarding@resend.dev>',
            to: [recipient],
            reply_to: user_email && user_email !== 'guest' ? user_email : undefined,
            subject,
            html: htmlContent,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
          dispatchResult = 'Resend';
        }
      } catch (err) {
        console.warn('Resend error:', err);
      }
    }

    // 2. Dispatch via FormSubmit API Relay
    if (!emailSent) {
      try {
        const formSubmitUrl = `https://formsubmit.co/ajax/${recipient}`;
        const fsRes = await fetch(formSubmitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://budget-assistant-pwa.pages.dev',
            'Referer': 'https://budget-assistant-pwa.pages.dev/',
          },
          body: JSON.stringify({
            _subject: subject,
            _replyto: user_email && user_email !== 'guest' ? user_email : recipient,
            _template: 'table',
            'Αξιολόγηση': `${stars} (${rating}/5)`,
            'Κατηγορία': type || 'Γενικό',
            'Χρήστης': userSender,
            'Ημερομηνία': formattedDate,
            'Σχόλιο': comment || '(Χωρίς σχόλιο)',
            'ID_Feedback': id || 'N/A',
          }),
        });

        const fsData = await fsRes.json().catch(() => ({}));
        if (fsRes.ok && (fsData.success === 'true' || fsData.success === true)) {
          emailSent = true;
          dispatchResult = 'FormSubmit';
        } else {
          dispatchResult = fsData.message || 'FormSubmit pending activation';
        }
      } catch (err) {
        console.warn('FormSubmit relay error:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: emailSent,
        provider: dispatchResult,
        recipient: recipient,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Error in feedback API:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${err.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}
