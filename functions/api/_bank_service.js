// Shared Open Banking service for Budget Assistant
// Integrates with Enable Banking (PSD2 AISP) with full Greek Bank support:
// - National Bank of Greece (NBG)
// - Eurobank
// - Alpha Bank
// - Piraeus Bank
// - Revolut
//
// Supports live Open Banking via Enable Banking and automatic Sandbox/Mock
// fallback when developer keys are not yet configured in environment.

const ENABLE_BANKING_API_BASE = 'https://api.enablebanking.com';

// Built-in registry of Greek ASPSPs (banks).
// `logo` points to the bank's own artwork published by the PSD2 provider
// (Enable Banking brand assets), so the UI always shows the official logo
// instead of a third-party/stock placeholder.
export const SUPPORTED_GREEK_BANKS = [
  {
    name: 'National Bank of Greece',
    name_el: 'Εθνική Τράπεζα (NBG)',
    code: 'NBG',
    country: 'GR',
    logo: 'https://enablebanking.com/brands/GR/National%20Bank%20of%20Greece/',
    color: '#004f80'
  },
  {
    name: 'Eurobank',
    name_el: 'Eurobank',
    code: 'EUROBANK',
    country: 'GR',
    logo: 'https://enablebanking.com/brands/GR/Eurobank/',
    color: '#d6001c'
  },
  {
    name: 'Alpha Bank',
    name_el: 'Alpha Bank',
    code: 'ALPHA',
    country: 'GR',
    logo: 'https://enablebanking.com/brands/GR/Alpha%20Bank/',
    color: '#002663'
  },
  {
    name: 'Piraeus Bank',
    name_el: 'Τράπεζα Πειραιώς',
    code: 'PIRAEUS',
    country: 'GR',
    logo: 'https://enablebanking.com/brands/GR/Piraeus%20Bank/',
    color: '#fdb913'
  },
  {
    name: 'Revolut',
    name_el: 'Revolut',
    code: 'REVOLUT',
    country: 'GB',
    logo: 'https://enablebanking.com/brands/GR/Revolut/',
    color: '#0075eb'
  }
];

// ---------------------------------------------------------------------------
// ASPSP (bank) resolution
//
// Enable Banking identifies a bank by the *exact* `name` + `country` pair it
// publishes on GET /aspsps — nothing else. Both values differ subtly from what
// the app shows to users ("NBG" is published as "National Bank of Greece",
// Revolut operates under GB and not under GR), and a mismatch is rejected with
// HTTP 422, which is why some banks could never be connected. Every
// authorization therefore resolves the bank against the live ASPSP list first
// and only falls back to the built-in registry when the provider is
// unreachable (offline / sandbox mode).
// ---------------------------------------------------------------------------

// PSD2 caps consents at 90 days; stay just below the ceiling so the value
// never lands on the ASPSP's "one second too long" boundary.
const DEFAULT_CONSENT_SECONDS = 89 * 24 * 60 * 60;
const CONSENT_SAFETY_MARGIN_SECONDS = 60;
// ASPSP metadata (limits, required PSU headers, supported auth methods) changes
// rarely, so one hour of per-isolate caching avoids a round-trip per request.
const ASPSP_CACHE_TTL_MS = 60 * 60 * 1000;

const _aspspCache = new Map();

/** Strip accents/punctuation so "Εθνική Τράπεζα" == "εθνικη τραπεζα". */
export function normalizeBankName(name) {
  let raw = String(name == null ? '' : name);
  try {
    raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) { /* very old engines: keep raw */ }
  return raw.toLowerCase().replace(/[^a-z0-9\u0370-\u03ff]+/g, '');
}

// Alternative names users (and older app versions) may send for an ASPSP.
const BANK_NAME_ALIASES = [
  { canonical: 'nationalbankofgreece', names: ['nbg', 'εθνικη', 'εθνικητραπεζα', 'εθνικητραπεζαελλαδος', 'nationalbank'] },
  { canonical: 'eurobank', names: ['eurobankergasias'] },
  { canonical: 'alphabank', names: ['alpha', 'alphabanksa'] },
  { canonical: 'piraeusbank', names: ['piraeus', 'πειραιως', 'τραπεζαπειραιως', 'piraeusbanksa'] },
  { canonical: 'revolut', names: ['revolutbank', 'revolutbankuab'] }
];

/** Canonical key used to compare a user-facing bank name with a provider name. */
export function canonicalBankKey(name) {
  const normalized = normalizeBankName(name);
  if (!normalized) return '';
  for (const alias of BANK_NAME_ALIASES) {
    if (alias.canonical === normalized || alias.names.includes(normalized)) return alias.canonical;
  }
  return normalized;
}

function findAspsp(list, wantedName) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const wantedRaw = String(wantedName || '').trim().toLowerCase();
  const wantedKey = canonicalBankKey(wantedName);
  if (!wantedKey) return null;

  // 1. Byte-for-byte provider name (what the UI shows when it uses /aspsps).
  const exact = list.find((a) => a && String(a.name || '').trim().toLowerCase() === wantedRaw);
  if (exact) return exact;

  // 2. Same name ignoring case, accents and punctuation.
  const normalized = list.find((a) => a && normalizeBankName(a.name) === normalizeBankName(wantedName));
  if (normalized) return normalized;

  // 3. Known aliases ("NBG" → "National Bank of Greece").
  return list.find((a) => a && canonicalBankKey(a.name) === wantedKey) || null;
}

/** 'business' | 'personal' — anything else falls back to a private account. */
export function normalizePsuType(value) {
  return String(value || '').trim().toLowerCase() === 'business' ? 'business' : 'personal';
}

function normalizeLanguage(value) {
  const lang = String(value || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(lang) ? lang : 'el';
}

/**
 * Consent expiry that the ASPSP will actually accept.
 *
 * `access.valid_until` may not be later than now + the ASPSP's
 * `maximum_consent_validity` (returned by GET /aspsps); sending a flat 90 days
 * for every bank was accepted by the big four but rejected by connectors with a
 * shorter ceiling — one of the reasons only "some banks" worked.
 */
export function computeConsentValidUntil(maximumConsentValidity) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxSeconds = Number(maximumConsentValidity);
  const ceilingSeconds = Number.isFinite(maxSeconds) && maxSeconds > CONSENT_SAFETY_MARGIN_SECONDS * 2
    ? Math.floor(maxSeconds - CONSENT_SAFETY_MARGIN_SECONDS)
    : DEFAULT_CONSENT_SECONDS;
  return new Date((nowSeconds + Math.min(DEFAULT_CONSENT_SECONDS, ceilingSeconds)) * 1000).toISOString();
}

/**
 * PSU context headers (IP / User-Agent / language). ASPSPs listed with
 * `required_psu_headers` reject /auth, /balances and /transactions when the PSU
 * context is missing, so it is forwarded whenever Cloudflare gives it to us.
 */
export function normalizePsuHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;

  const push = (name, value, maxLength) => {
    const clean = String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
    if (clean) out[name] = clean;
  };

  push('Psu-Ip-Address', headers['Psu-Ip-Address'] || headers.ip, 64);
  push('Psu-User-Agent', headers['Psu-User-Agent'] || headers.userAgent, 512);
  push('Psu-Accept-Language', headers['Psu-Accept-Language'] || headers.language, 35);
  return out;
}

export function psuHeadersFromRequest(request) {
  if (!request || !request.headers || typeof request.headers.get !== 'function') return {};
  const forwarded = String(
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    ''
  );
  return normalizePsuHeaders({
    'Psu-Ip-Address': request.headers.get('Psu-Ip-Address') || forwarded.split(',')[0],
    'Psu-User-Agent': request.headers.get('Psu-User-Agent') || request.headers.get('User-Agent'),
    'Psu-Accept-Language': request.headers.get('Psu-Accept-Language') || request.headers.get('Accept-Language')
  });
}

function base64UrlEncode(strOrBuffer) {
  let base64;
  if (typeof strOrBuffer === 'string') {
    base64 = btoa(strOrBuffer);
  } else {
    const bytes = new Uint8Array(strOrBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const cleanPem = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const binary = atob(cleanPem);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate RS256 signed JWT for Enable Banking
async function createEnableBankingJwt(appId, privateKeyPem) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: appId
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600 // 1 hour validity
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const binaryKey = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' }
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    dataToSign
  );

  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

// ---------------------------------------------------------------------------
// Provider payload mapping
// ---------------------------------------------------------------------------

// Booked balances first: a budgeting app wants the settled amount, while
// `interim*` values include holds and pending card authorizations. Banks report
// the type in `balance_type` (ISO 20022 codes); the legacy `name` labels are
// accepted too because some connectors still send them.
const BALANCE_TYPE_ALIASES = {
  closingbooked: 'CLBD',
  interimbooked: 'ITBD',
  closingavailable: 'CLAV',
  interimavailable: 'ITAV',
  expected: 'XPCD',
  previouslyclosedbooked: 'PRCD',
  forwardavailable: 'FWAV'
};
const BALANCE_TYPE_PRIORITY = ['CLBD', 'ITBD', 'CLAV', 'ITAV', 'XPCD', 'PRCD', 'FWAV', 'OTHR'];

// Some ASPSPs return only the current day when `date_from` is omitted, others
// reject the call, so a rolling window is always sent explicitly.
const TRANSACTIONS_LOOKBACK_DAYS = 90;

function defaultTransactionsDateFrom(days = TRANSACTIONS_LOOKBACK_DAYS) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

export function pickPrimaryBalance(balances) {
  if (!Array.isArray(balances) || balances.length === 0) return null;

  const withAmount = balances.filter((b) => {
    if (!b) return false;
    const amt = b.balance_amount || b.balanceAmount;
    return amt && (amt.amount != null || amt.value != null);
  });
  if (withAmount.length === 0) return null;

  const rank = (balance) => {
    const raw = String(balance.balance_type || balance.balanceType || balance.name || '').trim().toLowerCase();
    const type = BALANCE_TYPE_ALIASES[raw] || raw.toUpperCase();
    const index = BALANCE_TYPE_PRIORITY.indexOf(type);
    return index === -1 ? BALANCE_TYPE_PRIORITY.length : index;
  };

  const primary = withAmount.slice().sort((a, b) => rank(a) - rank(b))[0];
  const amtObj = primary.balance_amount || primary.balanceAmount;
  return {
    ...primary,
    balance_amount: amtObj,
    balance_type: primary.balance_type || primary.balanceType
  };
}

/**
 * Robustly extract unique account identifier from any Open Banking/PSD2 payload shape.
 * Supports standard checking accounts (IBAN/BBAN) and credit/debit card accounts
 * (masked PAN, PAN, card_id, resource_id, other identifier objects).
 */
export function extractAccountUid(acc) {
  if (!acc) return null;
  if (typeof acc === 'string') {
    const s = acc.trim();
    return s || null;
  }
  if (typeof acc !== 'object') return null;

  // 1. Direct top-level ID fields
  const directFields = [
    acc.uid,
    acc.id,
    acc.accountId,
    acc.account_uid,
    acc.account_id_string,
    acc.resource_id,
    acc.resourceId,
    acc.card_id,
    acc.cardId
  ];
  for (const f of directFields) {
    if (typeof f === 'string' && f.trim()) return f.trim();
    if (typeof f === 'number') return String(f);
  }

  // 2. Nested account_id object or string
  const accId = acc.account_id || acc.accountIdObject || acc.card_account_id;
  if (typeof accId === 'string' && accId.trim()) return accId.trim();
  if (accId && typeof accId === 'object') {
    if (accId.iban && typeof accId.iban === 'string' && accId.iban.trim()) return accId.iban.trim();
    if (accId.masked_pan && typeof accId.masked_pan === 'string' && accId.masked_pan.trim()) return accId.masked_pan.trim();
    if (accId.pan && typeof accId.pan === 'string' && accId.pan.trim()) return accId.pan.trim();
    if (accId.card_number && typeof accId.card_number === 'string' && accId.card_number.trim()) return accId.card_number.trim();
    if (accId.bban && typeof accId.bban === 'string' && accId.bban.trim()) return accId.bban.trim();
    if (accId.other) {
      if (typeof accId.other === 'string' && accId.other.trim()) return accId.other.trim();
      if (typeof accId.other === 'object' && accId.other.identification) return String(accId.other.identification).trim();
    }
  }

  // 3. Fallbacks on the account object itself
  if (acc.iban && typeof acc.iban === 'string' && acc.iban.trim()) return acc.iban.trim();
  if (acc.masked_pan && typeof acc.masked_pan === 'string' && acc.masked_pan.trim()) return acc.masked_pan.trim();
  if (acc.pan && typeof acc.pan === 'string' && acc.pan.trim()) return acc.pan.trim();
  if (acc.card_number && typeof acc.card_number === 'string' && acc.card_number.trim()) return acc.card_number.trim();

  return null;
}

/**
 * Detect whether an account is a credit, debit, or prepaid card.
 */
export function isCardAccount(acc = {}, details = {}) {
  const combined = { ...acc, ...details };

  // Explicit type indicator
  const typeStr = String(
    combined.cash_account_type ||
    combined.cashAccountType ||
    combined.account_type ||
    combined.accountType ||
    combined.type ||
    ''
  ).toUpperCase();

  if (typeStr.includes('CARD') || typeStr.includes('CRED') || typeStr.includes('DEBT')) return true;

  // Name or product indicates card
  const productStr = String(
    combined.product ||
    combined.product_name ||
    combined.details ||
    combined.name ||
    combined.account_name ||
    ''
  ).toLowerCase();

  if (
    productStr.includes('κάρτα') ||
    productStr.includes('καρτα') ||
    productStr.includes('πιστωτικ') ||
    productStr.includes('χρεωστικ') ||
    productStr.includes('προπληρωμ') ||
    productStr.includes('card') ||
    productStr.includes('credit') ||
    productStr.includes('debit') ||
    productStr.includes('prepaid') ||
    productStr.includes('mastercard') ||
    productStr.includes('visa')
  ) {
    return true;
  }

  // Has masked_pan or pan or card_number but no IBAN
  const accId = combined.account_id;
  const hasCardNum = Boolean(
    combined.masked_pan ||
    combined.pan ||
    combined.card_number ||
    (accId && typeof accId === 'object' && (accId.masked_pan || accId.pan || accId.card_number))
  );
  const hasIban = Boolean(
    combined.iban ||
    (accId && typeof accId === 'object' && accId.iban)
  );

  return hasCardNum && !hasIban;
}

/**
 * Extract 4-digit card mask from an account / details object.
 */
export function extractCardMask(acc = {}, details = {}) {
  const sources = [
    acc?.masked_pan,
    acc?.pan,
    acc?.card_number,
    acc?.account_id?.masked_pan,
    acc?.account_id?.pan,
    acc?.account_id?.card_number,
    details?.masked_pan,
    details?.pan,
    details?.card_number,
    details?.account_id?.masked_pan,
    details?.account_id?.pan,
    details?.account_id?.card_number
  ];

  for (const s of sources) {
    if (s && typeof s === 'string' && s.trim()) {
      const clean = s.trim();
      const digits = clean.replace(/\D/g, '');
      if (digits.length >= 4) {
        return digits.slice(-4);
      }
      return clean.slice(-4);
    }
  }
  return null;
}

/**
 * Format a human-friendly display name for an account or card.
 */
export function formatAccountDisplayName(acc = {}, details = {}, bankName = '') {
  const isCard = isCardAccount(acc, details);
  const cardMask = isCard ? extractCardMask(acc, details) : null;
  const iban = (details && details.account_id && details.account_id.iban) ||
               (acc && typeof acc === 'object' && acc.account_id && acc.account_id.iban) ||
               (acc && typeof acc === 'object' && acc.iban) || null;

  const rawProductName = (details && (details.product || details.name)) ||
                         (acc && typeof acc === 'object' && (acc.details || acc.name || acc.product)) || null;

  if (isCard) {
    if (rawProductName && rawProductName.trim()) {
      const prod = rawProductName.trim();
      if (cardMask && !prod.includes(cardMask)) {
        return `${prod} (•••• ${cardMask})`;
      }
      return prod;
    }
    const bankPrefix = bankName ? `${bankName} ` : '';
    return cardMask
      ? `${bankPrefix}Πιστωτική Κάρτα (•••• ${cardMask})`
      : `${bankPrefix}Πιστωτική Κάρτα`;
  }

  // Regular bank account
  if (rawProductName && rawProductName.trim()) {
    return rawProductName.trim();
  }
  if (iban) {
    return `Λογαριασμός (${iban.slice(-4)})`;
  }
  return bankName ? `${bankName} (Λογαριασμός)` : 'Τραπεζικός Λογαριασμός';
}

/**
 * Collect all account and card candidates returned by Enable Banking /sessions or /sessions/{id}.
 * PSD2 AIS can return accounts in accounts, accounts_data, card_accounts, cards, etc.
 */
export function collectRawAccountsFromSession(data) {
  if (!data || typeof data !== 'object') return [];

  const candidateArrays = [
    data.accounts_data,
    data.accounts,
    data.card_accounts,
    data.cardAccounts,
    data.cards,
    data.credit_cards
  ];

  const rawAccounts = [];
  const seenUids = new Set();

  for (const list of candidateArrays) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (!item) continue;
        const uid = extractAccountUid(item);
        if (uid) {
          if (!seenUids.has(uid)) {
            seenUids.add(uid);
            rawAccounts.push(item);
          }
        } else {
          rawAccounts.push(item);
        }
      }
    }
  }

  return rawAccounts;
}

/**
 * Map an Enable Banking transaction to the app's internal shape.
 *
 * The direction lives in `credit_debit_indicator` (DBIT/CRDT) while
 * `transaction_amount.amount` is an unsigned monetary sum for most ASPSPs, so
 * relying on the sign alone imported every card payment as income at exactly
 * those banks.
 *
 * Pending rows (`status: PEND`) are skipped on purpose: once booked they are
 * re-published with a different `entry_reference`, which would duplicate them.
 */
export function mapProviderTransaction(tx, options = {}) {
  if (!tx) return null;

  const status = String(tx.status || '').trim().toUpperCase();
  const isPending = status === 'PEND' || status === 'PDNG' || status === 'PENDING';
  if (isPending && !options.includePending) return null;

  const amountObj = tx.transaction_amount || tx.transactionAmount || (typeof tx.amount === 'object' ? tx.amount : { amount: tx.amount }) || {};
  const rawAmount = Number.parseFloat(amountObj.amount != null ? amountObj.amount : (amountObj.value != null ? amountObj.value : tx.amount));
  if (!Number.isFinite(rawAmount) || rawAmount === 0) return null;

  const indicator = String(
    tx.credit_debit_indicator ||
    tx.creditDebitIndicator ||
    tx.credit_or_debit ||
    amountObj.credit_debit_indicator ||
    amountObj.creditDebitIndicator ||
    ''
  ).trim().toUpperCase();

  let amount = rawAmount;
  if (indicator === 'DBIT') amount = -Math.abs(rawAmount);
  else if (indicator === 'CRDT') amount = Math.abs(rawAmount);
  else if (rawAmount < 0) amount = rawAmount;

  const rawRemittance = tx.remittance_information || tx.remittanceInformation || tx.remittance_info || tx.remittanceInfo;
  const remittance = Array.isArray(rawRemittance)
    ? rawRemittance.filter(Boolean).join(' ').trim()
    : String(rawRemittance || '').trim();

  const codeDescription = (tx.bank_transaction_code && (tx.bank_transaction_code.description || tx.bank_transaction_code.code)) ||
    (tx.bankTransactionCode && (tx.bankTransactionCode.description || tx.bankTransactionCode.code));

  const merchantName = (tx.merchant && (tx.merchant.name || tx.merchant)) ||
    (tx.card_transaction_details && (tx.card_transaction_details.merchant_name || tx.card_transaction_details.terminal_id)) ||
    (tx.cardTransactionDetails && (tx.cardTransactionDetails.merchantName || tx.cardTransactionDetails.terminalId)) ||
    tx.merchant_name ||
    tx.creditor_name ||
    null;

  const description = remittance ||
    (tx.creditor && (tx.creditor.name || tx.creditor.name_el)) ||
    (tx.debtor && (tx.debtor.name || tx.debtor.name_el)) ||
    merchantName ||
    codeDescription ||
    tx.note ||
    'Τραπεζική Συναλλαγή';

  const date = tx.booking_date || tx.bookingDate ||
    tx.value_date || tx.valueDate ||
    tx.transaction_date || tx.transactionDate ||
    new Date().toISOString().split('T')[0];

  // `entry_reference` is the ASPSP's stable archive id and the only value that
  // survives a re-authorisation, so it is the dedupe key whenever present.
  const transactionId = tx.entry_reference || tx.entryReference ||
    tx.resource_id || tx.resourceId ||
    tx.transaction_id || tx.transactionId ||
    `tx_${String(date).slice(0, 10)}_${Math.abs(amount)}_${String(description).slice(0, 32)}`;

  return {
    transactionId: String(transactionId),
    date: String(date).slice(0, 10),
    amount,
    currency: amountObj.currency || tx.currency || 'EUR',
    description: String(description).slice(0, 500),
    status: isPending ? 'PENDING' : (status || 'BOOK')
  };
}

export class BankService {
  constructor(env, options = {}) {
    this.env = env || {};
    this.appId = this.env.ENABLE_BANKING_APP_ID;
    this.privateKey = this.env.ENABLE_BANKING_PRIVATE_KEY;
    this.isConfigured = Boolean(this.appId && this.privateKey);
    // PSU context (IP / User-Agent / language) is collected once per request in
    // the endpoint and replayed on every provider call of that request.
    this.psuHeaders = normalizePsuHeaders(options.psuHeaders);
  }

  setPsuHeaders(headers) {
    this.psuHeaders = Object.assign({}, this.psuHeaders, normalizePsuHeaders(headers));
    return this.psuHeaders;
  }

  async getJwt() {
    if (!this.isConfigured) {
      return null;
    }
    return await createEnableBankingJwt(this.appId, this.privateKey);
  }

  async authHeaders() {
    return Object.assign({
      'Authorization': `Bearer ${await this.getJwt()}`,
      'Content-Type': 'application/json'
    }, this.psuHeaders);
  }

  /**
   * ASPSP list with the provider metadata (country, consent ceiling, required
   * PSU headers). Cached per isolate for an hour; falls back to the built-in
   * registry when the provider is unreachable or not configured.
   * @returns {Promise<{list: Array, live: boolean}>}
   */
  async _loadAspsps({ country, psuType } = {}) {
    if (!this.isConfigured) {
      return { list: SUPPORTED_GREEK_BANKS, live: false };
    }

    const countryCode = country ? String(country).trim().toUpperCase() : '';
    const psu = psuType ? normalizePsuType(psuType) : '';
    const cacheKey = `${countryCode || '*'}|${psu || '*'}`;

    const cached = _aspspCache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < ASPSP_CACHE_TTL_MS) {
      return { list: cached.list, live: cached.live };
    }

    const params = new URLSearchParams();
    if (countryCode) params.set('country', countryCode);
    if (psu) params.set('psu_type', psu);
    const query = params.toString();

    try {
      const res = await fetch(`${ENABLE_BANKING_API_BASE}/aspsps${query ? `?${query}` : ''}`, {
        headers: await this.authHeaders()
      });
      if (!res.ok) {
        console.warn(`[BankService] /aspsps failed (${res.status}), using the built-in bank list.`);
        return { list: SUPPORTED_GREEK_BANKS, live: false };
      }

      const data = await res.json();
      const list = Array.isArray(data && data.aspsps) && data.aspsps.length > 0
        ? data.aspsps
        : SUPPORTED_GREEK_BANKS;
      const live = list !== SUPPORTED_GREEK_BANKS;
      _aspspCache.set(cacheKey, { at: Date.now(), list, live });
      return { list, live };
    } catch (err) {
      console.warn('[BankService] Error fetching ASPSPs:', err);
      return { list: SUPPORTED_GREEK_BANKS, live: false };
    }
  }

  async getAspspList(options = {}) {
    return (await this._loadAspsps(options)).list;
  }

  /**
   * Resolve the provider's exact `{ name, country }` for the bank the user
   * picked, plus the metadata that bank requires (consent ceiling, PSU headers).
   * @returns {Promise<null|{name:string,country:string,maximumConsentValidity:number|null,requiredPsuHeaders:string[],psuTypes:string[],logo:string|null}>}
   */
  async resolveAspsp({ bankName, country = 'GR' } = {}) {
    const wantedName = String(bankName || '').trim();
    if (!canonicalBankKey(wantedName)) return null;

    const preferred = await this._loadAspsps({ country });
    let live = preferred.live;
    let match = findAspsp(preferred.list, wantedName);

    if (!match) {
      // Revolut and other digital banks are published under their own country,
      // so a second, country-agnostic lookup is required before giving up.
      const anywhere = await this._loadAspsps({});
      live = live || anywhere.live;
      match = findAspsp(anywhere.list, wantedName);
    }

    if (match) {
      const maxValidity = Number(match.maximum_consent_validity);
      return {
        name: String(match.name || wantedName),
        country: String(match.country || country || 'GR').toUpperCase(),
        maximumConsentValidity: Number.isFinite(maxValidity) ? maxValidity : null,
        requiredPsuHeaders: Array.isArray(match.required_psu_headers) ? match.required_psu_headers : [],
        psuTypes: Array.isArray(match.psu_types) ? match.psu_types : [],
        logo: match.logo || null
      };
    }

    // Provider unreachable → the built-in registry still describes the bank.
    if (!live) {
      const registryBank = SUPPORTED_GREEK_BANKS.find(
        (b) => canonicalBankKey(b.name) === canonicalBankKey(wantedName) ||
               canonicalBankKey(b.name_el) === canonicalBankKey(wantedName)
      );
      if (registryBank) {
        return {
          name: registryBank.name,
          country: registryBank.country,
          maximumConsentValidity: null,
          requiredPsuHeaders: [],
          psuTypes: [],
          logo: registryBank.logo
        };
      }
    }

    return null;
  }

  async getInstitutions(country = 'GR') {
    const detailed = await this.getInstitutionsDetailed(country);
    return detailed.institutions;
  }

  /** Institutions plus where they came from, so the UI can flag a fallback. */
  async getInstitutionsDetailed(country = 'GR') {
    if (!this.isConfigured) {
      return { institutions: SUPPORTED_GREEK_BANKS, source: 'builtin', configured: false };
    }
    const { list, live } = await this._loadAspsps({ country });
    return { institutions: list, source: live ? 'provider' : 'builtin', configured: true };
  }

  async startAuth({ bankName, country = 'GR', redirectUrl, state, psuType, language, psuHeaders }) {
    if (psuHeaders) this.setPsuHeaders(psuHeaders);

    if (!this.isConfigured) {
      // Mock Sandbox authorization flow for testing without API keys
      const sep = String(redirectUrl).includes('?') ? '&' : '?';
      return {
        url: `${redirectUrl}${sep}mock_auth_code=mock_code_${Date.now()}&bank=${encodeURIComponent(bankName)}`,
        sessionId: `mock_session_${Date.now()}`,
        authorizationId: null,
        aspsp: { name: bankName, country: String(country || 'GR').toUpperCase() },
        mock: true
      };
    }

    const aspsp = await this.resolveAspsp({ bankName, country });
    if (!aspsp) {
      const err = new Error(
        `Η τράπεζα "${bankName}" δεν είναι διαθέσιμη μέσω Open Banking (${country}). ` +
        'Επιλέξτε την τράπεζα από τη λίστα της εφαρμογής.'
      );
      err.code = 'ASPSP_NOT_FOUND';
      throw err;
    }

    const body = {
      access: {
        // Explicitly request both data sets: without them some ASPSPs grant an
        // empty consent and then reject /balances and /transactions.
        balances: true,
        transactions: true,
        valid_until: computeConsentValidUntil(aspsp.maximumConsentValidity)
      },
      aspsp: {
        name: aspsp.name,
        country: aspsp.country
      },
      state: state || 'default_state',
      redirect_url: redirectUrl,
      // Personal vs business login page. A mismatch makes the bank's SCA fail
      // or hides the user's accounts, which looks like a broken connection.
      psu_type: normalizePsuType(psuType),
      language: normalizeLanguage(language)
    };

    const res = await fetch(`${ENABLE_BANKING_API_BASE}/auth`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Enable Banking auth failed (${res.status}): ${errText}`);
      err.code = 'AUTH_FAILED';
      err.providerStatus = res.status;
      err.aspsp = aspsp;
      throw err;
    }

    const data = await res.json();
    // Enable Banking answers /auth with `authorization_id`; `session_id` only
    // exists on /sessions. Keep both keys for existing callers.
    const authorizationId = data.authorization_id || data.session_id || null;
    return {
      url: data.url,
      authorizationId,
      sessionId: authorizationId,
      aspsp: { name: aspsp.name, country: aspsp.country },
      mock: false
    };
  }

  async exchangeSession(code) {
    if (!this.isConfigured || String(code).startsWith('mock_code_')) {
      // Mock account for testing
      return {
        sessionId: `mock_sess_${Date.now()}`,
        accessValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        accounts: [
          {
            uid: `mock_acc_${Date.now()}`,
            iban: 'GR1601101250000000123456789',
            currency: 'EUR',
            accountName: 'Τρεχούμενος Λογαριασμός',
            balance: 1420.50
          }
        ]
      };
    }

    const res = await fetch(`${ENABLE_BANKING_API_BASE}/sessions`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Enable Banking exchange failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawAccounts = collectRawAccountsFromSession(data);
    const accounts = [];

    for (const acc of rawAccounts) {
      const uid = extractAccountUid(acc);
      if (!uid) continue;

      let bal = 0.0;
      let details = null;
      try {
        bal = await this.getAccountBalances(uid);
      } catch (e) {
        console.warn('[BankService] Error fetching balances for account:', uid, e);
      }
      try {
        details = await this.getAccountDetails(uid);
      } catch (e) {
        console.warn('[BankService] Error fetching details for account:', uid, e);
      }

      const isCard = isCardAccount(acc, details);
      const cardMask = isCard ? extractCardMask(acc, details) : null;
      const iban = (details && details.account_id && details.account_id.iban) ||
                   (acc && typeof acc === 'object' && acc.account_id && acc.account_id.iban) ||
                   (acc && typeof acc === 'object' && acc.iban) || null;
      const currency = (details && details.currency) || (acc && typeof acc === 'object' && acc.currency) || 'EUR';
      const accountName = formatAccountDisplayName(acc, details);

      accounts.push({
        uid: String(uid),
        iban,
        currency,
        accountName,
        balance: bal,
        isCard,
        accountType: isCard ? 'card' : 'bank',
        cardMask
      });
    }

    return {
      sessionId: data.session_id,
      accessValidUntil: data.access ? data.access.valid_until : null,
      accounts
    };
  }

  async getSession(sessionId) {
    if (!this.isConfigured || !sessionId || String(sessionId).startsWith('mock_sess_')) {
      return null;
    }
    try {
      const res = await fetch(`${ENABLE_BANKING_API_BASE}/sessions/${sessionId}`, {
        method: 'GET',
        headers: await this.authHeaders()
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[BankService] getSession failed for ${sessionId}:`, err);
      return null;
    }
  }

  async getAccountDetails(accountUid) {
    if (!this.isConfigured || !accountUid || String(accountUid).startsWith('mock_acc_')) {
      return null;
    }
    try {
      const res = await fetch(`${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/details`, {
        method: 'GET',
        headers: await this.authHeaders()
      });
      if (!res.ok) {
        console.warn(`[BankService] getAccountDetails failed (${res.status}) for ${accountUid}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[BankService] Failed to get details for ${accountUid}:`, err);
      return null;
    }
  }

  async getAccountBalances(accountUid) {
    if (!this.isConfigured || String(accountUid).startsWith('mock_acc_')) {
      return 1420.50;
    }

    try {
      const res = await fetch(`${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/balances`, {
        method: 'GET',
        headers: await this.authHeaders()
      });

      if (!res.ok) {
        console.warn(`[BankService] getAccountBalances failed (${res.status})`);
        return 0.0;
      }

      const data = await res.json();
      const primaryBal = pickPrimaryBalance(data.balances || []);
      if (primaryBal && primaryBal.balance_amount) {
        const amt = primaryBal.balance_amount.amount != null ? primaryBal.balance_amount.amount : primaryBal.balance_amount.value;
        return parseFloat(amt) || 0.0;
      }
      return 0.0;
    } catch (err) {
      console.warn('[BankService] Failed to get balances:', err);
      return 0.0;
    }
  }

  async getAccountTransactions(accountUid, options = {}) {
    if (!this.isConfigured || String(accountUid).startsWith('mock_acc_')) {
      // Return realistic mock Greek transactions for demonstration
      const today = new Date();
      const formatDate = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
      };

      return [
        {
          transactionId: `mock_tx_${Date.now()}_1`,
          date: formatDate(0),
          amount: -34.80,
          currency: 'EUR',
          description: 'ΣΚΛΑΒΕΝΙΤΗΣ ΑΘΗΝΑ',
          categorySuggestion: 'Σούπερ Μάρκετ'
        },
        {
          transactionId: `mock_tx_${Date.now()}_2`,
          date: formatDate(1),
          amount: -50.00,
          currency: 'EUR',
          description: 'EKO KAFSIMA PATRA',
          categorySuggestion: 'Μετακινήσεις & Καύσιμα'
        },
        {
          transactionId: `mock_tx_${Date.now()}_3`,
          date: formatDate(2),
          amount: -4.50,
          currency: 'EUR',
          description: 'COFFEE ISLAND SYNTAGMA',
          categorySuggestion: 'Καφές & Έξοδος'
        },
        {
          transactionId: `mock_tx_${Date.now()}_4`,
          date: formatDate(5),
          amount: 1450.00,
          currency: 'EUR',
          description: 'ΜΙΣΘΟΔΟΣΙΑ ΕΤΑΙΡΕΙΑΣ',
          categorySuggestion: 'Μισθός'
        }
      ];
    }

    const { dateFrom, dateTo, maxPages = 5, includePending = false } = options || {};
    const from = dateFrom || defaultTransactionsDateFrom();
    const collected = [];
    let continuationKey = null;

    for (let page = 0; page < Math.max(1, maxPages); page++) {
      const params = new URLSearchParams({ date_from: String(from) });
      if (dateTo) params.set('date_to', String(dateTo));
      if (continuationKey) params.set('continuation_key', continuationKey);

      const res = await fetch(
        `${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/transactions?${params.toString()}`,
        {
          method: 'GET',
          headers: await this.authHeaders()
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Enable Banking get transactions failed (${res.status}): ${errText}`);
        err.providerStatus = res.status;
        throw err;
      }

      const data = await res.json();
      const pageTransactions = Array.isArray(data.transactions) ? data.transactions : [];
      for (const raw of pageTransactions) {
        const mapped = mapProviderTransaction(raw, { includePending });
        if (mapped) collected.push(mapped);
      }

      // Banks paginate with an opaque continuation_key; ignoring it imported
      // only the first page, which looked like "missing transactions".
      continuationKey = data.continuation_key || null;
      if (!continuationKey || pageTransactions.length === 0) break;
    }

    // Newest first: importBankTransactions() keeps only the first N rows, so the
    // order decides whether the user's latest activity is imported at all.
    return collected.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
}

// ---------------------------------------------------------------------------
// Shared transaction import helpers
//
// Used by both /api/bank-sync (manual / background sync) and /api/bank-callback
// (right after a bank authorization is completed) so a freshly connected bank
// already has its transactions in Supabase, no matter which client version
// triggered the callback.
// ---------------------------------------------------------------------------

export function inferCategoryFromDescription(desc, isIncome) {
  const s = String(desc || '').toLowerCase();

  if (isIncome) {
    if (s.includes('μισθοδοσ') || s.includes('salary') || s.includes('payroll')) return 'Μισθός';
    if (s.includes('ενοικ') || s.includes('rent')) return 'Ενοίκια';
    if (s.includes('επιστροφ') || s.includes('refund') || s.includes('cashback')) return 'Cashback / Επιστροφή';
    return 'Άλλα Έσοδα';
  }

  // Supermarkets
  if (s.includes('sklavenitis') || s.includes('σκλαβενιτ') || s.includes('ab ') || s.includes('vassilopoulos') ||
      s.includes('βασιλοπουλ') || s.includes('lidl') || s.includes('mymarket') || s.includes('masoutis') ||
      s.includes('μασουτ') || s.includes('market in') || s.includes('galaxias') || s.includes('γαλαξιας') ||
      s.includes('bazaar') || s.includes('supermarket') || s.includes('σουπερ μαρκετ')) {
    return 'Σούπερ Μάρκετ';
  }
  // Coffee & Dining
  if (s.includes('coffee') || s.includes('kafe') || s.includes('everest') || s.includes('gregorys') ||
      s.includes('mikel') || s.includes('starbucks') || s.includes('flocaf') || s.includes('e-food') ||
      s.includes('efood') || s.includes('wolt') || s.includes('σουβλακ') || s.includes('pizza') ||
      s.includes('tavern') || s.includes('restaurant') || s.includes('burger')) {
    return 'Φαγητό';
  }
  // Transport & Fuel
  if (s.includes('eko') || s.includes('shell') || s.includes('bp ') || s.includes('avet') ||
      s.includes('avinoil') || s.includes('revoil') || s.includes('cyclon') || s.includes('βενζιν') ||
      s.includes('fuel') || s.includes('oasa') || s.includes('attiki odos') || s.includes('διοδια') ||
      s.includes('taxi') || s.includes('uber') || s.includes('freenow')) {
    return 'Μετακινήσεις';
  }
  // Bills & Utilities
  if (s.includes('dei') || s.includes('δεη') || s.includes('protergia') || s.includes('heron') ||
      s.includes('ηρων') || s.includes('cosmote') || s.includes('vodafone') || s.includes('nova') ||
      s.includes('eydap') || s.includes('ευδαπ') || s.includes('dpa') || s.includes('enoseis') ||
      s.includes('ote') || s.includes('wind')) {
    return 'Λογαριασμοί';
  }
  // Health
  if (s.includes('pharm') || s.includes('φαρμακ') || s.includes('doctor') || s.includes('iatreio') ||
      s.includes('ιατρ') || s.includes('dentist') || s.includes('νοσοκομ')) {
    return 'Υγεία';
  }
  // Entertainment & Shopping
  if (s.includes('netflix') || s.includes('spotify') || s.includes('cinema') || s.includes('village') ||
      s.includes('theatre') || s.includes('zara') || s.includes('h&m') || s.includes('public') ||
      s.includes('plaisio') || s.includes('amazon') || s.includes('skroutz')) {
    return 'Ψώνια';
  }

  return 'Γενικά Έξοδα';
}

async function insertTransactionRows({ supabaseUrl, serviceRoleKey, rows }) {
  if (!rows.length) return [];

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(rows)
  });

  if (insertRes.ok) {
    const created = await insertRes.json();
    return Array.isArray(created) ? created : [];
  }

  // Batch insert failed (e.g. one conflicting row) → retry one by one so a single
  // bad transaction never blocks the rest of the import.
  console.warn('[BankService] Batch transaction insert failed, falling back to per-row:', (await insertRes.text()).slice(0, 200));
  const createdRows = [];
  for (const row of rows) {
    try {
      const singleRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(row)
      });
      if (singleRes.ok) {
        const [createdRow] = await singleRes.json();
        if (createdRow) createdRows.push(createdRow);
      }
    } catch (e) {
      console.warn('[BankService] Failed to insert bank transaction:', e);
    }
  }
  return createdRows;
}

/**
 * Import bank transactions for the given bank account rows into public.transactions.
 *
 * @param {object}      opts
 * @param {string}      opts.supabaseUrl
 * @param {string}      opts.serviceRoleKey
 * @param {string}      opts.userId
 * @param {BankService} opts.bankService
 * @param {Array}       opts.bankAccounts Rows with at least `account_uid` (optionally `id`, `account_name`)
 * @param {number}      [opts.maxPerAccount=400]
 * @returns {Promise<{syncedCount:number, transactions:Array, errors:Array<{account_uid:string,status:number|null,message:string}>}>}
 *   `errors` lists the accounts that could not be imported (revoked/insufficient
 *   consent, provider outage) so callers can warn the user instead of reporting
 *   a successful "all up to date" sync.
 */
export async function importBankTransactions({
  supabaseUrl,
  serviceRoleKey,
  userId,
  bankService,
  bankAccounts,
  maxPerAccount = 400
}) {
  const result = { syncedCount: 0, transactions: [], errors: [] };
  const headers = {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`
  };

  for (const acct of (bankAccounts || [])) {
    if (!acct || !acct.account_uid) continue;

    try {
      const rawTxs = await bankService.getAccountTransactions(acct.account_uid);
      if (!Array.isArray(rawTxs) || rawTxs.length === 0) continue;

      const recentTxs = rawTxs.slice(0, maxPerAccount);
      const txIds = recentTxs.map(t => t && t.transactionId).filter(Boolean);

      // Deduplicate against already imported bank transactions
      const existing = new Set();
      for (let i = 0; i < txIds.length; i += 80) {
        const chunk = txIds.slice(i, i + 80);
        const existingRes = await fetch(
          `${supabaseUrl}/rest/v1/transactions?user_id=eq.${encodeURIComponent(userId)}` +
          `&bank_transaction_id=in.(${chunk.map(encodeURIComponent).join(',')})&select=bank_transaction_id`,
          { headers }
        );
        if (existingRes.ok) {
          const rows = await existingRes.json();
          if (Array.isArray(rows)) rows.forEach(r => existing.add(r.bank_transaction_id));
        }
      }

      const accountName = acct.account_name || 'Τράπεζα';
      const rows = [];
      for (const t of recentTxs) {
        if (!t || !t.transactionId || existing.has(t.transactionId)) continue;
        const amount = Number(t.amount);
        if (!Number.isFinite(amount) || amount === 0) continue;

        const isIncome = amount > 0;
        rows.push({
          user_id: userId,
          date: t.date,
          type: isIncome ? 'income' : 'expense',
          amount: Math.abs(amount),
          category: inferCategoryFromDescription(t.description || '', isIncome),
          account_from: accountName,
          note: t.description || 'Τραπεζική Συναλλαγή',
          currency: t.currency || 'EUR',
          bank_transaction_id: t.transactionId,
          bank_account_uid: acct.account_uid,
          status: 'active'
        });
        existing.add(t.transactionId);
      }

      if (rows.length > 0) {
        const created = await insertTransactionRows({ supabaseUrl, serviceRoleKey, rows });
        result.transactions.push(...created);
        result.syncedCount += created.length;
      }

      // Mark the bank account as freshly synced
      const syncFilter = acct.id
        ? `id=eq.${encodeURIComponent(acct.id)}`
        : `account_uid=eq.${encodeURIComponent(acct.account_uid)}&user_id=eq.${encodeURIComponent(userId)}`;
      await fetch(`${supabaseUrl}/rest/v1/bank_accounts?${syncFilter}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_synced_at: new Date().toISOString() })
      });
    } catch (acctErr) {
      // Keep syncing the remaining accounts, but report the failure: a 403 here
      // means the consent does not include transactions (or has expired) and
      // the user has to re-authorise the bank instead of seeing "up to date".
      const message = acctErr && acctErr.message ? acctErr.message : String(acctErr);
      result.errors.push({
        account_uid: acct.account_uid,
        status: (acctErr && acctErr.providerStatus) || null,
        message: message.slice(0, 300)
      });
      console.warn(`[BankService] Error importing transactions for account ${acct.account_uid}:`, acctErr);
    }
  }

  return result;
}

