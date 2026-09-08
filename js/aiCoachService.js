/**
 * js/aiCoachService.js
 *
 * AI Financial Coach Subsystem & Conversational Intelligence Engine.
 * Extracted from app.js (Phase 9B Architectural Domain Extraction).
 *
 * Provides persistent multi-turn ChatGPT-style advisor chat sessions,
 * offline heuristic intent/query engine (pacing, overspending, savings,
 * forecasts, milestones, category breakdowns, what-if simulations),
 * online Gemini AI streaming/response handling with learning loops,
 * and conversational in-chat quick transaction creation/editing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
    root.AICoachService = exports;
    if (typeof globalThis !== 'undefined') globalThis.AICoachService = exports;
    if (typeof window !== 'undefined') window.AICoachService = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

  function _getUserScopedKey(baseKey) {
    if (typeof getUserScopedKey === 'function') return getUserScopedKey(baseKey);
    if (typeof windowObj.getUserScopedKey === 'function') return windowObj.getUserScopedKey(baseKey);
    var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;
    var uid = (s && s.currentUser && s.currentUser.id) ? s.currentUser.id : 'anon';
    return baseKey + '_' + uid;
  }

  function _isTransferTransaction(t) {
    if (typeof isTransferTransaction === 'function') return isTransferTransaction(t);
    if (typeof windowObj.isTransferTransaction === 'function') return windowObj.isTransferTransaction(t);
    if (!t) return false;
    if (t.type === 'transfer') return true;
    const cat = t.category ? String(t.category).toLowerCase() : '';
    return cat.includes('μεταφ') || cat.includes('transfer');
  }

function openAdvisorChat(initialQuery = null) {
  const modalId = 'advisor-chat-modal';
  // Open the modal FIRST and unconditionally. Any error below must never prevent
  // the bottom sheet from appearing — otherwise the button appears "dead".
  try {
    openModal(modalId);
  } catch (e) {
    console.error('[AdvisorChat] openModal failed:', e);
    // Last-resort fallback: force the overlay visible even if openModal threw.
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  try {
    const activeId = getActiveAdvisorConversationId();
    const activeConv = activeId ? getActiveAdvisorConversation() : null;
    if (activeConv && !initialQuery) {
      openAdvisorConversation(activeId, false);
    } else {
      startNewAdvisorConversation();
    }
  } catch (e) {
    console.error('[AdvisorChat] conversation load failed:', e);
    try { startNewAdvisorConversation(); } catch (e2) { console.error(e2); }
  }

  setTimeout(() => {
    // Skip auto-focus when restoring from background — keyboard would cause flicker
    if (window._appJustResumed) return;
    const inp = document.getElementById('advisor-chat-input');
    if (inp) inp.focus();
  }, 300);

  if (initialQuery) {
    setTimeout(() => {
      submitCoachQuery(initialQuery);
    }, 500);
  }
}

function closeAdvisorChat() {
  closeModal('advisor-chat-modal');
}

// ===== Advisor Chat Conversation History (persistent, ChatGPT-style) =====
const ADVISOR_CONVERSATIONS_KEY = 'advisor_chat_conversations_v1';
const ADVISOR_ACTIVE_KEY = 'advisor_chat_active_id_v1';

function loadAdvisorConversations() {
  try {
    const key = _getUserScopedKey(ADVISOR_CONVERSATIONS_KEY);
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[AdvisorChat] Failed to load conversations:', e);
    return [];
  }
}

function saveAdvisorConversations(list) {
  try {
    const key = _getUserScopedKey(ADVISOR_CONVERSATIONS_KEY);
    localStorage.setItem(key, JSON.stringify(list || []));
  } catch (e) {
    console.warn('[AdvisorChat] Failed to save conversations:', e);
  }
}

function getActiveAdvisorConversationId() {
  try {
    const key = _getUserScopedKey(ADVISOR_ACTIVE_KEY);
    return localStorage.getItem(key) || null;
  } catch (e) {
    return null;
  }
}

function setActiveAdvisorConversationId(id) {
  try {
    const key = _getUserScopedKey(ADVISOR_ACTIVE_KEY);
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch (e) { }
}

function getActiveAdvisorConversation() {
  const id = getActiveAdvisorConversationId();
  if (!id) return null;
  const list = loadAdvisorConversations();
  return list.find(c => c.id === id) || null;
}

function getConversationTitle(messages) {
  const firstUser = (messages || []).find(m => m.sender === 'user');
  if (firstUser && firstUser.html) {
    const plain = firstUser.html.replace(/<[^>]*>/g, '').trim();
    if (plain) return plain.length > 40 ? plain.slice(0, 40) + '…' : plain;
  }
  return state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation';
}

function toggleAdvisorHistory() {
  const listEl = document.getElementById('advisor-conversation-list');
  const isListVisible = listEl && listEl.style.display === 'flex';
  if (isListVisible) {
    const activeId = getActiveAdvisorConversationId();
    if (activeId) {
      openAdvisorConversation(activeId, true);
    } else {
      startNewAdvisorConversation();
    }
  } else {
    showAdvisorConversationList();
  }
}
window.toggleAdvisorHistory = toggleAdvisorHistory;

function showAdvisorConversationList() {
  const listEl = document.getElementById('advisor-conversation-list');
  const chatLog = document.getElementById('advisor-chat-log');
  const backBtn = document.getElementById('advisor-chat-back-btn');
  const newBtn = document.getElementById('advisor-chat-new-btn');
  const historyBtn = document.getElementById('advisor-chat-history-btn');
  const suggestions = document.getElementById('advisor-chat-suggestions-container');
  const inputArea = document.getElementById('advisor-chat-input');

  if (listEl) listEl.style.display = 'flex';
  if (chatLog) chatLog.style.display = 'none';
  if (backBtn) backBtn.style.display = 'flex';
  if (newBtn) newBtn.style.display = 'flex';
  if (historyBtn) historyBtn.classList.add('active');
  if (suggestions) suggestions.style.display = 'none';
  if (inputArea) {
    inputArea.disabled = true;
    inputArea.placeholder = state.lang === 'el' ? 'Επιλέξτε συνομιλία...' : 'Select conversation...';
  }

  renderAdvisorConversationList();
}

function renderAdvisorConversationList() {
  const listEl = document.getElementById('advisor-conversation-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const list = loadAdvisorConversations();

  // New conversation button at top
  const newCard = document.createElement('div');
  newCard.style.cssText = 'display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:14px; background:var(--accent); color:#fff; font-weight:700; cursor:pointer; font-size:13.5px; transition:transform 0.15s;';
  newCard.innerHTML = `<i class="fa-solid fa-pen-to-square" style="font-size:14px;"></i> ${state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation'}`;
  newCard.onclick = () => startNewAdvisorConversation();
  listEl.appendChild(newCard);

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center; color:var(--text-secondary); font-size:13px; padding:24px 12px;';
    empty.textContent = state.lang === 'el'
      ? 'Δεν υπάρχουν ακόμα αποθηκευμένες συνομιλίες.'
      : 'No saved conversations yet.';
    listEl.appendChild(empty);
    return;
  }

  const sorted = [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  sorted.forEach(conv => {
    const card = document.createElement('div');
    card.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:14px; background:var(--bg-card); border:1px solid var(--border); cursor:pointer; transition:background 0.2s;';
    card.innerHTML = `
      <i class="fa-solid fa-comments" style="font-size:14px; color:var(--accent); flex-shrink:0;"></i>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:13.5px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(conv.title || '')}</div>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${formatConversationTime(conv.updatedAt)}</div>
      </div>
      <button type="button" class="icon-btn advisor-conv-delete" onclick="event.stopPropagation(); deleteAdvisorConversation('${conv.id}')" title="${state.lang === 'el' ? 'Διαγραφή' : 'Delete'}" style="background:transparent; border:none; cursor:pointer; font-size:13px; color:var(--text-muted); flex-shrink:0; padding:6px;">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;
    card.onclick = () => openAdvisorConversation(conv.id);
    listEl.appendChild(card);
  });
}

function formatConversationTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString(state.lang === 'el' ? 'el-GR' : 'en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

function openAdvisorConversation(id, focusInput = true) {
  const list = loadAdvisorConversations();
  const conv = list.find(c => c.id === id);
  if (!conv) {
    startNewAdvisorConversation();
    return;
  }

  setActiveAdvisorConversationId(id);

  const listEl = document.getElementById('advisor-conversation-list');
  const chatLog = document.getElementById('advisor-chat-log');
  const backBtn = document.getElementById('advisor-chat-back-btn');
  const newBtn = document.getElementById('advisor-chat-new-btn');
  const historyBtn = document.getElementById('advisor-chat-history-btn');
  const suggestions = document.getElementById('advisor-chat-suggestions-container');
  const inputArea = document.getElementById('advisor-chat-input');

  if (listEl) listEl.style.display = 'none';
  if (chatLog) {
    chatLog.style.display = 'flex';
    chatLog.innerHTML = '';
  }
  if (backBtn) backBtn.style.display = 'none';
  if (newBtn) newBtn.style.display = 'flex';
  if (historyBtn) historyBtn.classList.remove('active');
  if (suggestions) suggestions.style.display = 'block';
  if (inputArea) {
    inputArea.disabled = false;
    inputArea.placeholder = state.lang === 'el' ? 'Ρωτήστε για τα οικονομικά σας...' : 'Ask about your finances...';
  }

  // Restore messages
  (conv.messages || []).forEach(m => {
    appendChatMessage(m.sender, m.html, false);
  });

  // Restore context history
  if (Array.isArray(conv.geminiHistory)) {
    state.advisorChatHistory = conv.geminiHistory.slice();
  } else {
    state.advisorChatHistory = [];
  }

  if (focusInput) {
    setTimeout(() => {
      if (window._appJustResumed) return;
      const inp = document.getElementById('advisor-chat-input');
      if (inp) inp.focus();
    }, 300);
  }
}

function startNewAdvisorConversation() {
  const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  const conv = {
    id,
    title: state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    geminiHistory: []
  };
  const list = loadAdvisorConversations();
  list.push(conv);
  saveAdvisorConversations(list);
  setActiveAdvisorConversationId(id);

  // Clear the chat log and show welcome
  const chatLog = document.getElementById('advisor-chat-log');
  if (chatLog) chatLog.innerHTML = '';
  state.advisorChatHistory = [];

  const welcome = state.lang === 'el'
    ? "Γεια σου! Είμαι ο **Οικονομικός σου Βοηθός**.<br><br>Μπορώ να αναλύσω τις συναλλαγές σου, να εντοπίσω πού ξοδεύεις περισσότερα και να σου προτείνω τρόπους αποταμίευσης. Επίλεξε μία από τις προτάσεις παρακάτω ή ρώτησέ με ό,τι χρειάζεσαι!"
    : "Hello! I am your **Financial Assistant**.<br><br>I can analyze your transactions, identify your top expenses, and suggest ways to save. Pick a suggestion below or ask me anything!";
  appendChatMessage('advisor', welcome);

  // Switch view to chat
  const listEl = document.getElementById('advisor-conversation-list');
  const backBtn = document.getElementById('advisor-chat-back-btn');
  const newBtn = document.getElementById('advisor-chat-new-btn');
  const historyBtn = document.getElementById('advisor-chat-history-btn');
  const suggestions = document.getElementById('advisor-chat-suggestions-container');
  const inputArea = document.getElementById('advisor-chat-input');
  if (listEl) listEl.style.display = 'none';
  if (chatLog) chatLog.style.display = 'flex';
  if (backBtn) backBtn.style.display = 'none';
  if (newBtn) newBtn.style.display = 'flex';
  if (historyBtn) historyBtn.classList.remove('active');
  if (suggestions) suggestions.style.display = 'block';
  if (inputArea) {
    inputArea.disabled = false;
    inputArea.placeholder = state.lang === 'el' ? 'Ρωτήστε για τα οικονομικά σας...' : 'Ask about your finances...';
  }

  setTimeout(() => {
    if (window._appJustResumed) return;
    const inp = document.getElementById('advisor-chat-input');
    if (inp) inp.focus();
  }, 300);
}

function deleteAdvisorConversation(id) {
  const list = loadAdvisorConversations();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return;

  const conv = list[idx];
  const confirmMsg = state.lang === 'el'
    ? `Να διαγραφεί η συνομιλία «${conv.title || ''}»;`
    : `Delete conversation "${conv.title || ''}"?`;

  if (typeof window.confirm === 'function' && !window.confirm(confirmMsg)) return;

  list.splice(idx, 1);
  saveAdvisorConversations(list);

  // If the deleted conversation was active, clear active state
  if (getActiveAdvisorConversationId() === id) {
    setActiveAdvisorConversationId(null);
    state.advisorChatHistory = [];
  }

  renderAdvisorConversationList();

  // Διαγραφή και από το cloud backup
  if (state.supabaseClient && state.currentUser) {
    state.supabaseClient
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', state.currentUser.id)
      .then(res => {
        if (res && res.error) console.warn('[AdvisorSync] error deleting remote conversation:', res.error);
      }, err => console.warn('[AdvisorSync] delete remote conversation failed:', err));
  }
}

function persistAdvisorMessage(sender, htmlContent) {
  const id = getActiveAdvisorConversationId();
  if (!id) return;
  const list = loadAdvisorConversations();
  const conv = list.find(c => c.id === id);
  if (!conv) return;

  if (!Array.isArray(conv.messages)) conv.messages = [];
  conv.messages.push({ sender, html: htmlContent });
  conv.updatedAt = Date.now();
  // Set the title from the first user message (welcome message may come first)
  if (sender === 'user' && (!conv.title || conv.title === (state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation'))) {
    conv.title = getConversationTitle(conv.messages);
  }
  saveAdvisorConversations(list);
  scheduleAdvisorConversationSync();
}

function persistAdvisorGeminiHistory(history) {
  const id = getActiveAdvisorConversationId();
  if (!id) return;
  const list = loadAdvisorConversations();
  const conv = list.find(c => c.id === id);
  if (!conv) return;
  conv.geminiHistory = Array.isArray(history) ? history.slice() : [];
  conv.updatedAt = Date.now();
  saveAdvisorConversations(list);
  scheduleAdvisorConversationSync();
}

function updateAdvisorMessageSavedState(btnId) {
  try {
    const convId = getActiveAdvisorConversationId();
    if (!convId) return;
    const list = loadAdvisorConversations();
    const conv = list.find(c => c.id === convId);
    if (!conv || !Array.isArray(conv.messages)) return;

    let modified = false;
    const savedText = (state.lang === 'el') ? '✅ Καταχωρήθηκε!' : '✅ Saved!';
    const replacementBtn = `<button id="${btnId}" class="btn btn-success" disabled style="width:100%; padding: 12px; font-weight: 700; border-radius: 8px; background-color: var(--success); color: white; border: none; cursor: default; opacity: 0.9;">${savedText}</button>`;

    conv.messages.forEach(msg => {
      if (typeof msg.content === 'string' && msg.content.includes(btnId)) {
        msg.content = msg.content.replace(
          new RegExp(`<button[^>]*id=["']${btnId}["'][^>]*>[\\s\\S]*?<\\/button>`, 'i'),
          replacementBtn
        );
        modified = true;
      }
    });

    if (modified) {
      conv.updatedAt = Date.now();
      saveAdvisorConversations(list);
      scheduleAdvisorConversationSync();
    }
  } catch (err) {
    console.warn('[AdvisorChat] Failed to update message saved state:', err);
  }
}

// ============================================================
// AI Σύμβουλος — Cloud Sync (backup των συνομιλιών στο Supabase)
// ============================================================
// Οι συνομιλίες αποθηκεύονται τοπικά στο localStorage με κλειδί
// 'advisor_chat_conversations_v1'. Για να μην χάνονται όταν εκκαθαρίζεται
// το τοπικό storage (εκκαθάριση WebView, επανεγκατάσταση κ.λπ.),
// συγχρονίζονται και στον πίνακα public.ai_conversations (βλ.
// ai-conversations-migration.sql), με λογική merge-by-updatedAt,
// ακριβώς όπως οι σημειώσεις (syncNotes).
// ============================================================
let _advisorSyncTimer = null;

function scheduleAdvisorConversationSync() {
  if (_advisorSyncTimer) clearTimeout(_advisorSyncTimer);
  _advisorSyncTimer = setTimeout(() => { syncAdvisorConversations(); }, 800);
}

async function syncAdvisorConversations() {
  if (!state.supabaseClient || !state.currentUser) return;
  const userId = state.currentUser.id;

  try {
    const { data: remoteConvs, error } = await state.supabaseClient
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 404) {
        console.log('[AdvisorSync] ai_conversations table not found in database. Skipping cloud sync.');
        return;
      }
      console.warn('[AdvisorSync] error fetching remote conversations:', error);
      return;
    }

    const localList = loadAdvisorConversations();
    if (!Array.isArray(localList)) return;

    const remoteMap = new Map();
    (remoteConvs || []).forEach(rc => remoteMap.set(rc.id, rc));

    const mergedList = [];
    const convsToUpsert = [];

    localList.forEach(localConv => {
      const remoteConv = remoteMap.get(localConv.id);
      if (remoteConv) {
        const localDate = new Date(localConv.updatedAt || localConv.createdAt || 0);
        const remoteDate = new Date(remoteConv.updated_at || remoteConv.created_at || 0);
        if (localDate > remoteDate) {
          mergedList.push(localConv);
          convsToUpsert.push(localConv);
        } else {
          // Το cloud αντίγραφο είναι νεότερο — το υιοθετούμε τοπικά
          mergedList.push({
            id: remoteConv.id,
            title: remoteConv.title || (state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation'),
            createdAt: remoteConv.created_at ? new Date(remoteConv.created_at).getTime() : Date.now(),
            updatedAt: remoteConv.updated_at ? new Date(remoteConv.updated_at).getTime() : Date.now(),
            messages: Array.isArray(remoteConv.messages) ? remoteConv.messages : [],
            geminiHistory: Array.isArray(remoteConv.gemini_history) ? remoteConv.gemini_history : []
          });
        }
        remoteMap.delete(localConv.id);
      } else {
        mergedList.push(localConv);
        convsToUpsert.push(localConv);
      }
    });

    // Όσες υπάρχουν μόνο στο cloud, τις προσθέτουμε τοπικά
    remoteMap.forEach(rc => {
      mergedList.push({
        id: rc.id,
        title: rc.title || (state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation'),
        createdAt: rc.created_at ? new Date(rc.created_at).getTime() : Date.now(),
        updatedAt: rc.updated_at ? new Date(rc.updated_at).getTime() : Date.now(),
        messages: Array.isArray(rc.messages) ? rc.messages : [],
        geminiHistory: Array.isArray(rc.gemini_history) ? rc.gemini_history : []
      });
    });

    // Ταξινόμηση κατά updatedAt (νεότερα πρώτα) και αποθήκευση τοπικά
    mergedList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    saveAdvisorConversations(mergedList);

    // Push τοπικών αλλαγών στο cloud
    if (convsToUpsert.length > 0) {
      const records = convsToUpsert.map(c => ({
        id: c.id,
        title: c.title || (state.lang === 'el' ? 'Νέα συνομιλία' : 'New conversation'),
        messages: Array.isArray(c.messages) ? c.messages : [],
        gemini_history: Array.isArray(c.geminiHistory) ? c.geminiHistory : [],
        user_id: userId,
        created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString()
      }));

      const { error: upsertError } = await state.supabaseClient
        .from('ai_conversations')
        .upsert(records);

      if (upsertError) {
        console.warn('[AdvisorSync] error pushing local conversations to remote:', upsertError);
      }
    }
  } catch (err) {
    console.warn('[AdvisorSync] unhandled exception during conversations sync:', err);
  }
}
window.syncAdvisorConversations = syncAdvisorConversations;

function appendChatMessage(sender, htmlContent, persist = true) {
  const chatLog = document.getElementById('advisor-chat-log');
  if (!chatLog) return;

  const row = document.createElement('div');
  row.className = `chat-msg-row ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  if (sender === 'user') {
    bubble.textContent = htmlContent;
  } else {
    bubble.innerHTML = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  row.appendChild(bubble);
  chatLog.appendChild(row);

  chatLog.scrollTop = chatLog.scrollHeight;

  if (persist) {
    persistAdvisorMessage(sender, htmlContent);
  }
}

function coachFilterCategory(catName) {
  closeModal('advisor-chat-modal');
  setTimeout(() => {
    if (catName) {
      const catFilter = document.getElementById('search-filter-category');
      if (catFilter) {
        catFilter.value = catName;
        if (typeof handleSearchChange === 'function') handleSearchChange();
      }
    }
    if (typeof switchTab === 'function') switchTab('trans');
  }, 120);
}
window.coachFilterCategory = coachFilterCategory;

function coachOpenBudgets(catName) {
  closeModal('advisor-chat-modal');
  setTimeout(() => {
    if (typeof openCategoryBudgetModal === 'function') {
      openCategoryBudgetModal(catName || null);
    }
  }, 120);
}
window.coachOpenBudgets = coachOpenBudgets;

function coachOpenReports() {
  closeModal('advisor-chat-modal');
  setTimeout(() => {
    if (typeof switchTab === 'function') switchTab('stats');
  }, 120);
}
window.coachOpenReports = coachOpenReports;

function coachOpenRecurring() {
  closeModal('advisor-chat-modal');
  setTimeout(() => {
    if (typeof openRecurringTransactionsModal === 'function') {
      openRecurringTransactionsModal();
    }
  }, 120);
}
window.coachOpenRecurring = coachOpenRecurring;

function handleAdvisorChatInput(el) {
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.min(el.scrollHeight, 130);
  el.style.height = (newHeight > 44 ? newHeight : 44) + 'px';
}

function submitCoachInput() {
  const inp = document.getElementById('advisor-chat-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  inp.value = '';
  inp.style.height = '44px';
  submitCoachQuery(val);
}

function handleAdvisorChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitCoachInput();
  }
}

function submitCoachQuery(queryText) {
  let userDisplay = queryText;
  let actualQuery = queryText;
  if (queryText === 'overspending') {
    userDisplay = state.lang === 'el' ? "Πού ξοδεύω υπερβολικά;" : "Where am I overspending?";
    actualQuery = userDisplay;
  } else if (queryText === 'savings') {
    userDisplay = state.lang === 'el' ? "Πώς μπορώ να αποταμιεύσω περισσότερο;" : "How can I save more?";
    actualQuery = userDisplay;
  } else if (queryText === 'forecast_5y') {
    userDisplay = state.lang === 'el' ? "Αν συνεχίσω έτσι, πού θα είμαι σε 5 χρόνια;" : "If I continue like this, where will I be in 5 years?";
    actualQuery = userDisplay;
  } else if (queryText === 'milestone_50k' || queryText === 'milestone_50000') {
    userDisplay = state.lang === 'el' ? "Πότε θα φτάσω τα 50.000€;" : "When will I reach €50,000?";
    actualQuery = userDisplay;
  } else if (queryText.startsWith('milestone_')) {
    let amtStr = queryText.replace('milestone_', '');
    let num = amtStr.endsWith('k') ? (parseFloat(amtStr) * 1000) : (parseInt(amtStr, 10) || 50000);
    userDisplay = state.lang === 'el' ? `Πότε θα φτάσω τα ${formatCurrency(num)};` : `When will I reach ${formatCurrency(num)}?`;
    actualQuery = userDisplay;
  }

  // Ensure an active conversation exists (e.g. when a suggestion chip is tapped from the list view)
  if (!getActiveAdvisorConversationId()) {
    startNewAdvisorConversation();
  }

  appendChatMessage('user', userDisplay);

  const suggestions = document.getElementById('advisor-chat-suggestions-container');
  if (suggestions) suggestions.style.display = 'none';

  const chatLog = document.getElementById('advisor-chat-log');
  const typingIndicatorRow = document.createElement('div');
  typingIndicatorRow.className = 'chat-msg-row advisor typing-temp';
  typingIndicatorRow.innerHTML = `
    <div class="chat-msg-bubble">
      <div class="chat-typing-indicator">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
    </div>
  `;
  if (chatLog) {
    chatLog.appendChild(typingIndicatorRow);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // Execute immediately without artificial delays
  (async () => {
    // 1. Check if we should use Online AI (Gemini)
    const norm = normalizeGreekString(actualQuery);
    const isLocalReport = norm.includes('προϋπολογισμ') || norm.includes('οριο') || norm.includes('ορια') || norm.includes('που ξοδευω τα περισσοτερα') || norm.includes('που ξοδευω τα') || norm.includes('που πανε τα λεφτα') || norm.includes('μεγαλυτερα εξοδα') || norm.includes('top spending');

    // Premium gate: only ONLINE advisor calls count toward the fair-use limit.
    // If the user is at their limit, skip the online call and fall through to
    // the free offline NLP fallback below (never leave the user without an answer).
    const aiAllowed = (!isLocalReport && window.OnlineAIProvider)
      ? await canUseOnlineAI()
      : false;

    if (aiAllowed) {
      try {
        const pacing = getCoachAveragePacing();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // Calculate this month's stats
        const thisMonthTrans = (state.transactions || []).filter(t => {
          if (!t.date || _isTransferTransaction(t)) return false;
          const datePart = String(t.date).split('T')[0];
          const parts = datePart.split('-');
          if (parts.length !== 3) return false;
          return parseInt(parts[0], 10) === currentYear && (parseInt(parts[1], 10) - 1) === currentMonth;
        });

        let thisMonthIncome = 0;
        let thisMonthExpense = 0;
        thisMonthTrans.forEach(t => {
          const amt = CurrencyService.toBase(t);
          if (t.type === 'income') thisMonthIncome += amt;
          if (t.type === 'expense') thisMonthExpense += amt;
        });

        // Map simplified allTransactions to save tokens.
        // IMPORTANT: The online AI endpoint enforces a 64 KB request-body limit
        // (see functions/api/_security.js validateRequest). Sending the ENTIRE
        // transaction history can exceed that limit and cause a 413
        // "Request body too large" error, forcing a fallback to the local system.
        // To stay within the limit we (a) cap the number of raw transactions sent
        // to the most recent MAX_AI_TX (enough for specific lookups / edits),
        // (b) truncate long note fields, and (c) as a final safety net, trim the
        // array until the serialized stats payload fits under the server limit.
        //
        // CRITICAL: Because raw transactions are capped, the AI could NOT answer
        // "all-time" questions (e.g. "how much did I spend on groceries overall?")
        // from the raw list alone. To preserve full-history coverage we ALSO send
        // pre-aggregated summaries computed over the ENTIRE history (all months,
        // all categories, all years) in a tiny payload. The AI uses these
        // aggregates for any question spanning more than the recent window.
        const MAX_AI_TX = 400;
        const MAX_AI_NOTE_LEN = 60;
        const AI_BODY_BUDGET = 40 * 1024; // 40 KB headroom (server allows 64 KB)

        const rawTxs = (state.transactions || []).slice();
        // Newest first so the most relevant/recent history is preserved when we cap.
        rawTxs.sort((a, b) => {
          const da = String(a.date || '').split('T')[0].split(' ')[0];
          const db = String(b.date || '').split('T')[0].split(' ')[0];
          return db.localeCompare(da);
        });

        let allTransactions = rawTxs.slice(0, MAX_AI_TX).map(t => {
          const note = (t.note || t.description || '').trim();
          return {
            id: t.id,
            date: String(t.date || '').split('T')[0].split(' ')[0],
            type: t.type,
            amount: CurrencyService.toBase(t),
            category: t.category || '',
            subcategory: t.subcategory || '',
            note: note.length > MAX_AI_NOTE_LEN ? note.slice(0, MAX_AI_NOTE_LEN) : note
          };
        });

        // Map simplified accounts
        const accounts = (state.accounts || []).map(a => ({
          name: a.name || '',
          type: a.type || '',
          balance: parseFloat(a.balance) || 0
        }));

        const today = new Date();
        const currentDate = today.toISOString().split('T')[0];

        // ---- Full-history aggregates (computed over ALL transactions) ----
        // These let the AI answer "all-time" / "this year" / "per category"
        // questions accurately even though raw transactions are capped.
        const allRawTxs = state.transactions || [];
        const monthAgg = {};   // key: "YYYY-MM" -> { income, expense }
        const catAgg = {};     // key: category -> { income, expense }
        const yearAgg = {};    // key: "YYYY" -> { income, expense }
        const subcatAgg = {};  // key: "category|subcategory" -> { expense }

        allRawTxs.forEach(t => {
          if (!t.date || _isTransferTransaction(t)) return;
          const datePart = String(t.date).split('T')[0].split(' ')[0];
          const parts = datePart.split('-');
          if (parts.length !== 3) return;
          const year = parts[0];
          const monthKey = `${year}-${parts[1]}`;
          const amt = CurrencyService.toBase(t);
          const isIncome = t.type === 'income';
          const isExpense = t.type === 'expense';
          if (!isIncome && !isExpense) return;

          if (!monthAgg[monthKey]) monthAgg[monthKey] = { income: 0, expense: 0 };
          if (!yearAgg[year]) yearAgg[year] = { income: 0, expense: 0 };
          if (isIncome) {
            monthAgg[monthKey].income += amt;
            yearAgg[year].income += amt;
          } else {
            monthAgg[monthKey].expense += amt;
            yearAgg[year].expense += amt;
          }

          const cat = t.category || '';
          if (cat) {
            if (!catAgg[cat]) catAgg[cat] = { income: 0, expense: 0 };
            if (isIncome) catAgg[cat].income += amt;
            else catAgg[cat].expense += amt;
          }
          const subcat = t.subcategory || '';
          if (cat && subcat) {
            const key = `${cat}|${subcat}`;
            if (!subcatAgg[key]) subcatAgg[key] = { expense: 0 };
            if (isExpense) subcatAgg[key].expense += amt;
          }
        });

        const currentYearStr = String(currentYear);
        const ytdIncome = yearAgg[currentYearStr]?.income || 0;
        const ytdExpense = yearAgg[currentYearStr]?.expense || 0;
        const ytdNetBalance = ytdIncome - ytdExpense;

        const currentSafeToSpend = (typeof SafeToSpendEngine !== 'undefined')
          ? SafeToSpendEngine.calculateDailySafeToSpend({
              currentBalance: getLiquidBalance(),
              unpaidRecurringBills: getUnpaidRecurringBillsThisMonth(),
              savingsGoal: getMonthlySavingsGoal()
            })
          : null;

        const stats = {
          lang: state.lang,
          currentDate,
          thisMonthIncome,
          thisMonthExpense,
          currentBalance: pacing.totalBalance || 0,
          safeToSpend: currentSafeToSpend,
          averageMonthlyIncome: pacing.avgIncome || 0,
          averageMonthlyExpense: pacing.avgExpense || 0,
          averageMonthlyNetSavings: (pacing.avgIncome || 0) - (pacing.avgExpense || 0),
          ytdCurrentYearIncome: ytdIncome,
          ytdCurrentYearExpense: ytdExpense,
          ytdCurrentYearNetBalance: ytdNetBalance,
          budgets: state.budgets || {},
          accounts,
          allTransactions,
          // Full-history aggregates (entire history, not capped):
          monthlyTotals: monthAgg,
          yearlyTotals: yearAgg,
          categoryTotals: catAgg,
          subcategoryTotals: subcatAgg
        };

        // Final safety net: if the serialized stats payload is still too large
        // (e.g. an enormous budgets object or very long history), trim the
        // transaction array until it fits under the budget. This guarantees the
        // request never trips the server's 64 KB body guard. The full-history
        // aggregates above are tiny and are NOT trimmed, so all-time questions
        // remain answerable even after raw transactions are reduced.
        while (allTransactions.length > 0 && JSON.stringify(stats).length > AI_BODY_BUDGET) {
          allTransactions = allTransactions.slice(0, Math.floor(allTransactions.length / 2));
          stats.allTransactions = allTransactions;
        }

        if (!state.advisorChatHistory) {
          state.advisorChatHistory = [];
        }
        // Defensive cap on the conversation history sent to the online AI so the
        // request body stays well under the server's 64 KB limit even if a large
        // history was loaded from a persisted conversation.
        const advisorHistory = state.advisorChatHistory.slice(-12);
        const data = await window.OnlineAIProvider.processAdvisorQuery(actualQuery, stats, advisorHistory);

        // Remove typing indicator AFTER fetch completes
        const temp = document.querySelector('.typing-temp');
        if (temp) temp.remove();

        if (data && data.error) {
          console.warn('[AIEngine] Online Advisor returned error:', data.error);
          if (data.error.includes('GEMINI_API_KEY')) {
            const msg = state.lang === 'el'
              ? `⚠️ **Ο Οικονομικός Σύμβουλος AI δεν έχει ρυθμιστεί ακόμα.**<br><br>Παρακαλώ επικοινωνήστε με τον διαχειριστή για την ενεργοποίηση της online υπηρεσίας.`
              : `⚠️ **AI Financial Advisor is not configured yet.**<br><br>Please contact the administrator to activate the online service.`;
            appendChatMessage('advisor', msg);
            if (suggestions) suggestions.style.display = 'block';
            return;
          } else {
            // Tell the user the AI failed instead of silently falling back
            const lang = state.lang || 'el';
            const msg = lang === 'el'
              ? `⚠️ **Ο Online AI Σύμβουλος αντιμετώπισε πρόβλημα:**<br><br> ${data.error}<br><br><em>(Προσωρινή χρήση τοπικού συστήματος...)</em>`
              : `⚠️ **Online AI Advisor encountered an issue:**<br><br> ${data.error}<br><br><em>(Falling back to local system...)</em>`;
            appendChatMessage('advisor', msg);
            // DO NOT return here, so it falls through to offline fallback but with the warning visible!
          }
        }

        if (data && data.responseHtml) {
          appendChatMessage('advisor', data.responseHtml);

          // Append to history
          state.advisorChatHistory.push({ role: 'user', content: actualQuery });
          state.advisorChatHistory.push({ role: 'model', content: data.responseHtml });
          if (state.advisorChatHistory.length > 12) {
            state.advisorChatHistory = state.advisorChatHistory.slice(-12);
          }
          // Persist Gemini context to the active conversation
          persistAdvisorGeminiHistory(state.advisorChatHistory);
          const isExplicitAddIntent = data.classifiedIntent === 'add_transaction' || (function () {
            const nq = normalizeGreekString(actualQuery);
            const hasExpenseVerb = nq.includes('βαλε') || nq.includes('προσθεσε') || nq.includes('καταχωρησε') || nq.includes('χρεωσε') || nq.includes('πληρωσα') || nq.includes('ξοδεψα') || nq.includes('εδωσα') || nq.includes('χαλασα') || nq.startsWith('add ') || nq.includes('spent ') || nq.includes('paid ');
            const hasIncomeVerb = nq.includes('πηρα') || nq.includes('μπηκε') || nq.includes('μισθος') || nq.includes('εισπραξη') || nq.includes('επιστροφη') || nq.includes('κερδισα') || nq.includes('εσοδο') || nq.includes('καταθεση') || nq.includes('received') || nq.includes('earned') || nq.includes('salary');
            const hasAddVerb = hasExpenseVerb || hasIncomeVerb;
            const isQuestion = nq.includes('ποτε') || nq.includes('ποσα') || nq.includes('ποσο') || nq.includes('θα φτασω') || nq.includes('θα εχω') || nq.includes('when') || nq.includes('how much');
            return hasAddVerb && !isQuestion;
          })();

          if (isExplicitAddIntent && data.transactionsToAdd && Array.isArray(data.transactionsToAdd)) {
            data.transactionsToAdd.forEach(tx => {
              if (tx.amount && tx.amount > 0) {
                const txType = tx.type || ((function () {
                  const nq = normalizeGreekString(actualQuery);
                  return (nq.includes('πηρα') || nq.includes('μπηκε') || nq.includes('μισθος') || nq.includes('εισπραξη') || nq.includes('επιστροφη') || nq.includes('κερδισα') || nq.includes('εσοδο')) ? 'income' : 'expense';
                })());
                const txHtml = runCoachTransactionEntry(tx.amount, tx.note || '', txType, tx.category, tx.subcategory, tx.account_from, tx.date);
                appendChatMessage('advisor', txHtml);
              }
            });
          }

          if (data.transactionsToUpdate && Array.isArray(data.transactionsToUpdate)) {
            data.transactionsToUpdate.forEach(tx => {
              if (tx.id) {
                const existing = state.transactions.find(t => t.id === tx.id) || {};
                const amountVal = tx.amount !== undefined ? tx.amount : (existing.amount || 0);
                const noteVal = tx.note !== undefined ? tx.note : (existing.note || '');
                const typeVal = tx.type || existing.type || 'expense';
                const catVal = tx.category || existing.category || null;
                const subcatVal = tx.subcategory || existing.subcategory || null;
                const accVal = tx.account_from || existing.account_from || null;
                const dateVal = tx.date || existing.date || null;

                const txHtml = runCoachTransactionEntry(
                  amountVal,
                  noteVal,
                  typeVal,
                  catVal,
                  subcatVal,
                  accVal,
                  dateVal,
                  tx.id
                );
                appendChatMessage('advisor', txHtml);
              }
            });
          }

          if (data.transactionsToDelete && Array.isArray(data.transactionsToDelete)) {
            data.transactionsToDelete.forEach(id => {
              const existing = state.transactions.find(t => t.id === id);
              if (existing) {
                deleteTransaction(id);
                const msg = state.lang === 'el'
                  ? `🗑️ Η συναλλαγή **"${existing.note}" (${existing.amount}€)** διαγράφηκε επιτυχώς!`
                  : `🗑️ Transaction **"${existing.note}" (${existing.amount}€)** deleted successfully!`;
                appendChatMessage('advisor', msg);
              }
            });
          }

          // ONLINE-TO-OFFLINE LEARNING LOOP
          if (data.classifiedIntent && data.classifiedIntent !== 'unknown' && data.alternativePhrasings && Array.isArray(data.alternativePhrasings)) {
            if (window.IntentCorpus && window.IntentCorpus.learnFromGemini) {
              const count = window.IntentCorpus.learnFromGemini(data.classifiedIntent, data.alternativePhrasings);
            }
          }
          if (data.extractedEntities && Array.isArray(data.extractedEntities)) {
            if (window.KnowledgeGraph && window.KnowledgeGraph.learnFromGeminiEntities) {
              const res = window.KnowledgeGraph.learnFromGeminiEntities(data.extractedEntities);
            }
          }

          if (suggestions) suggestions.style.display = 'block';
          return;
        }
      } catch (err) {
        console.warn('[AIEngine] Online Advisor failed. Falling back to offline engine:', err);
      }
    }

    // Remove typing indicator for offline fallback
    const temp = document.querySelector('.typing-temp');
    if (temp) temp.remove();

    // 2. Offline Fallback
    const responseHtml = processCoachQuery(actualQuery);
    appendChatMessage('advisor', responseHtml);

    if (suggestions) suggestions.style.display = 'block';
  })();
}

function getCoachAveragePacing() {
  const trans = state.transactions || [];
  const monthlyData = {};

  trans.forEach(t => {
    if (!t.date || _isTransferTransaction(t)) return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const amt = CurrencyService.toBase(t);

    if (!monthlyData[key]) {
      monthlyData[key] = { income: 0, expense: 0 };
    }
    if (t.type === 'income') monthlyData[key].income += amt;
    if (t.type === 'expense') monthlyData[key].expense += amt;
  });

  const keys = Object.keys(monthlyData).sort();
  if (keys.length === 0) {
    return { avgIncome: 0, avgExpense: 0, avgSavings: 0, totalBalance: 0 };
  }

  const lastKeys = keys.slice(-3);
  let sumIncome = 0;
  let sumExpense = 0;
  lastKeys.forEach(k => {
    sumIncome += monthlyData[k].income;
    sumExpense += monthlyData[k].expense;
  });

  const monthsCount = lastKeys.length;
  const avgIncome = sumIncome / monthsCount;
  const avgExpense = sumExpense / monthsCount;
  const avgSavings = avgIncome - avgExpense;

  const totalBalance = (state.accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);

  return { avgIncome, avgExpense, avgSavings, totalBalance };
}

function runCoachOverspendingAnalysis() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();

  const currMonthExpenses = {};
  const prevExpenses = {};
  const monthsSeen = new Set();

  const trans = state.transactions || [];
  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = CurrencyService.toBase(t);
    const cat = t.category || 'Other';

    if (y === currYear && m === currMonth) {
      currMonthExpenses[cat] = (currMonthExpenses[cat] || 0) + amt;
    } else {
      const diffMonths = (currYear - y) * 12 + (currMonth - m);
      if (diffMonths > 0 && diffMonths <= 3) {
        monthsSeen.add(`${y}-${m}`);
        if (!prevExpenses[cat]) prevExpenses[cat] = {};
        const monthKey = `${y}-${m}`;
        prevExpenses[cat][monthKey] = (prevExpenses[cat][monthKey] || 0) + amt;
      }
    }
  });

  const numPrevMonths = Math.max(1, monthsSeen.size);
  const overspentCats = [];

  Object.keys(currMonthExpenses).forEach(cat => {
    const currAmt = currMonthExpenses[cat] || 0;
    let sumPrev = 0;
    if (prevExpenses[cat]) {
      Object.keys(prevExpenses[cat]).forEach(mk => {
        sumPrev += prevExpenses[cat][mk];
      });
    }
    const avgPrev = sumPrev / numPrevMonths;
    const diff = currAmt - avgPrev;

    if (diff > 0) {
      const pct = avgPrev > 0 ? Math.round((diff / avgPrev) * 100) : 100;
      overspentCats.push({ cat, currAmt, avgPrev, diff, pct });
    }
  });

  overspentCats.sort((a, b) => b.diff - a.diff);

  if (overspentCats.length === 0) {
    return state.lang === 'el'
      ? "✅ **Όλα υπό έλεγχο!** Δεν εντοπίστηκε υπέρβαση εξόδων σε καμία κατηγορία αυτόν τον μήνα σε σχέση με τους προηγούμενους. Συνέχισε την εξαιρετική δουλειά! 👏"
      : "✅ **All under control!** No overspending was detected in any category this month compared to previous months. Keep up the great work! 👏";
  }

  let html = state.lang === 'el'
    ? "⚠️ **Εντοπίστηκε υπέρβαση εξόδων στις εξής κατηγορίες:**<br><br>"
    : "⚠️ **Overspending detected in the following categories:**<br><br>";

  overspentCats.slice(0, 3).forEach(item => {
    const dispCat = getCategoryDisplayName(item.cat);
    const pctStr = item.avgPrev > 0 ? ` (+${item.pct}%)` : ' (νέο έξοδο)';
    html += `• **${dispCat}**: Ξόδεψες **${formatCurrency(item.currAmt)}** αυτόν τον μήνα, ενώ ο προηγούμενος μέσος όρος σου ήταν **${formatCurrency(item.avgPrev)}**.<br>&nbsp;&nbsp;&nbsp;&nbsp;📈 Αύξηση: **+${formatCurrency(item.diff)}**${pctStr}.<br>`;
  });

  html += state.lang === 'el'
    ? "<br>💡 *Συμβουλή: Πατήστε στο κουμπί 'Συζήτησέ το' δίπλα από την κατηγορία στην κάρτα του συμβούλου για να δεις ποιες συναλλαγές προκάλεσαν την αύξηση.*"
    : "<br>💡 *Tip: Tap the 'Discuss it' button next to the category in the advisor card to see which transactions caused the increase.*";

  return html;
}

function runCoachSavingsAdvice() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();

  const nonEssentials = ['SUPERMARKET', 'MARKET', 'FOOD', 'ΔΙΑΤΡΟΦΗ', 'ΔΙΑΣΚΕΔΑΣΗ', 'ΕΞΟΔΟΙ', 'ENTERTAINMENT', 'LEISURE', 'SHOPPING', 'CLOTHES', 'ΠΡΟΣΩΠΙΚΗ', 'ΦΡΟΝΤΙΔΑ', 'PERSONAL', 'ΤΕΧΝΟΛΟΓΙΑ', 'TECH', 'GADGET', 'ΣΥΝΔΡΟΜΕΣ', 'SUBSCRIPTION'];

  const trans = state.transactions || [];
  const catTotals = {};

  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = CurrencyService.toBase(t);

    if (y === currYear && m === currMonth) {
      const cat = t.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  });

  const matches = [];
  Object.keys(catTotals).forEach(cat => {
    const clean = cat.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toUpperCase();
    const isNonEssential = nonEssentials.some(keyword => clean.includes(keyword));
    if (isNonEssential && catTotals[cat] > 20) {
      matches.push({ cat, amt: catTotals[cat] });
    }
  });

  matches.sort((a, b) => b.amt - a.amt);

  if (matches.length === 0) {
    return state.lang === 'el'
      ? "🎯 **Εξαιρετική οικονομία!** Δεν ξοδεύεις υπερβολικά σε προαιρετικά έξοδα αυτόν τον μήνα. Για να αποταμιεύσεις ακόμα περισσότερο, σκέψου να θέσεις έναν αυτόματο στόχο αποταμίευσης στην αρχή του μήνα."
      : "🎯 **Great economy!** You aren't spending excessively on discretionary categories this month. To save even more, consider setting an automatic savings goal at the start of the month.";
  }

  let html = state.lang === 'el'
    ? "💡 **Ιδέες για να αυξήσεις την αποταμίευσή σου άμεσα:**<br><br>"
    : "💡 **Ideas to boost your savings immediately:**<br><br>";

  matches.slice(0, 2).forEach(item => {
    const dispCat = getCategoryDisplayName(item.cat);
    const save10 = item.amt * 0.1;
    const save20 = item.amt * 0.2;

    html += state.lang === 'el'
      ? `• **${dispCat}**: Έχεις ξοδέψει **${formatCurrency(item.amt)}** αυτόν τον μήνα.<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Μείωση 10%: Κέρδος **+${formatCurrency(save10)}** / μήνα (€${Math.round(save10 * 12)}/έτος).<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Μείωση 20%: Κέρδος **+${formatCurrency(save20)}** / μήνα (€${Math.round(save20 * 12)}/έτος).<br>`
      : `• **${dispCat}**: You spent **${formatCurrency(item.amt)}** this month.<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Cut 10%: Saves **+${formatCurrency(save10)}** / month (€${Math.round(save10 * 12)}/year).<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Cut 20%: Saves **+${formatCurrency(save20)}** / month (€${Math.round(save20 * 12)}/year).<br>`;
  });

  html += state.lang === 'el'
    ? "<br>⚡ *Tip: Μπορείς να ορίσεις Budgets για αυτές τις κατηγορίες ώστε να λαμβάνεις ειδοποίηση μόλις πλησιάσεις το όριο!*"
    : "<br>⚡ *Tip: You can set Budgets for these categories to receive alerts when you approach your limit!*";

  return html;
}

function runCoachFiveYearForecast() {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;

  let html = "";
  if (state.lang === 'el') {
    html += `📈 **Πρόβλεψη Εξέλιξης 5ετίας:**<br><br>`;
    html += `• Τρέχον Υπόλοιπο: **${formatCurrency(startBalance)}**<br>`;
    html += `• Μέση Μηνιαία Αποταμίευση: **${formatCurrency(monthlySavings)}**/μήνα<br><br>`;

    if (monthlySavings <= 0) {
      html += `⚠️ **Προσοχή!** Ο μέσος ρυθμός αποταμίευσής σου είναι αρνητικός ή μηδενικός. Αν συνεχίσεις έτσι, η περιουσία σου δεν θα αυξηθεί και ενδέχεται να έχεις απώλειες. Προσπάθησε να μειώσεις τα έξοδά σου.`;
      return html;
    }

    for (let year = 1; year <= 5; year++) {
      const projected = startBalance + (year * 12 * monthlySavings);
      html += `• **Έτος ${year}**: ${formatCurrency(projected)} (+${formatCurrency(year * 12 * monthlySavings)})<br>`;
    }
    html += `<br>🔮 *Οι υπολογισμοί βασίζονται στον μέσο ρυθμό αποταμίευσης των τελευταίων 3 μηνών.*`;
  } else {
    html += `📈 **5-Year Financial Projection:**<br><br>`;
    html += `• Current Balance: **${formatCurrency(startBalance)}**<br>`;
    html += `• Average Monthly Savings: **${formatCurrency(monthlySavings)}**/month<br><br>`;

    if (monthlySavings <= 0) {
      html += `⚠️ **Warning!** Your average monthly savings rate is negative or zero. If this continues, your net worth will not grow and you might experience losses. Try to reduce your spending.`;
      return html;
    }

    for (let year = 1; year <= 5; year++) {
      const projected = startBalance + (year * 12 * monthlySavings);
      html += `• **Year ${year}**: ${formatCurrency(projected)} (+${formatCurrency(year * 12 * monthlySavings)})<br>`;
    }
    html += `<br>🔮 *Projections are based on your average savings rate from the last 3 months.*`;
  }

  return html;
}

function runCoachTargetMilestone(targetAmount = 50000) {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;

  let html = "";
  if (state.lang === 'el') {
    html += `🎯 **Ανάλυση Στόχου: ${formatCurrency(targetAmount)}**<br><br>`;
    html += `• Τρέχον Υπόλοιπο: **${formatCurrency(startBalance)}**<br>`;
    html += `• Υπολειπόμενο Ποσό: **${formatCurrency(Math.max(0, targetAmount - startBalance))}**<br>`;

    if (startBalance >= targetAmount) {
      return `🎉 **Συγχαρητήρια!** Έχεις ήδη επιτύχει αυτόν τον στόχο! Το τρέχον υπόλοιπό σου είναι **${formatCurrency(startBalance)}**.`;
    }

    if (monthlySavings <= 0) {
      return `⚠️ **Αδύνατη Πρόβλεψη**: Με τον τρέχοντα μέσο ρυθμό αποταμίευσής σου (**${formatCurrency(monthlySavings)}**/μήνα), δεν είναι δυνατή η επίτευξη του στόχου. Χρειάζεται να αυξήσεις τη μηνιαία αποταμίευσή σου για να ξεκινήσει η πρόοδος.`;
    }

    const months = Math.ceil((targetAmount - startBalance) / monthlySavings);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    const dateStr = targetDate.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });

    html += `• Εκτιμώμενος Χρόνος: **${months} μήνες**<br>`;
    html += `• Ημερομηνία Επίτευξης: **${dateStr}**<br><br>`;
    html += `💡 *Συμβουλή: Αν αυξήσεις την αποταμίευσή σου κατά **€100/μήνα**, θα φτάσεις τον στόχο **${Math.max(1, Math.round(months - ((targetAmount - startBalance) / (monthlySavings + 100))))} μήνες νωρίτερα**!*`;
  } else {
    html += `🎯 **Target Analysis: ${formatCurrency(targetAmount)}**<br><br>`;
    html += `• Current Balance: **${formatCurrency(startBalance)}**<br>`;
    html += `• Remaining Amount: **${formatCurrency(Math.max(0, targetAmount - startBalance))}**<br>`;

    if (startBalance >= targetAmount) {
      return `🎉 **Congratulations!** You have already reached this target! Your current balance is **${formatCurrency(startBalance)}**.`;
    }

    if (monthlySavings <= 0) {
      return `⚠️ **Projection Impossible**: With your current average monthly savings rate (**${formatCurrency(monthlySavings)}**/month), you cannot reach this target. You need to increase your savings rate to make progress.`;
    }

    const months = Math.ceil((targetAmount - startBalance) / monthlySavings);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    const dateStr = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    html += `• Estimated Time: **${months} months**<br>`;
    html += `• Milestone Date: **${dateStr}**<br><br>`;
    html += `💡 *Tip: If you increase your savings by **€100/month**, you will reach your goal **${Math.max(1, Math.round(months - ((targetAmount - startBalance) / (monthlySavings + 100))))} months faster**!*`;
  }

  return html;
}

function runCoachCategoryAnalysis(categoryName) {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();

  const trans = state.transactions || [];
  const currMonthTrans = trans.filter(t => {
    if (t.type !== 'expense' || !t.date) return false;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;

    const cleanT = t.category.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toLowerCase();
    const cleanQuery = categoryName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toLowerCase();

    return y === currYear && m === currMonth && (cleanT.includes(cleanQuery) || cleanQuery.includes(cleanT));
  });

  if (currMonthTrans.length === 0) {
    return state.lang === 'el'
      ? `Δεν βρήκα έξοδα στην κατηγορία **${categoryName}** για αυτόν τον μήνα.`
      : `No expenses found in the **${categoryName}** category for this month.`;
  }

  const totalAmt = currMonthTrans.reduce((sum, t) => sum + CurrencyService.toBase(t), 0);
  const top3 = currMonthTrans.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0)).slice(0, 3);

  let html = "";
  if (state.lang === 'el') {
    html += `📋 **Ανάλυση Εξόδων κατηγορίας: ${categoryName}**<br><br>`;
    html += `• Συνολικά έξοδα μήνα: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Πλήθος συναλλαγών: **${currMonthTrans.length}**<br><br>`;
    html += `🔍 **Οι 3 μεγαλύτερες συναλλαγές:**<br>`;

    top3.forEach((t, idx) => {
      const dateObj = new Date(t.date);
      const formattedDate = dateObj.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
        : (t.description && t.description.trim()) ? t.description.trim()
          : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
            : (translatedCat || '');

      html += `${idx + 1}. **${formattedDate}**: ${escapeHtml(displayTitle)} — **${formatCurrency(t.amount)}**<br>`;
    });
  } else {
    html += `📋 **Expense Analysis for: ${categoryName}**<br><br>`;
    html += `• Total monthly expenses: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Total transactions count: **${currMonthTrans.length}**<br><br>`;
    html += `🔍 **Top 3 largest transactions:**<br>`;

    top3.forEach((t, idx) => {
      const dateObj = new Date(t.date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
        : (t.description && t.description.trim()) ? t.description.trim()
          : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
            : (translatedCat || '');

      html += `${idx + 1}. **${formattedDate}**: ${escapeHtml(displayTitle)} — **${formatCurrency(t.amount)}**<br>`;
    });
  }

  return html;
}

function predictCategoryFromHistory(noteText) {
  const cleanNote = normalizeGreekString(noteText);
  if (!cleanNote) return null;

  const trans = state.transactions || [];
  const categoryCounts = {};

  trans.forEach(t => {
    if (t.type !== 'expense') return;
    const cNote = normalizeGreekString(t.note || '');
    const cDesc = normalizeGreekString(t.description || '');
    if ((cNote && cleanNote.includes(cNote)) || (cDesc && cleanNote.includes(cDesc)) || (cNote && cNote.includes(cleanNote)) || (cDesc && cDesc.includes(cleanNote))) {
      if ((cNote && cNote.length > 2) || (cDesc && cDesc.length > 2) || cleanNote.length > 2) {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      }
    }
  });

  const sorted = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
  return sorted.length > 0 ? sorted[0] : null;
}

function getSubcategoriesForCategory(category) {
  if (!category) return [];
  const rawClean = stripLeadingEmoji(category).trim();
  const cleanedCat = rawClean.toUpperCase();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(rawClean) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(category).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';
  const uniqueSubcats = new Set();

  const cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  const deletedSubs = new Set(
    ((cat && Array.isArray(cat.deleted_subcategories)) ? cat.deleted_subcategories : [])
      .map(s => String(s || '').trim().toLowerCase())
  );

  // 1. Match DEFAULT_SUBCATEGORIES_MAP case-insensitively & accent-insensitively
  if (typeof DEFAULT_SUBCATEGORIES_MAP === 'object' && DEFAULT_SUBCATEGORIES_MAP) {
    Object.keys(DEFAULT_SUBCATEGORIES_MAP).forEach(key => {
      const keyClean = stripLeadingEmoji(key).trim().toUpperCase();
      const keyNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(key) : keyClean.toLowerCase();

      if (keyClean === cleanedCat || keyClean === dispCat || keyNorm === normCat || (normDisp && keyNorm === normDisp)) {
        (DEFAULT_SUBCATEGORIES_MAP[key] || []).forEach(sub => {
          const s = String(sub || '').trim();
          if (s && !deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
        });
      }
    });
  }

  // 2. Match custom subcategories attached to state.categories
  if (cat && Array.isArray(cat.subcategories)) {
    cat.subcategories.forEach(sub => {
      const s = typeof sub === 'string' ? sub.trim() : (sub && sub.name ? String(sub.name).trim() : String(sub || '').trim());
      if (s && !deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
    });
  }

  // 3. Match subcategories from existing transactions
  (state.transactions || []).forEach(t => {
    if (t && t.category && stripLeadingEmoji(t.category).trim().toUpperCase() === cleanedCat) {
      if (t.subcategory && t.subcategory.trim() !== '') {
        const s = t.subcategory.trim();
        if (!deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
      }
    }
  });

  return Array.from(uniqueSubcats).sort();
}

function predictSubcategoryFromHistory(category, noteText) {
  const cleanNote = normalizeGreekString(noteText);
  if (!cleanNote || !category) return '';

  const trans = state.transactions || [];
  const subcatCounts = {};

  trans.forEach(t => {
    if (t.type !== 'expense' || t.category !== category) return;
    const cNote = normalizeGreekString(t.note || '');
    const cDesc = normalizeGreekString(t.description || '');
    if ((cNote && cleanNote.includes(cNote)) || (cDesc && cleanNote.includes(cDesc)) || (cNote && cNote.includes(cleanNote)) || (cDesc && cDesc.includes(cleanNote))) {
      if (t.subcategory && t.subcategory.trim() !== '') {
        subcatCounts[t.subcategory] = (subcatCounts[t.subcategory] || 0) + 1;
      }
    }
  });

  const sorted = Object.keys(subcatCounts).sort((a, b) => subcatCounts[b] - subcatCounts[a]);
  if (sorted.length > 0) return sorted[0];

  // Try matching subcategory names by keyword
  const subcats = getSubcategoriesForCategory(category);
  for (const sub of subcats) {
    const cleanSub = normalizeGreekString(sub);
    if (cleanNote.includes(cleanSub) || cleanSub.includes(cleanNote)) {
      return sub;
    }
  }

  // Custom heuristics
  const cleanedCat = stripLeadingEmoji(category).toUpperCase();
  if (cleanedCat === 'ΔΙΑΤΡΟΦΗ') {
    if (cleanNote.includes('φουρν') || cleanNote.includes('ψωμ') || cleanNote.includes('bakery')) {
      const match = subcats.find(s => normalizeGreekString(s).includes('φουρν') || normalizeGreekString(s).includes('ψωμ'));
      if (match) return match;
    }
    if (cleanNote.includes('σουπερ') || cleanNote.includes('super') || cleanNote.includes('σκλαβενιτ') || cleanNote.includes('lidl') || cleanNote.includes('βασιλοπ')) {
      const match = subcats.find(s => normalizeGreekString(s).includes('σουπερ') || normalizeGreekString(s).includes('super'));
      if (match) return match;
    }
  }

  return '';
}

var updateCoachSubcategories = function (catSelectId, subcatSelectId, defaultSubcat = '') {
  const catSelect = document.getElementById(catSelectId);
  const subcatSelect = document.getElementById(subcatSelectId);
  if (!catSelect || !subcatSelect) return;

  const selectedCategory = catSelect.value;
  subcatSelect.innerHTML = '';

  const noneText = state.lang === 'el' ? 'Χωρίς υποκατηγορία' : 'No subcategory';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = noneText;
  subcatSelect.appendChild(noneOpt);

  const subcategories = getSubcategoriesForCategory(selectedCategory);
  subcategories.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub;
    opt.textContent = getSubcategoryDisplayName(sub, selectedCategory);
    if (sub === defaultSubcat) {
      opt.selected = true;
    }
    subcatSelect.appendChild(opt);
  });
};

function runCoachTransactionEntry(amount, noteText, type = 'expense', category = null, subcategory = null, accountFrom = null, dateStr = null, id = null) {
  if (isNaN(amount) || amount <= 0) {
    return state.lang === 'el' ? "🤖 Παρακαλώ δώσε ένα έγκυρο ποσό (π.χ. 'βάλε 40 για ρεύμα')." : "🤖 Please provide a valid amount (e.g., 'add 40 for electric bill').";
  }

  const isIncome = type === 'income';
  let predictedCat = category || predictCategoryFromHistory(noteText);

  if (!predictedCat) {
    const cleanNote = normalizeGreekString(noteText);
    if (isIncome) {
      if (cleanNote.includes('μισθο') || cleanNote.includes('salary') || cleanNote.includes('δουλεια') || cleanNote.includes('εργασια')) predictedCat = '💼 ΜΙΣΘΟΣ';
      else if (cleanNote.includes('ενοικιο') || cleanNote.includes('rent')) predictedCat = '🏠 ΕΝΟΙΚΙΑ';
      else if (cleanNote.includes('επιστροφη') || cleanNote.includes('refund')) predictedCat = '🔄 ΕΠΙΣΤΡΟΦΕΣ';
      else if (cleanNote.includes('επενδυσ') || cleanNote.includes('μερισμα')) predictedCat = '📈 ΕΠΕΝΔΥΣΕΙΣ';
      else if (cleanNote.includes('δωρο') || cleanNote.includes('gift')) predictedCat = '🎁 ΔΩΡΑ';
    } else {
      if (cleanNote.includes('βενζινη') || cleanNote.includes('αμαξι') || cleanNote.includes('διοδια') || cleanNote.includes('παρκινγκ')) predictedCat = '🚗 ΑΥΤΟΚΙΝΗΤΟ';
      else if (cleanNote.includes('σουπερ') || cleanNote.includes('super') || cleanNote.includes('καφε') || cleanNote.includes('φαγητο') || cleanNote.includes('delivery') || cleanNote.includes('ντελιβερι') || cleanNote.includes('εστιατοριο') || cleanNote.includes('ταβερνα') || cleanNote.includes('φουρν') || cleanNote.includes('αρτοποι')) predictedCat = '🛒 ΔΙΑΤΡΟΦΗ';
      else if (cleanNote.includes('ρευμα') || cleanNote.includes('δεη') || cleanNote.includes('νερο') || cleanNote.includes('τηλεφωνο') || cleanNote.includes('κοινοχρηστα') || cleanNote.includes('ενοικιο')) predictedCat = '🏡 ΣΠΙΤΙ';
      else if (cleanNote.includes('γιατρο') || cleanNote.includes('φαρμακειο') || cleanNote.includes('υγεία') || cleanNote.includes('εξετασεις')) predictedCat = '❤️ ΥΓΕΙΑ';
      else if (cleanNote.includes('ποτο') || cleanNote.includes('μπυρες') || cleanNote.includes('σινεμα') || cleanNote.includes('εξοδος')) predictedCat = '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ';
      else if (cleanNote.includes('κομμωτηριο') || cleanNote.includes('κουρειο') || cleanNote.includes('νυχια')) predictedCat = '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ';
      else if (cleanNote.includes('γυμναστηριο')) predictedCat = '🏋️ΓΥΜΝΑΣΤΗΡΙΟ';
    }
  }

  const targetCats = (state.categories || []).filter(c => isIncome ? c.type === 'income' : c.type === 'expense');
  if (targetCats.length === 0) targetCats.push({ name: isIncome ? '💰 ΕΣΟΔΑ' : '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ' });

  if (predictedCat && !targetCats.some(c => c.name === predictedCat)) {
    predictedCat = null;
  }

  if (!predictedCat) {
    predictedCat = targetCats[0].name;
  }

  const predictedSub = subcategory !== null ? subcategory : predictSubcategoryFromHistory(predictedCat, noteText);

  // Find accounts options with smart matching for accountFrom
  let accOptionsHtml = '';
  let defaultAccount = 'Card';
  if (state.accounts && state.accounts.length > 0) {
    let matchedAcc = null;
    if (accountFrom) {
      const normAf = normalizeGreekString(accountFrom);
      matchedAcc = state.accounts.find(acc => {
        const na = normalizeGreekString(acc.name || '');
        return na === normAf || na.includes(normAf) || normAf.includes(na);
      });
    }

    if (matchedAcc) {
      defaultAccount = matchedAcc.name;
    } else {
      const cardAcc = state.accounts.find(acc => acc.type === 'card' || acc.name.toLowerCase().trim() === 'card' || acc.name.trim() === 'Κάρτα');
      const cashAcc = state.accounts.find(acc => acc.type === 'cash' || acc.name.toLowerCase().trim() === 'cash' || acc.name.trim() === 'Μετρητά');
      const defaultAcc = cardAcc || cashAcc || state.accounts[0];
      defaultAccount = defaultAcc ? defaultAcc.name : 'Card';
    }

    state.accounts.forEach(acc => {
      const selected = acc.name === defaultAccount ? 'selected' : '';
      accOptionsHtml += `<option value="${acc.name}" ${selected}>${acc.name}</option>`;
    });
  } else {
    accOptionsHtml = `<option value="Card" selected>${state.lang === 'el' ? 'Κάρτα' : 'Card'}</option>
                      <option value="Cash">${state.lang === 'el' ? 'Μετρητά' : 'Cash'}</option>`;
  }

  // Calculate local datetime string for input defaultValue
  let defaultDateTime;
  if (dateStr) {
    const d = new Date(dateStr);
    const tzOffset = d.getTimezoneOffset() * 60000;
    defaultDateTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  } else {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    defaultDateTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  const seed = Math.floor(Math.random() * 1000000);
  const amtInputId = 'coach-tx-amt-input-' + seed;
  const noteInputId = 'coach-tx-note-input-' + seed;
  const dateInputId = 'coach-tx-date-input-' + seed;
  const catSelectId = 'coach-tx-cat-select-' + seed;
  const subcatSelectId = 'coach-tx-subcat-select-' + seed;
  const accSelectId = 'coach-tx-acc-select-' + seed;
  const btnId = 'coach-tx-btn-' + seed;

  let catOptionsHtml = '';
  targetCats.forEach(c => {
    const selected = c.name === predictedCat ? 'selected' : '';
    catOptionsHtml += `<option value="${c.name}" ${selected}>${getCategoryDisplayName(c.name)}</option>`;
  });

  const subcategories = getSubcategoriesForCategory(predictedCat);
  let subOptionsHtml = `<option value="">${state.lang === 'el' ? 'Χωρίς υποκατηγορία' : 'No subcategory'}</option>`;
  subcategories.forEach(sub => {
    const selected = sub === predictedSub ? 'selected' : '';
    subOptionsHtml += `<option value="${sub}" ${selected}>${getSubcategoryDisplayName(sub, predictedCat)}</option>`;
  });

  const isEl = state.lang === 'el';
  const badgeTitle = id
    ? (isEl ? 'Επεξεργασία Συναλλαγής' : 'Edit Transaction')
    : isIncome
      ? (isEl ? 'Προτεινόμενο Έσοδο' : 'Suggested Income')
      : (isEl ? 'Προτεινόμενη Καταχώρηση' : 'Suggested Transaction');
  const badgeIcon = isIncome ? 'fa-arrow-trend-up' : 'fa-bolt';
  const badgeColor = isIncome ? '#34d399' : '#818cf8';
  const btnLabel = id
    ? (isEl ? 'Αποθήκευση Αλλαγών' : 'Save Changes')
    : (isEl ? 'Καταχώρηση Συναλλαγής' : 'Confirm Transaction');

  let html = `
    <div class="ai-tx-luxury-card">
      <div class="ai-tx-top-badge">
        <span style="display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid ${badgeIcon}" style="color: ${badgeColor};"></i>
          ${badgeTitle}
        </span>
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">
          ${dateStr ? String(dateStr).split('T')[0] : (isEl ? 'Σήμερα' : 'Today')}
        </span>
      </div>

      <!-- Hero Amount & Note Row -->
      <div class="ai-tx-hero-row">
        <div style="flex: 1; min-width: 0; padding-right: 12px;">
          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 3px;">
            ${isEl ? 'Περιγραφή' : 'Description'}
          </div>
          <input type="text" id="${noteInputId}" value="${noteText.replace(/"/g, '&quot;')}" 
            style="width: 100%; background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.2); color: #fff; font-size: 15px; font-weight: 700; outline: none; padding: 2px 0;">
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 3px;">
            ${isEl ? 'Ποσό' : 'Amount'}
          </div>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 2px;">
            <span style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; color: ${type === 'income' ? '#34d399' : '#f87171'};">${type === 'income' ? '+€' : '-€'}</span>
            <input type="number" step="0.01" id="${amtInputId}" value="${amount.toFixed(2)}"
              style="width: 85px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; text-align: right; padding: 2px 6px; outline: none;">
          </div>
        </div>
      </div>

      <!-- Metadata Dropdowns Grid -->
      <div class="ai-tx-meta-grid">
        <div class="ai-tx-meta-pill">
          <i class="fa-solid fa-shapes" style="color: #818cf8; font-size: 13px; flex-shrink: 0;"></i>
          <div style="flex: 1; min-width: 0;">
            <div class="ai-tx-meta-label">${isEl ? 'Κατηγορία' : 'Category'}</div>
            <select id="${catSelectId}" onchange="window.updateCoachSubcategories('${catSelectId}', '${subcatSelectId}')"
              style="width: 100%; background: transparent; border: none; color: #fff; font-size: 11.5px; font-weight: 700; outline: none; cursor: pointer; padding: 0;">
              ${catOptionsHtml}
            </select>
          </div>
        </div>

        <div class="ai-tx-meta-pill">
          <i class="fa-solid fa-credit-card" style="color: #38bdf8; font-size: 13px; flex-shrink: 0;"></i>
          <div style="flex: 1; min-width: 0;">
            <div class="ai-tx-meta-label">${isEl ? 'Πληρωμή' : 'Account'}</div>
            <select id="${accSelectId}"
              style="width: 100%; background: transparent; border: none; color: #fff; font-size: 11.5px; font-weight: 700; outline: none; cursor: pointer; padding: 0;">
              ${accOptionsHtml}
            </select>
          </div>
        </div>
      </div>

      <!-- Subcategory & Date (Secondary Row) -->
      <div class="ai-tx-meta-grid">
        <div class="ai-tx-meta-pill">
          <i class="fa-solid fa-tag" style="color: #c084fc; font-size: 12px; flex-shrink: 0;"></i>
          <div style="flex: 1; min-width: 0;">
            <div class="ai-tx-meta-label">${isEl ? 'Υποκατηγορία' : 'Subcategory'}</div>
            <select id="${subcatSelectId}"
              style="width: 100%; background: transparent; border: none; color: #fff; font-size: 11px; font-weight: 600; outline: none; cursor: pointer; padding: 0;">
              ${subOptionsHtml}
            </select>
          </div>
        </div>

        <div class="ai-tx-meta-pill">
          <i class="fa-regular fa-clock" style="color: #94a3b8; font-size: 12px; flex-shrink: 0;"></i>
          <div style="flex: 1; min-width: 0;">
            <div class="ai-tx-meta-label">${isEl ? 'Ημερομηνία' : 'Date'}</div>
            <input type="datetime-local" id="${dateInputId}" value="${defaultDateTime}"
              style="width: 100%; background: transparent; border: none; color: #fff; font-size: 11px; font-weight: 600; outline: none; padding: 0;">
          </div>
        </div>
      </div>

      <!-- Luxury Confirm Action Button -->
      <button id="${btnId}" class="ai-tx-save-btn" onclick="window.submitCoachTransaction(document.getElementById('${amtInputId}').value, '${type}', document.getElementById('${catSelectId}').value, document.getElementById('${subcatSelectId}').value, document.getElementById('${accSelectId}').value, document.getElementById('${noteInputId}').value, document.getElementById('${dateInputId}').value, this.id, '${id || ''}')">
        <i class="fa-solid fa-check"></i>
        <span>${btnLabel}</span>
      </button>
    </div>
  `;
  return html;
}

function runCoachTopCategories() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();
  const trans = state.transactions || [];
  const totals = {};

  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const parts = String(t.date).split('T')[0].split(' ')[0].split('-');
    if (parts.length !== 3) return;
    if (parseInt(parts[0], 10) === currYear && (parseInt(parts[1], 10) - 1) === currMonth) {
      totals[t.category] = (totals[t.category] || 0) + CurrencyService.toBase(t);
    }
  });

  const sorted = Object.keys(totals).map(cat => ({ cat, amt: totals[cat] })).sort((a, b) => b.amt - a.amt);
  if (sorted.length === 0) {
    return state.lang === 'el' ? "📊 Δεν βρέθηκαν έξοδα για αυτόν τον μήνα." : "📊 No expenses found for this month.";
  }

  let html = state.lang === 'el' ? "📊 **Οι κατηγορίες με τα περισσότερα έξοδα αυτόν τον μήνα:**<br><br>" : "📊 **Your top spending categories this month:**<br><br>";
  sorted.slice(0, 3).forEach((item, idx) => {
    html += `${idx + 1}. **${getCategoryDisplayName(item.cat)}**: **${formatCurrency(item.amt)}**<br>`;
  });
  return html;
}

function runCoachWhatIfSimulation(amount, itemName = null) {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;

  if (isNaN(amount) || amount <= 0) {
    return state.lang === 'el' ? "Παρακαλώ δώσε ένα έγκυρο ποσό για την προσομοίωση." : "Please provide a valid amount for the simulation.";
  }

  const nameStr = itemName ? `**${itemName}**` : (state.lang === 'el' ? "αυτή την αγορά" : "this purchase");
  const remainingBalance = startBalance - amount;

  let html = "";
  if (state.lang === 'el') {
    html += `🔮 **Προσομοίωση Αγοράς (What-If): ${formatCurrency(amount)}**<br><br>`;
    html += `Αν προχωρήσεις στην αγορά για ${nameStr} αξίας **${formatCurrency(amount)}**:<br><br>`;
    html += `• Το τρέχον υπόλοιπό σου θα μειωθεί από **${formatCurrency(startBalance)}** σε **${formatCurrency(remainingBalance)}**.<br>`;

    if (remainingBalance < 0) {
      html += `🔴 **Προσοχή!** Το υπόλοιπό σου θα γίνει αρνητικό (**${formatCurrency(remainingBalance)}**). Αυτή η αγορά ξεπερνά τις οικονομικές σου δυνατότητες αυτή τη στιγμή.<br>`;
    } else {
      html += `🟢 Διατηρείς θετικό υπόλοιπο ασφαλείας (**${formatCurrency(remainingBalance)}**).<br>`;
    }

    if (monthlySavings > 0) {
      const monthsDelay = Math.ceil(amount / monthlySavings);
      html += `• Θα χρειαστείς **${monthsDelay} μήνες** αποταμίευσης για να αναπληρώσεις αυτό το ποσό.<br>`;

      const targetAmount = 50000;
      if (startBalance < targetAmount) {
        const originalMonths = Math.ceil((targetAmount - startBalance) / monthlySavings);
        const newMonths = Math.ceil((targetAmount - remainingBalance) / monthlySavings);
        html += `• Η επίτευξη του στόχου των ${formatCurrency(targetAmount)} θα καθυστερήσει κατά **${newMonths - originalMonths} μήνες**.<br>`;
      }
    }
  } else {
    html += `🔮 **What-If Purchase Simulation: ${formatCurrency(amount)}**<br><br>`;
    html += `If you purchase ${nameStr} for **${formatCurrency(amount)}**:<br><br>`;
    html += `• Your balance will decrease from **${formatCurrency(startBalance)}** to **${formatCurrency(remainingBalance)}**.<br>`;

    if (remainingBalance < 0) {
      html += `🔴 **Warning!** Your balance will drop to negative (**${formatCurrency(remainingBalance)}**). This purchase is beyond your current financial limit.<br>`;
    } else {
      html += `🟢 You maintain a positive buffer of **${formatCurrency(remainingBalance)}**.<br>`;
    }

    if (monthlySavings > 0) {
      const monthsDelay = Math.ceil(amount / monthlySavings);
      html += `• It will take you **${monthsDelay} months** of savings to recover this amount.<br>`;

      const targetAmount = 50000;
      if (startBalance < targetAmount) {
        const originalMonths = Math.ceil((targetAmount - startBalance) / monthlySavings);
        const newMonths = Math.ceil((targetAmount - remainingBalance) / monthlySavings);
        html += `• Reaching your ${formatCurrency(targetAmount)} goal will be delayed by **${newMonths - originalMonths} months**.<br>`;
      }
    }
  }
  return html;
}

function runCoachSearchQuery(keyword) {
  const cleanKeyword = normalizeGreekString(keyword);
  const trans = state.transactions || [];
  const today = new Date();
  const currentYear = today.getFullYear();

  const matchedTrans = trans.filter(t => {
    if (!t.date || _isTransferTransaction(t)) return false;

    const datePart = String(t.date).split('T')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    if (y !== currentYear) return false;

    const cleanCat = normalizeGreekString(t.category);
    const cleanSub = normalizeGreekString(t.subcategory || '');
    const cleanNote = normalizeGreekString(t.note || '');
    const cleanDesc = normalizeGreekString(t.description || '');

    return cleanCat.includes(cleanKeyword) ||
      cleanSub.includes(cleanKeyword) ||
      cleanNote.includes(cleanKeyword) ||
      cleanDesc.includes(cleanKeyword);
  });

  if (matchedTrans.length === 0) {
    return state.lang === 'el'
      ? `Δεν βρήκα καμία συναλλαγή φέτος με τον όρο **"${keyword}"**.`
      : `No transactions found this year with the term **"${keyword}"**.`;
  }

  const totalAmt = matchedTrans.reduce((sum, t) => sum + CurrencyService.toBase(t), 0);
  const count = matchedTrans.length;
  const avg = totalAmt / count;

  let html = "";
  if (state.lang === 'el') {
    html += `🔍 **Αποτελέσματα Αναζήτησης για: "${keyword}"**<br><br>`;
    html += `• Βρέθηκαν **${count} συναλλαγές** φέτος.<br>`;
    html += `• Συνολικό ποσό: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Μέσος όρος ανά συναλλαγή: **${formatCurrency(avg)}**<br><br>`;
    html += `💡 *Συμβουλή: Προσπαθήστε να κρατάτε σημειώσεις (notes) σε κάθε συναλλαγή για να μπορείτε να τις αναζητάτε ακόμα πιο εύκολα!*`;
  } else {
    html += `🔍 **Search Results for: "${keyword}"**<br><br>`;
    html += `• Found **${count} transactions** this year.<br>`;
    html += `• Total amount: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Average per transaction: **${formatCurrency(avg)}**<br><br>`;
    html += `💡 *Tip: Try adding notes to your transactions to search for specific items even easier!*`;
  }
  return html;
}

function processCoachQuery(queryText) {
  const normQuery = normalizeGreekString(queryText);
  const cleanQuery = queryText.toLowerCase().trim();

  if (cleanQuery === 'overspending' || normQuery.includes('υπερβολικα')) {
    return runCoachOverspendingAnalysis();
  }
  if (cleanQuery === 'savings' || normQuery.includes('αποταμιευσω')) {
    return runCoachSavingsAdvice();
  }
  if (cleanQuery === 'forecast_5y' || normQuery.includes('5 χρονια') || normQuery.includes('5 ετη')) {
    return runCoachFiveYearForecast();
  }
  if (cleanQuery === 'milestone_50k' || cleanQuery === 'milestone_50000') {
    return runCoachTargetMilestone(50000);
  }
  if (cleanQuery.startsWith('milestone_')) {
    let amtStr = cleanQuery.replace('milestone_', '');
    const amt = amtStr.endsWith('k') ? (parseFloat(amtStr) * 1000) : (parseInt(amtStr, 10) || 50000);
    return runCoachTargetMilestone(amt);
  }

  const localizedAmt = typeof parseLocalizedAmount === 'function'
    ? parseLocalizedAmount(queryText)
    : (typeof window.parseLocalizedAmount === 'function' ? window.parseLocalizedAmount(queryText) : null);

  // 0. Action commands (add transaction: expense or income)
  const hasExpenseVerb = normQuery.includes('βαλε') || normQuery.includes('προσθεσε') || normQuery.includes('καταχωρησε') || normQuery.includes('χρεωσε') || normQuery.includes('ξοδεψα') || normQuery.includes('εδωσα') || normQuery.includes('πληρωσα') || normQuery.includes('χαλασα') || normQuery.includes('xalasa') || normQuery.includes('χαλασαμε') || normQuery.includes('xalasame') || normQuery.includes('add') || normQuery.includes('spent') || normQuery.includes('paid');
  const hasIncomeVerb = normQuery.includes('πηρα') || normQuery.includes('μπηκε') || normQuery.includes('μισθος') || normQuery.includes('εισπραξη') || normQuery.includes('επιστροφη') || normQuery.includes('κερδισα') || normQuery.includes('εσοδο') || normQuery.includes('καταθεση') || normQuery.includes('received') || normQuery.includes('earned') || normQuery.includes('salary');
  const isAddCommand = hasExpenseVerb || hasIncomeVerb;

  if (isAddCommand && localizedAmt && localizedAmt > 0) {
    const amount = localizedAmt;
    const detectedType = hasIncomeVerb ? 'income' : 'expense';

    // Relative date detection (e.g. χθες, προχθες, yesterday)
    let detectedDate = null;
    if (normQuery.includes('προχθες') || normQuery.includes('day before yesterday')) {
      const d = new Date(Date.now() - 2 * 86400000);
      detectedDate = d.toISOString();
    } else if (normQuery.includes('χθες') || normQuery.includes('yesterday')) {
      const d = new Date(Date.now() - 86400000);
      detectedDate = d.toISOString();
    }

    // Account detection
    let detectedAccount = null;
    if (state.accounts && state.accounts.length > 0) {
      for (const acc of state.accounts) {
        const na = normalizeGreekString(acc.name || '');
        if (na && na.length > 2 && normQuery.includes(na)) {
          detectedAccount = acc.name;
          break;
        }
      }
    }

    let noteText = queryText.replace(/\d+(?:[.,]\d+)?/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
    const stopWords = ['βαλε', 'προσθεσε', 'καταχωρησε', 'χρεωσε', 'ξοδεψα', 'εδωσα', 'πληρωσα', 'χαλασα', 'xalasa', 'χαλασαμε', 'xalasame', 'πηρα', 'μπηκε', 'εισπραξη', 'κερδισα', 'εσοδο', 'καταθεση', 'ευρω', 'euro', 'σε', 'στο', 'στην', 'στα', 'στον', 'για', 'απο', 'με', 'ενα', 'μια', 'add', 'spent', 'paid', 'for', 'on', 'euros', 'χθες', 'προχθες', 'yesterday'];
    if (detectedAccount) {
      stopWords.push(normalizeGreekString(detectedAccount));
    }
    const words = noteText.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(normalizeGreekString(w)));
    const cleanNote = words.join(' ') || (detectedType === 'income' ? 'Έσοδο' : 'Έξοδο');

    // Distinguish between sum search "ποσα ξοδεψα" and action "ξοδεψα 40"
    if (!normQuery.includes('ποσα') && !normQuery.includes('ποσο') && !normQuery.includes('how much') && !normQuery.includes('τι ')) {
      return runCoachTransactionEntry(amount, cleanNote, detectedType, null, null, detectedAccount, detectedDate);
    }
  }

  // 1. Discuss Category Increase
  if (normQuery.includes('γιατι αυξηθηκαν') || normQuery.includes('why did my') || normQuery.includes('αυξηθηκαν') || normQuery.includes('did my') || normQuery.includes('αυξηση')) {
    let catName = "";
    const grMatch = queryText.match(/οι\s+([α-ωΑ-ΩάέήίόύώΆΈΉΊΌΎΏϊϋΐΰa-zA-Z\s]+?)\s+μου/i);
    const enMatch = queryText.match(/my\s+([a-zA-Z\s]+?)\s+rose/i) || queryText.match(/did\s+([a-zA-Z\s]+?)\s+increase/i);

    if (grMatch && grMatch[1]) catName = grMatch[1].trim();
    else if (enMatch && enMatch[1]) catName = enMatch[1].trim();
    else {
      const words = normQuery.split(/\s+/);
      const stopWords = ['γιατι', 'αυξηθηκαν', 'οι', 'μου', 'αυτον', 'τον', 'μηνα', 'why', 'did', 'my', 'increase', 'this', 'month', 'expense', 'expenses', 'αυξηση', 'εξοδα', 'εξοδων'];
      const possibleCats = words.filter(w => w.length > 2 && !stopWords.includes(w));
      if (possibleCats.length > 0) catName = possibleCats[0];
    }

    if (catName) {
      return runCoachCategoryAnalysis(catName);
    }
  }

  // 2. What-If Simulator
  const isSimulation = normQuery.includes('αγορασ') || normQuery.includes('αγορα') || normQuery.includes('παρω') || normQuery.includes('buy') || normQuery.includes('purchase');
  if (isSimulation && localizedAmt && localizedAmt > 0) {
    const amount = localizedAmt;
    let itemName = queryText.replace(/\d+(?:[.,]\d+)?/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
    const stopWords = ['αν', 'να', 'αγορασω', 'αγοράσω', 'παρω', 'πάρω', 'αγορα', 'αγορά', 'για', 'ευρω', 'ευρώ', 'euro', 'buy', 'purchase', 'a', 'an', 'the', 'what', 'if', 'i'];
    const words = itemName.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(normalizeGreekString(w)));
    const cleanItemName = words.join(' ') || null;
    return runCoachWhatIfSimulation(amount, cleanItemName);
  }

  // 3. Milestone Target
  if (normQuery.includes('φτασω') || normQuery.includes('reach') || normQuery.includes('αποκτησω') || normQuery.includes('στοχο') || normQuery.includes('target') || normQuery.includes('μαζεψω') || normQuery.includes('εχω') || normQuery.includes('στην ακρη')) {
    if (localizedAmt && localizedAmt > 0) {
      return runCoachTargetMilestone(localizedAmt);
    }
  }

  // 4. Budgets Status
  if (normQuery.includes('προϋπολογισμ') || normQuery.includes('προϋπολογισμο') || normQuery.includes('προϋπολογισμοι') || normQuery.includes('προϋπολογισμους') || normQuery.includes('proypologism') || normQuery.includes('budget') || normQuery.includes('οριο') || normQuery.includes('ορια')) {
    const budgets = state.budgets || [];
    const activeExpenses = state.transactions.filter(t => {
      const datePart = String(t.date || '').split('T')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const today = new Date();
      return t.type === 'expense' && y === today.getFullYear() && m === today.getMonth();
    });

    const expenseTotals = {};
    activeExpenses.forEach(t => {
      expenseTotals[t.category] = (expenseTotals[t.category] || 0) + CurrencyService.toBase(t);
    });

    let html = state.lang === 'el' ? "📊 **Κατάσταση Προϋπολογισμών (Budgets):**<br><br>" : "📊 **Budget Status:**<br><br>";
    let hasBudgets = false;

    budgets.forEach(b => {
      if (b.is_deleted) return;
      const catInfo = getCategoryInfo(b.category, 'expense');
      const catName = catInfo.name || b.category;
      const limit = parseFloat(b.amount) || 0;
      if (limit > 0) {
        hasBudgets = true;
        const spent = expenseTotals[catName] || 0;
        const pct = Math.round((spent / limit) * 100);
        const dispCat = getCategoryDisplayName(catName);
        const indicator = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
        html += `${indicator} **${dispCat}**: ${formatCurrency(spent)} / ${formatCurrency(limit)} (**${pct}%**)<br>`;
      }
    });

    if (!hasBudgets) {
      return state.lang === 'el'
        ? "📊 Δεν έχεις ορίσει προϋπολογισμούς ακόμα. Μπορείς να ορίσεις Budgets πηγαίνοντας στα **Περισσότερα -> Όρια Κατηγοριών**."
        : "📊 You haven't set any budgets yet. You can set them in **More -> Category Limits**.";
    }
    return html;
  }

  // 5. Top categories breakdown
  if (normQuery.includes('που ξοδευω τα περισσοτερα') || normQuery.includes('που ξοδευω τα') || normQuery.includes('που πανε τα λεφτα') || normQuery.includes('μεγαλυτερα εξοδα') || normQuery.includes('where do i spend') || normQuery.includes('top spending')) {
    return runCoachTopCategories();
  }

  // 6. Conversational Sum Search (e.g. "πόσα ξόδεψα σε καφέ", "πόσα λεφτά έχω χαλάσει στο κομμωτήριο φέτος")
  const isSpendingQuery = normQuery.includes('ποσα') || normQuery.includes('ποσο') || normQuery.includes('how much') || normQuery.includes('how many') || normQuery.includes('spent') || normQuery.includes('xodepsa') || normQuery.includes('xodepsame') || normQuery.includes('xalasa') || normQuery.includes('xalasame');
  if (isSpendingQuery) {
    let keyword = "";
    const grMatch = queryText.match(/(?:σε|για|στο|στη|στην|στα|στον|στους|στις)\s+([α-ωΑ-ΩάέήίόύώΆΈΉΊΌΎΏϊϋΐΰa-zA-Z\s]+)/i);
    const enMatch = queryText.match(/(?:on|for|at|in)\s+([a-zA-Z\s]+)/i);

    if (grMatch && grMatch[1]) {
      keyword = grMatch[1].trim();
    } else if (enMatch && enMatch[1]) {
      keyword = enMatch[1].trim();
    } else {
      const stopWords = [
        'ποσα', 'ποσο', 'ποσα λεφτα', 'ποσο λεφτα', 'λεφτα', 'χρηματα', 'εχω', 'εχουμε', 'χαλασει', 'χαλασα',
        'χαλασαμε', 'ξοδεψει', 'ξοδεψα', 'ξοδεψαμε', 'εδωσα', 'εδωσαμε', 'δωσει', 'πληρωσα', 'πληρωσαμε',
        'πληρωσει', 'φετος', 'μηνα', 'ετος', 'σημερα', 'χθες', 'how', 'much', 'did', 'i', 'spend', 'spent',
        'on', 'for', 'this', 'year', 'month', 'today', 'yesterday'
      ];
      const words = normQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
      if (words.length > 0) {
        keyword = words[0];
      }
    }

    if (keyword) {
      keyword = keyword.replace(/(?:φετος|φέτος|αυτον|τον|μηνα|μήνα|αυτο|το|ετος|έτος|this year|this month|year|month)/gi, '').trim();
      if (keyword) {
        return runCoachSearchQuery(keyword);
      }
    }
  }

  // 7. General search fallback
  const cleanKeyword = cleanQuery.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  if (cleanKeyword.length >= 2) {
    return runCoachSearchQuery(cleanKeyword);
  }

  return state.lang === 'el'
    ? `🤖 **Δεν μπόρεσα να κατανοήσω πλήρως την ερώτηση.**<br><br>Μπορείς να δοκιμάσεις κάποια από τις έτοιμες προτάσεις από κάτω, ή να ρωτήσεις για μια συγκεκριμένη κατηγορία/λέξη (π.χ. «καφέ», «φαγητό», «βενζίνη», «υπερβολικά», «αποταμίευση»).`
    : `🤖 **I couldn't quite understand the question.**<br><br>You can try using one of the suggestion chips below, or ask about a specific category or search term (e.g., 'coffee', 'food', 'petrol', 'overspending', 'savings').`;
}

var submitCoachTransaction = async function (amount, type, category, subcategory, accountFrom, note, dateString, btnId, id = null) {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = state.lang === 'el' ? '⏳ Καταχώρηση...' : '⏳ Saving...';
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    window.showAlert(state.lang === 'el' ? 'Παρακαλώ δώστε ένα έγκυρο ποσό.' : 'Please enter a valid amount.');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = state.lang === 'el' ? '✅ Καταχώρηση' : '✅ Register';
    }
    return;
  }

  const txId = id || generateUUID();
  const transaction = {
    id: txId,
    type: type || 'expense',
    amount: parsedAmount,
    category: category || '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ',
    subcategory: subcategory || '',
    account_from: accountFrom || 'Card',
    account_to: null,
    note: note || '',
    date: dateString ? new Date(dateString).toISOString() : new Date().toISOString(),
    user_id: state.currentUser ? state.currentUser.id : null,
    family_id: (state.activeAccountMode !== 'personal' && state.userProfile && state.userProfile.family_id) ? state.userProfile.family_id : null
  };

  try {
    await saveTransaction(transaction);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = state.lang === 'el' ? '✅ Καταχωρήθηκε!' : '✅ Saved!';
      btn.style.backgroundColor = 'var(--success)';
      btn.style.opacity = '0.9';
      btn.style.cursor = 'default';
    }

    // 1. Permanently update the stored chat message in localStorage & Supabase
    updateAdvisorMessageSavedState(btnId);

    // 2. Trigger cloud sync immediately so Web / other devices receive it in real-time
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      syncLocalTransactionsToCloud().catch(err => console.warn('[CoachTx] Sync to cloud error:', err));
    }
  } catch (err) {
    console.error('Error saving transaction from coach:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = state.lang === 'el' ? '❌ Αποτυχία' : '❌ Failed';
      btn.style.backgroundColor = 'var(--danger)';
    }
  }
};

  // Attach all public functions to window / global
  windowObj.openAdvisorChat = openAdvisorChat;
  windowObj.closeAdvisorChat = closeAdvisorChat;
  windowObj.loadAdvisorConversations = loadAdvisorConversations;
  windowObj.saveAdvisorConversations = saveAdvisorConversations;
  windowObj.getActiveAdvisorConversationId = getActiveAdvisorConversationId;
  windowObj.setActiveAdvisorConversationId = setActiveAdvisorConversationId;
  windowObj.getActiveAdvisorConversation = getActiveAdvisorConversation;
  windowObj.getConversationTitle = getConversationTitle;
  windowObj.showAdvisorConversationList = showAdvisorConversationList;
  windowObj.toggleAdvisorHistory = toggleAdvisorHistory;
  windowObj.renderAdvisorConversationList = renderAdvisorConversationList;
  windowObj.formatConversationTime = formatConversationTime;
  windowObj.openAdvisorConversation = openAdvisorConversation;
  windowObj.startNewAdvisorConversation = startNewAdvisorConversation;
  windowObj.deleteAdvisorConversation = deleteAdvisorConversation;
  windowObj.persistAdvisorMessage = persistAdvisorMessage;
  windowObj.persistAdvisorGeminiHistory = persistAdvisorGeminiHistory;
  windowObj.updateAdvisorMessageSavedState = updateAdvisorMessageSavedState;
  windowObj.scheduleAdvisorConversationSync = scheduleAdvisorConversationSync;
  windowObj.appendChatMessage = appendChatMessage;
  windowObj.coachFilterCategory = coachFilterCategory;
  windowObj.coachOpenBudgets = coachOpenBudgets;
  windowObj.coachOpenReports = coachOpenReports;
  windowObj.coachOpenRecurring = coachOpenRecurring;
  windowObj.handleAdvisorChatInput = handleAdvisorChatInput;
  windowObj.submitCoachInput = submitCoachInput;
  windowObj.handleAdvisorChatKeydown = handleAdvisorChatKeydown;
  windowObj.submitCoachQuery = submitCoachQuery;
  windowObj.getCoachAveragePacing = getCoachAveragePacing;
  windowObj.runCoachOverspendingAnalysis = runCoachOverspendingAnalysis;
  windowObj.runCoachSavingsAdvice = runCoachSavingsAdvice;
  windowObj.runCoachFiveYearForecast = runCoachFiveYearForecast;
  windowObj.runCoachTargetMilestone = runCoachTargetMilestone;
  windowObj.runCoachCategoryAnalysis = runCoachCategoryAnalysis;
  windowObj.predictCategoryFromHistory = predictCategoryFromHistory;
  windowObj.getSubcategoriesForCategory = getSubcategoriesForCategory;
  windowObj.predictSubcategoryFromHistory = predictSubcategoryFromHistory;
  windowObj.updateCoachSubcategories = updateCoachSubcategories;
  windowObj.runCoachTransactionEntry = runCoachTransactionEntry;
  windowObj.runCoachTopCategories = runCoachTopCategories;
  windowObj.runCoachWhatIfSimulation = runCoachWhatIfSimulation;
  windowObj.runCoachSearchQuery = runCoachSearchQuery;
  windowObj.processCoachQuery = processCoachQuery;
  windowObj.submitCoachTransaction = submitCoachTransaction;

  return {
    openAdvisorChat: openAdvisorChat,
    closeAdvisorChat: closeAdvisorChat,
    loadAdvisorConversations: loadAdvisorConversations,
    saveAdvisorConversations: saveAdvisorConversations,
    getActiveAdvisorConversationId: getActiveAdvisorConversationId,
    setActiveAdvisorConversationId: setActiveAdvisorConversationId,
    getActiveAdvisorConversation: getActiveAdvisorConversation,
    getConversationTitle: getConversationTitle,
    showAdvisorConversationList: showAdvisorConversationList,
    toggleAdvisorHistory: toggleAdvisorHistory,
    renderAdvisorConversationList: renderAdvisorConversationList,
    formatConversationTime: formatConversationTime,
    openAdvisorConversation: openAdvisorConversation,
    startNewAdvisorConversation: startNewAdvisorConversation,
    deleteAdvisorConversation: deleteAdvisorConversation,
    persistAdvisorMessage: persistAdvisorMessage,
    persistAdvisorGeminiHistory: persistAdvisorGeminiHistory,
    updateAdvisorMessageSavedState: updateAdvisorMessageSavedState,
    scheduleAdvisorConversationSync: scheduleAdvisorConversationSync,
    appendChatMessage: appendChatMessage,
    coachFilterCategory: coachFilterCategory,
    coachOpenBudgets: coachOpenBudgets,
    coachOpenReports: coachOpenReports,
    coachOpenRecurring: coachOpenRecurring,
    handleAdvisorChatInput: handleAdvisorChatInput,
    submitCoachInput: submitCoachInput,
    handleAdvisorChatKeydown: handleAdvisorChatKeydown,
    submitCoachQuery: submitCoachQuery,
    getCoachAveragePacing: getCoachAveragePacing,
    runCoachOverspendingAnalysis: runCoachOverspendingAnalysis,
    runCoachSavingsAdvice: runCoachSavingsAdvice,
    runCoachFiveYearForecast: runCoachFiveYearForecast,
    runCoachTargetMilestone: runCoachTargetMilestone,
    runCoachCategoryAnalysis: runCoachCategoryAnalysis,
    predictCategoryFromHistory: predictCategoryFromHistory,
    getSubcategoriesForCategory: getSubcategoriesForCategory,
    predictSubcategoryFromHistory: predictSubcategoryFromHistory,
    updateCoachSubcategories: updateCoachSubcategories,
    runCoachTransactionEntry: runCoachTransactionEntry,
    runCoachTopCategories: runCoachTopCategories,
    runCoachWhatIfSimulation: runCoachWhatIfSimulation,
    runCoachSearchQuery: runCoachSearchQuery,
    processCoachQuery: processCoachQuery,
    submitCoachTransaction: submitCoachTransaction
  };
});
