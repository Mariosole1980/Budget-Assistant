/**
 * KnowledgeGraph.js — L5: Entity → Concept → Category resolution
 *
 * Extends the existing MemoryEngine SEMANTIC_CATEGORY_MAPPING.
 * Learns new entities from:
 *   - Gemini Teacher (source: 'gemini', confidence: 0.85)
 *   - User corrections  (source: 'user',   confidence: 1.0)
 *
 * Trust hierarchy: user (1.0) > gemini (0.85) > semantic_seed (0.7)
 */
window.KnowledgeGraph = (function () {
  const STORAGE_KEY = 'advisor_knowledge_graph_v1';

  // ─── SEED ENTITIES ────────────────────────────────────────────────────────
  // Known brand/merchant → { concept, category, confidence, source }
  const SEED_ENTITIES = {
    // Fuel
    'shell':        { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    'eko':          { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    'avin':         { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    'bp':           { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    'revoil':       { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    'elin':         { concept: 'βενζινη', category: '🚗 ΑΥΤΟΚΙΝΗΤΟ', confidence: 0.9, source: 'seed' },
    // Supermarkets
    'σκλαβενιτης':  { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'lidl':         { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'ab':           { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.85, source: 'seed' },
    'mymarket':     { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'masoutis':     { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'bazaraki':     { concept: 'σουπερμαρκετ', category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.85, source: 'seed' },
    // Utilities / Telecom
    'δεη':          { concept: 'ρευμα',     category: '🏠 ΣΠΙΤΙ', confidence: 0.95, source: 'seed' },
    'ευδαπ':        { concept: 'νερο',      category: '🏠 ΣΠΙΤΙ', confidence: 0.95, source: 'seed' },
    'cosmote':      { concept: 'τηλεφωνο', category: '🏠 ΣΠΙΤΙ', confidence: 0.9, source: 'seed' },
    'vodafone':     { concept: 'τηλεφωνο', category: '🏠 ΣΠΙΤΙ', confidence: 0.9, source: 'seed' },
    'nova':         { concept: 'τηλεφωνο', category: '🏠 ΣΠΙΤΙ', confidence: 0.9, source: 'seed' },
    'wind':         { concept: 'τηλεφωνο', category: '🏠 ΣΠΙΤΙ', confidence: 0.9, source: 'seed' },
    // Pharmacies / Health
    'φαρμακειο':    { concept: 'φαρμακα',  category: '❤️ ΥΓΕΙΑ', confidence: 0.9, source: 'seed' },
    'pharmacity':   { concept: 'φαρμακα',  category: '❤️ ΥΓΕΙΑ', confidence: 0.9, source: 'seed' },
    // Delivery
    'efood':        { concept: 'delivery',  category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'wolt':         { concept: 'delivery',  category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.9, source: 'seed' },
    'box':          { concept: 'delivery',  category: '🛒 ΔΙΑΤΡΟΦΗ', confidence: 0.85, source: 'seed' },
  };

  // Concept → Category mapping (semantic layer)
  const CONCEPT_CATEGORY_MAP = {
    'βενζινη':      '🚗 ΑΥΤΟΚΙΝΗΤΟ',
    'καυσιμα':      '🚗 ΑΥΤΟΚΙΝΗΤΟ',
    'σουπερμαρκετ': '🛒 ΔΙΑΤΡΟΦΗ',
    'φαγητο':       '🛒 ΔΙΑΤΡΟΦΗ',
    'καφε':         '🛒 ΔΙΑΤΡΟΦΗ',
    'delivery':     '🛒 ΔΙΑΤΡΟΦΗ',
    'ρευμα':        '🏠 ΣΠΙΤΙ',
    'νερο':         '🏠 ΣΠΙΤΙ',
    'τηλεφωνο':     '🏠 ΣΠΙΤΙ',
    'ενοικιο':      '🏠 ΣΠΙΤΙ',
    'internet':     '🏠 ΣΠΙΤΙ',
    'φαρμακα':      '❤️ ΥΓΕΙΑ',
    'γιατρος':      '❤️ ΥΓΕΙΑ',
    'υγεια':        '❤️ ΥΓΕΙΑ',
    'γυμναστηριο':  '🏋️ ΓΥΜΝΑΣΤΗΡΙΟ',
    'ρουχα':        '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ',
    'κομμωτηριο':   '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ',
    'ποτο':         '🎉 ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ',
    'σινεμα':       '🎉 ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ',
    'ταξιδι':       '✈️ ΤΑΞΙΔΙ',
  };

  // ─── NORMALIZATION ─────────────────────────────────────────────────────────
  function normalizeKey(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zα-ω0-9]/g, '')
      .trim();
  }

  // ─── GRAPH PERSISTENCE ─────────────────────────────────────────────────────
  function getGraph() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && typeof stored === 'object') return stored;
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(SEED_ENTITIES));
  }

  function saveGraph(graph) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    } catch (e) { console.warn('[KnowledgeGraph] Save failed:', e); }
  }

  // ─── ENTITY EXTRACTION FROM QUERY ─────────────────────────────────────────
  // Extracts potential unknown entity names from query text
  function extractUnknownEntities(queryText) {
    const STOP_WORDS = new Set([
      'εσκασα', 'πληρωσα', 'ξοδεψα', 'αγορασα', 'εδωσα', 'εβαλα',
      'paid', 'spent', 'bought', 'για', 'στο', 'στην', 'στα', 'στον',
      'ευρω', 'ευρώ', 'euro', 'euros', 'λεφτα', 'χρηματα',
      'πηγα', 'πηγαμε', 'αγορα', 'εξοδο', 'ξοδο'
    ]);
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zα-ω0-9\s]/g, '').trim();

    const graph = getGraph();
    const words = norm(queryText).split(/\s+/).filter(w =>
      w.length > 2 &&
      !STOP_WORDS.has(w) &&
      !/^\d+$/.test(w) && // not a number
      !graph[w]            // not already known
    );

    // Return words that look like proper nouns (originally capitalized) or unknown brands
    return words.filter(w => {
      const originalWord = queryText.split(/\s+/).find(ow =>
        ow.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zα-ω0-9]/g, '') === w
      );
      // Keep if original was capitalized (proper noun) or all-caps (brand)
      return originalWord && (
        originalWord[0] === originalWord[0].toUpperCase() ||
        originalWord === originalWord.toUpperCase()
      );
    });
  }

  // ─── ENTITY RESOLUTION ────────────────────────────────────────────────────
  // Returns { category, concept, confidence, source } or null
  function resolve(entityText) {
    if (!entityText) return null;
    const key = normalizeKey(entityText);
    if (!key) return null;

    const graph = getGraph();

    // 1. Direct lookup
    if (graph[key]) return graph[key];

    // 2. Concept lookup (maybe user typed the concept directly)
    if (CONCEPT_CATEGORY_MAP[key]) {
      return { concept: key, category: CONCEPT_CATEGORY_MAP[key], confidence: 0.8, source: 'concept' };
    }

    // 3. Partial match (entity contains known key or vice versa)
    for (const [knownKey, data] of Object.entries(graph)) {
      if (key.includes(knownKey) || knownKey.includes(key)) {
        if (knownKey.length >= 3) return { ...data, confidence: data.confidence * 0.8 };
      }
    }

    return null;
  }

  // ─── LEARNING: ADD EDGE ───────────────────────────────────────────────────
  // source: 'user' | 'gemini' | 'seed'
  function addEdge(entityText, concept, category, source = 'gemini') {
    if (!entityText || !category) return false;
    const key = normalizeKey(entityText);
    if (!key || key.length < 2) return false;

    const graph = getGraph();
    const confidence = source === 'user' ? 1.0 : source === 'gemini' ? 0.85 : 0.7;

    // Don't overwrite user-provided data with lower-confidence source
    const existing = graph[key];
    if (existing && existing.source === 'user' && source !== 'user') {
      console.log(`[KnowledgeGraph] Skipping: "${key}" already has user-trusted data`);
      return false;
    }

    graph[key] = { concept: concept || '', category, confidence, source, learnedAt: Date.now() };
    saveGraph(graph);

    // Also teach MemoryEngine for transaction categorization
    if (window.MemoryEngine && window.MemoryEngine.addTokenToMemory) {
      const weight = source === 'user' ? 5.0 : 3.0;
      window.MemoryEngine.addTokenToMemory(entityText, category, weight);
    }

    console.log(`[KnowledgeGraph] Learned: "${key}" → ${concept} → ${category} (${source}, ${confidence})`);
    return true;
  }

  // ─── BULK LEARN FROM GEMINI ────────────────────────────────────────────────
  function learnFromGeminiEntities(entities) {
    if (!entities || !Array.isArray(entities)) return;
    entities.forEach(e => {
      if (e && e.text && e.category) {
        addEdge(e.text, e.concept || '', e.category, 'gemini');
      }
    });
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────
  function getStats() {
    const graph = getGraph();
    const all = Object.entries(graph);
    const seedCount = Object.keys(SEED_ENTITIES).length;
    const userLearned = all.filter(([, v]) => v.source === 'user').length;
    const geminiLearned = all.filter(([, v]) => v.source === 'gemini').length;
    return { total: all.length, seed: seedCount, userLearned, geminiLearned };
  }

  function resetToSeed() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[KnowledgeGraph] Reset to seed');
  }

  return {
    resolve,
    addEdge,
    extractUnknownEntities,
    learnFromGeminiEntities,
    getStats,
    normalizeKey,
    resetToSeed,
    CONCEPT_CATEGORY_MAP
  };
})();
