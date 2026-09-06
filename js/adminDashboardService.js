/**
 * Budget Assistant - Admin Dashboard Service Module
 * Platform usage, metrics, quota tracking, and owner overview
 * Extracted from app.js (Phase 14B Modularization)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

// ADMIN DASHBOARD (owner-only usage & user overview)
// Visible only to the app owner (marios.ko@hotmail.com) via the
// "Πίνακας Ελέγχου" row in the More tab. The server enforces the
// admin gate inside the DB RPC (admin_get_usage) — this UI only
// decides *visibility*, never *authorization*.
// ============================================================

function isAdminUser() {
  if (!state || !state.currentUser) return false;
  const email = String(state.currentUser.email || (state.currentUser.user_metadata && state.currentUser.user_metadata.email) || '').trim().toLowerCase();
  return email === 'marios.ko@hotmail.com';
}

async function openAdminDashboard() {
  // The server enforces the admin gate (admin_get_usage RPC). This UI only
  // decides whether the row is visible — authorization happens on the server.
  openModal('admin-dashboard-modal');
  await refreshAdminDashboard();
}

async function getValidSessionToken() {
  let token = null;

  // 1. Check in-memory session
  if (state.session && state.session.access_token) {
    token = state.session.access_token;
  }

  // 2. Query Supabase client getSession
  if (!token && state.supabaseClient?.auth?.getSession) {
    try {
      const sessRes = await state.supabaseClient.auth.getSession();
      if (sessRes?.data?.session?.access_token) {
        token = sessRes.data.session.access_token;
        state.session = sessRes.data.session;
      }
    } catch (_) {}
  }

  // 3. Direct localStorage scan for persisted Supabase tokens (Capacitor/WebView persistence)
  let rawStoredSession = null;
  if (!token) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token')) {
          const val = localStorage.getItem(k);
          if (val) {
            const parsed = JSON.parse(val);
            rawStoredSession = parsed.currentSession || parsed;
            if (rawStoredSession && rawStoredSession.access_token) {
              token = rawStoredSession.access_token;
              state.session = rawStoredSession;
              break;
            }
          }
        }
      }
    } catch (_) {}
  }

  // 4. If refresh token is available, attempt a session refresh / setSession to guarantee client is warm
  if (state.supabaseClient?.auth) {
    const refreshToken = state.session?.refresh_token || rawStoredSession?.refresh_token;
    if (refreshToken) {
      if (typeof state.supabaseClient.auth.refreshSession === 'function') {
        try {
          const refRes = await state.supabaseClient.auth.refreshSession({ refresh_token: refreshToken });
          if (refRes?.data?.session?.access_token) {
            token = refRes.data.session.access_token;
            state.session = refRes.data.session;
          }
        } catch (_) {}
      }
      if (!token && typeof state.supabaseClient.auth.setSession === 'function') {
        try {
          const setRes = await state.supabaseClient.auth.setSession({
            access_token: token || state.session?.access_token || '',
            refresh_token: refreshToken
          });
          if (setRes?.data?.session?.access_token) {
            token = setRes.data.session.access_token;
            state.session = setRes.data.session;
          }
        } catch (_) {}
      }
    }
  }

  return token;
}

async function refreshAdminDashboard() {
  const container = document.getElementById('admin-dashboard-content');
  if (!container) return;
  const lang = state.lang || 'el';
  container.innerHTML = `<div style="text-align:center; padding:24px 0; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:22px;"></i><div style="margin-top:10px;">${lang === 'el' ? 'Φόρτωση στοιχείων…' : 'Loading data…'}</div></div>`;

  let token = await getValidSessionToken();

  if (!token) {
    container.innerHTML = adminErrorBox(
      state.currentUser
        ? (lang === 'el' ? 'Η συνεδρία έληξε. Ανοίξτε την εφαρμογή ξανά ή συνδεθείτε εκ νέου.' : 'Your session expired. Reload the app or sign in again.')
        : (lang === 'el' ? 'Συνδεθείτε πρώτα για να δείτε τον πίνακα.' : 'Sign in first to view the dashboard.')
    );
    return;
  }

  try {
    let res = await fetch(getBackendApiUrl('/api/admin-usage'), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    // If 401 Unauthorized (token expired on server), attempt auto-refresh and retry
    if (res.status === 401 && state.supabaseClient?.auth?.refreshSession) {
      try {
        const refRes = await state.supabaseClient.auth.refreshSession();
        if (refRes?.data?.session?.access_token) {
          token = refRes.data.session.access_token;
          state.session = refRes.data.session;
          res = await fetch(getBackendApiUrl('/api/admin-usage'), {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
          });
        }
      } catch (_) {}
    }

    if (res.status === 403) {
      container.innerHTML = adminErrorBox(lang === 'el' ? '⛔ Δεν έχετε πρόσβαση (όχι διαχειριστής).' : '⛔ Access denied (not an administrator).');
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json || !json.ok || !json.data) {
      const msg = (json && json.error === 'ADMIN_RPC_MISSING')
        ? (lang === 'el' ? 'Το admin RPC δεν έχει εγκατασταθεί. Τρέξε το admin-dashboard-migration.sql στο Supabase SQL Editor.' : 'The admin RPC is not installed. Run admin-dashboard-migration.sql in the Supabase SQL Editor.')
        : ((json && json.details) ? (lang === 'el' ? `Σφάλμα RPC: ${json.details}` : `RPC Error: ${json.details}`) : (json && json.error) || 'Failed to load admin data.');
      container.innerHTML = adminErrorBox(msg);
      return;
    }
    renderAdminUsage(json.data, container);
  } catch (err) {
    console.error('Admin dashboard fetch error:', err);
    container.innerHTML = adminErrorBox(lang === 'el' ? 'Σφάλμα σύνδεσης με τον διακομιστή.' : 'Server connection error.');
  }
}

function adminErrorBox(msg) {
  return `<div style="text-align:center; padding:24px 0; color:var(--red-negative, #f43f5e); font-size:13.5px; line-height:1.5;">${msg}</div>`;
}

function adminBar(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const color = clamped >= 80 ? 'var(--red-negative, #f43f5e)' : (clamped >= 50 ? '#f59e0b' : '#22c55e');
  return `<div style="height:8px; border-radius:6px; background:var(--overlay-100, rgba(255,255,255,0.08)); overflow:hidden; margin-top:8px;"><div style="height:100%; width:${clamped}%; border-radius:6px; background:${color}; transition:width 0.3s ease;"></div></div>`;
}

function adminMeterCard(title, label, value, pct, subLabel, subValue, subPct) {
  const lang = state.lang || 'el';
  const mainColor = pct >= 80 ? 'var(--red-negative, #f43f5e)' : (pct >= 50 ? '#f59e0b' : '#22c55e');
  let sub = '';
  if (subLabel && subValue != null) {
    const subBar = (subPct != null) ? adminBar(subPct) : '';
    sub = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:12px; color:var(--text-secondary);"><span>${subLabel}</span><span style="font-weight:700; color:var(--text-primary);">${subValue}</span></div>${subBar}`;
  }
  const pctDisplay = pct < 1 && pct > 0 ? pct.toFixed(1) : Math.round(pct);
  const leftPct = (100 - pct).toFixed(pct < 1 && pct > 0 ? 1 : 0);
  return `<div style="background:var(--bg-card, #161622); border:1px solid var(--border); border-radius:16px; padding:14px 16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
      <div style="font-size:13.5px; color:var(--text-primary); font-weight:700;">${title}</div>
      <div style="font-size:12px; color:var(--text-secondary);">${label}: <b>${value}</b></div>
    </div>
    <div style="font-size:12.5px; color:${mainColor}; font-weight:800; margin-top:4px;">${pctDisplay}% ${lang === 'el' ? 'χρήσης' : 'used'} (${lang === 'el' ? 'μένει' : 'left'} ${leftPct}%)</div>
    ${adminBar(pct)}
    ${sub}
  </div>`;
}

function renderAdminUsage(data, container) {
  const lang = state.lang || 'el';
  const dbUsed = (data.db_size_bytes || 0) / (1024 * 1024);
  const dbLimit = (data.db_limit_bytes || 500 * 1024 * 1024) / (1024 * 1024);
  const dbPct = dbLimit > 0 ? (dbUsed / dbLimit) * 100 : 0;
  const users = Array.isArray(data.users) ? data.users : [];
  const premiumCount = data.premium_count || 0;
  const usersPct = ((data.users_count || 0) / (data.mau_limit || 50000)) * 100;

  // AI Chat total platform calls
  const aiChat = data.ai_chat_calls_month || 0;
  const aiChatPlatformLimit = data.ai_chat_platform_limit || 10000;
  const aiChatPct = aiChatPlatformLimit > 0 ? (aiChat / aiChatPlatformLimit) * 100 : 0;
  const aiChatUserLimit = data.ai_chat_user_limit || 50;

  // AI Scans total platform scans
  const aiScans = data.ai_scan_calls_month || 0;
  const aiScanPlatformLimit = data.ai_scan_platform_limit || 10000;
  const aiScanPct = aiScanPlatformLimit > 0 ? (aiScans / aiScanPlatformLimit) * 100 : 0;
  const aiScanUserLimit = data.ai_scan_user_limit || 100;

  const summary = `<div style="background:linear-gradient(135deg, rgba(99,102,241,0.14), rgba(79,70,229,0.05)); border:1px solid rgba(99,102,241,0.25); border-radius:16px; padding:14px 16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <div style="font-size:13px; color:var(--text-primary); font-weight:700;">${lang === 'el' ? 'Συνολική Σύνοψη Πλατφόρμας' : 'Global Platform Summary'}</div>
      <div style="font-size:12.5px; color:var(--text-secondary);">${lang === 'el' ? 'Χρήστες' : 'Users'}: <b>${data.users_count || 0}</b> &nbsp;•&nbsp; 👑 <b style="color:#fbbf24;">${premiumCount} PRO</b> &nbsp;•&nbsp; ${lang === 'el' ? 'Συναλλαγές' : 'Transactions'}: <b>${data.transactions_count || 0}</b></div>
    </div>
  </div>`;

  const supabaseCard = adminMeterCard(
    '🗄️ Supabase Cloud Storage',
    lang === 'el' ? 'Βάση' : 'DB',
    `${dbUsed.toFixed(1)} MB / ${dbLimit.toFixed(0)} MB`,
    dbPct,
    lang === 'el' ? 'Συνολικοί Χρήστες (MAU)' : 'Total Users (MAU)',
    `${data.users_count || 0} / ${(data.mau_limit || 50000).toLocaleString('en-US')}`,
    usersPct
  );

  const aiChatCard = adminMeterCard(
    '💬 Gemini AI Chat (Σύνολο Πλατφόρμας)',
    lang === 'el' ? 'Κλήσεις Μήνα' : 'Monthly Calls',
    `${aiChat.toLocaleString('en-US')} / ${aiChatPlatformLimit.toLocaleString('en-US')}`,
    aiChatPct,
    lang === 'el' ? 'Ατομικό όριο ανά PRO χρήστη' : 'Per-user quota',
    `${aiChatUserLimit} ${lang === 'el' ? 'κλήσεις/μήνα' : 'calls/mo'}`,
    null
  );

  const aiScanCard = adminMeterCard(
    '🧾 AI Receipts OCR (Σύνολο Πλατφόρμας)',
    lang === 'el' ? 'Σαρώσεις Μήνα' : 'Monthly Scans',
    `${aiScans.toLocaleString('en-US')} / ${aiScanPlatformLimit.toLocaleString('en-US')}`,
    aiScanPct,
    lang === 'el' ? 'Ατομικό όριο ανά PRO χρήστη' : 'Per-user quota',
    `${aiScanUserLimit} ${lang === 'el' ? 'σαρώσεις/μήνα' : 'scans/mo'}`,
    null
  );

  const userRows = users.length === 0
    ? `<div style="padding:10px 0; color:var(--text-muted); font-size:12.5px;">${lang === 'el' ? 'Δεν βρέθηκαν χρήστες.' : 'No users found.'}</div>`
    : users.map(u => {
      const isPro = !!u.premium_active;
      const name = u.display_name || u.email || '—';
      return `<div style="display:flex; align-items:center; gap:10px; padding:9px 2px; border-bottom:1px solid var(--overlay-060, rgba(255,255,255,0.05));">
          <div style="min-width:0; flex:1; overflow:hidden;">
            <div style="font-size:13px; color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); word-break:break-all;">${escapeHtml(u.email || '')}</div>
          </div>
          <span style="flex-shrink:0; font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:12px; ${isPro ? 'background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.35);' : 'background:rgba(255,255,255,0.07); color:var(--text-secondary); border:1px solid rgba(255,255,255,0.08);'}">${isPro ? '👑 PRO' : (lang === 'el' ? 'Δωρεάν' : 'Free')}</span>
        </div>`;
    }).join('');

  const usersCard = `<div style="background:var(--bg-card, #161622); border:1px solid var(--border); border-radius:16px; padding:14px 16px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <div style="font-size:13.5px; color:var(--text-primary); font-weight:700;">👥 ${lang === 'el' ? 'Χρήστες Εφαρμογής' : 'App Users'} (${users.length || data.users_count || 0})</div>
      <div style="font-size:12px; color:var(--text-secondary);">👑 <b style="color:#fbbf24;">${premiumCount}</b> PRO</div>
    </div>
    <div style="max-height:220px; overflow-y:auto;">${userRows}</div>
  </div>`;

  container.innerHTML = summary + supabaseCard + aiChatCard + aiScanCard + usersCard;
}

window.openAdminDashboard = openAdminDashboard;
window.refreshAdminDashboard = refreshAdminDashboard;
window.isAdminUser = isAdminUser;

  if (typeof window !== 'undefined') {
    window.openAdminDashboard = openAdminDashboard;
    window.refreshAdminDashboard = refreshAdminDashboard;
    window.isAdminUser = isAdminUser;
    window.getValidSessionToken = getValidSessionToken;
    window.adminErrorBox = adminErrorBox;
    window.adminBar = adminBar;
    window.adminMeterCard = adminMeterCard;
    window.renderAdminUsage = renderAdminUsage;
  }

  return {
    isAdminUser: isAdminUser,
    openAdminDashboard: openAdminDashboard,
    getValidSessionToken: getValidSessionToken,
    refreshAdminDashboard: refreshAdminDashboard,
    adminErrorBox: adminErrorBox,
    adminBar: adminBar,
    adminMeterCard: adminMeterCard,
    renderAdminUsage: renderAdminUsage
  };
}));
