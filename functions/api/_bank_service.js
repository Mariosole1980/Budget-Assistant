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

// Built-in registry of Greek ASPSPs (banks)
export const SUPPORTED_GREEK_BANKS = [
  {
    name: 'National Bank of Greece',
    name_el: 'Εθνική Τράπεζα (NBG)',
    code: 'NBG',
    country: 'GR',
    logo: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=64&q=80',
    color: '#004f80'
  },
  {
    name: 'Eurobank',
    name_el: 'Eurobank',
    code: 'EUROBANK',
    country: 'GR',
    logo: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=64&q=80',
    color: '#d6001c'
  },
  {
    name: 'Alpha Bank',
    name_el: 'Alpha Bank',
    code: 'ALPHA',
    country: 'GR',
    logo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=64&q=80',
    color: '#002663'
  },
  {
    name: 'Piraeus Bank',
    name_el: 'Τράπεζα Πειραιώς',
    code: 'PIRAEUS',
    country: 'GR',
    logo: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=64&q=80',
    color: '#fdb913'
  },
  {
    name: 'Revolut',
    name_el: 'Revolut',
    code: 'REVOLUT',
    country: 'GB',
    logo: 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?w=64&q=80',
    color: '#0075eb'
  }
];

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

export class BankService {
  constructor(env) {
    this.env = env || {};
    this.appId = this.env.ENABLE_BANKING_APP_ID;
    this.privateKey = this.env.ENABLE_BANKING_PRIVATE_KEY;
    this.isConfigured = Boolean(this.appId && this.privateKey);
  }

  async getJwt() {
    if (!this.isConfigured) {
      return null;
    }
    return await createEnableBankingJwt(this.appId, this.privateKey);
  }

  async getInstitutions(country = 'GR') {
    if (!this.isConfigured) {
      return SUPPORTED_GREEK_BANKS;
    }

    try {
      const jwt = await this.getJwt();
      const res = await fetch(`${ENABLE_BANKING_API_BASE}/aspsps?country=${country}`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        console.warn('[BankService] Failed to fetch ASPSPs from Enable Banking, falling back to built-in list.');
        return SUPPORTED_GREEK_BANKS;
      }
      const data = await res.json();
      return data.aspsps || SUPPORTED_GREEK_BANKS;
    } catch (err) {
      console.warn('[BankService] Error fetching ASPSPs:', err);
      return SUPPORTED_GREEK_BANKS;
    }
  }

  async startAuth({ bankName, country = 'GR', redirectUrl, state }) {
    if (!this.isConfigured) {
      // Mock Sandbox authorization flow for testing without API keys
      const sep = redirectUrl.includes('?') ? '&' : '?';
      return {
        url: `${redirectUrl}${sep}mock_auth_code=mock_code_${Date.now()}&bank=${encodeURIComponent(bankName)}`,
        sessionId: `mock_session_${Date.now()}`
      };
    }

    const jwt = await this.getJwt();
    // PSD2 consent validity: 90 days from now
    const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const body = {
      access: {
        valid_until: validUntil
      },
      aspsp: {
        name: bankName,
        country: country
      },
      state: state || 'default_state',
      redirect_url: redirectUrl
    };

    const res = await fetch(`${ENABLE_BANKING_API_BASE}/auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Enable Banking auth failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      url: data.url,
      sessionId: data.session_id
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

    const jwt = await this.getJwt();
    const res = await fetch(`${ENABLE_BANKING_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Enable Banking exchange failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const accounts = (data.accounts || []).map(acc => ({
      uid: acc.uid,
      iban: acc.account_id ? acc.account_id.iban : null,
      currency: acc.currency || 'EUR',
      accountName: acc.details || 'Τραπεζικός Λογαριασμός',
      balance: 0.0
    }));

    return {
      sessionId: data.session_id,
      accessValidUntil: data.access ? data.access.valid_until : null,
      accounts
    };
  }

  async getAccountTransactions(accountUid) {
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

    const jwt = await this.getJwt();
    const res = await fetch(`${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/transactions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Enable Banking get transactions failed: ${errText}`);
    }

    const data = await res.json();
    const transactions = (data.transactions || []).map(tx => {
      const amtObj = tx.transaction_amount || {};
      const rawAmount = parseFloat(amtObj.amount || 0);
      const desc = (tx.remittance_information && tx.remittance_information[0]) ||
                   tx.creditor_name ||
                   tx.debtor_name ||
                   'Τραπεζική Συναλλαγή';

      return {
        transactionId: tx.entry_reference || tx.transaction_id || `tx_${Math.random()}`,
        date: tx.booking_date || tx.value_date || new Date().toISOString().split('T')[0],
        amount: rawAmount,
        currency: amtObj.currency || 'EUR',
        description: desc
      };
    });

    return transactions;
  }
}
