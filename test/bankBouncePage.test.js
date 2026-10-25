const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Tests for the mobile bounce page that lives at the top of index.html
// ("1.5. Mobile In-App Browser OAuth / Open Banking Bounce to Native App").
//
// The bank returns the user to the https callback URL, which opens in the
// device browser (not the app). That page is the last point where the
// authorization code is still known, so it must:
//   1. complete the connection server-side (POST /api/bank-callback), so a
//      broken/missing deep link can no longer lose the connection, and
//   2. hand the payload back to the app through the custom scheme declared in
//      AndroidManifest.xml (the https App Links are not verified).
//
// The block is extracted from index.html and executed against mocked browser
// globals, so the assertions describe real behaviour instead of source strings.
// ---------------------------------------------------------------------------

const rootDir = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractBounceBlock() {
  const startMarker = '// 1.5. Mobile In-App Browser OAuth / Open Banking Bounce to Native App';
  const endMarker = '// 2. Recovery Mode Bootloader';
  const startIdx = indexHtml.indexOf(startMarker);
  assert.notEqual(startIdx, -1, 'bounce block marker not found in index.html');
  const endIdx = indexHtml.indexOf(endMarker, startIdx);
  assert.notEqual(endIdx, -1, 'bounce block end marker not found in index.html');

  let block = indexHtml.slice(startIdx, endIdx);
  const iifeStart = block.indexOf('(function () {');
  assert.notEqual(iifeStart, -1, 'bounce IIFE not found in index.html');
  block = block.slice(iifeStart);
  const closing = block.lastIndexOf('})();');
  assert.notEqual(closing, -1, 'bounce IIFE is not closed');
  return block.slice(0, closing + 5);
}

const bounceSource = extractBounceBlock();

function runBounce({ url, userAgent = MOBILE_UA, native = false }) {
  const parsed = new URL(url);
  const navigations = [];
  const fetches = [];
  const timers = [];
  const warnings = [];
  let bodyHtml = null;

  const locationMock = {};
  let currentHref = parsed.origin + parsed.pathname;
  Object.defineProperty(locationMock, 'href', {
    get() { return currentHref; },
    set(value) {
      navigations.push(value);
      currentHref = value;
    }
  });
  locationMock.search = parsed.search;
  locationMock.hash = parsed.hash;
  locationMock.origin = parsed.origin;
  locationMock.pathname = parsed.pathname;

  const windowMock = { location: locationMock };
  if (native) {
    windowMock.Capacitor = { isNativePlatform: () => true };
  }

  const bodyMock = {};
  Object.defineProperty(bodyMock, 'innerHTML', {
    get() { return bodyHtml; },
    set(value) { bodyHtml = value; }
  });

  const documentMock = {
    body: bodyMock,
    head: { appendChild() {} },
    createElement() { return { style: {}, innerHTML: '', addEventListener() {} }; },
    getElementById() { return null; },
    addEventListener() {}
  };

  const fetchMock = (fetchUrl, options) => {
    fetches.push({ url: fetchUrl, options: options || {} });
    return Promise.resolve({ ok: true, status: 200 });
  };

  const setTimeoutMock = (fn, delay) => {
    timers.push({ fn, delay });
    return timers.length;
  };

  const consoleMock = {
    log() {},
    warn(...args) { warnings.push(args.join(' ')); },
    error(...args) { warnings.push(args.join(' ')); }
  };

  const run = new Function(
    'window',
    'document',
    'navigator',
    'fetch',
    'setTimeout',
    'console',
    'URLSearchParams',
    bounceSource
  );
  run(windowMock, documentMock, { userAgent }, fetchMock, setTimeoutMock, consoleMock, URLSearchParams);

  return {
    navigations,
    fetches,
    timers,
    warnings,
    getBodyHtml: () => bodyHtml
  };
}

const STATE_JSON = JSON.stringify({ userId: 'user-1', bankName: 'Eurobank', timestamp: 1700000000000 });
const BANK_CALLBACK_URL =
  'https://www.budgetassistant.org/?code=auth-code-1&state=' + encodeURIComponent(STATE_JSON);

test('bounce page completes a bank callback server-side and redirects to the app', () => {
  const { fetches, navigations } = runBounce({ url: BANK_CALLBACK_URL });

  assert.equal(fetches.length, 1, 'the bank callback must be completed server-side exactly once');
  const request = fetches[0];
  assert.equal(request.url, '/api/bank-callback');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.keepalive, true, 'keepalive keeps the POST alive while the app opens');
  assert.equal(request.options.headers['Content-Type'], 'application/json');

  const body = JSON.parse(request.options.body);
  assert.equal(body.code, 'auth-code-1');
  assert.equal(body.state, STATE_JSON, 'the JSON state blob from /api/bank-auth must be forwarded verbatim');

  // Query-only payloads go through intent:// first (it cannot carry a fragment).
  const parsed = new URL(BANK_CALLBACK_URL);
  assert.equal(navigations[0], 'intent://login-callback' + parsed.search +
    '#Intent;scheme=com.budgetassistant.app;package=com.budgetassistant.app;end');
});

test('bounce page treats an explicit bank flag as a bank callback', () => {
  const { fetches } = runBounce({ url: 'https://www.budgetassistant.org/?code=auth-code-2&bank=Eurobank' });

  assert.equal(fetches.length, 1);
  const body = JSON.parse(fetches[0].options.body);
  assert.equal(body.code, 'auth-code-2');
  assert.equal(body.state, null);
  assert.equal(body.bankName, 'Eurobank', 'the bank name must survive so the connection is not stored as generic "Bank"');
});

test('bounce page does not post a Supabase PKCE code to the bank endpoint', () => {
  const { fetches, navigations } = runBounce({ url: 'https://www.budgetassistant.org/?code=pkce-login-code' });

  assert.equal(fetches.length, 0, 'a bare `code` belongs to the PKCE login flow');
  assert.equal(navigations.length, 1, 'the PKCE code still has to reach the app');
  assert.ok(navigations[0].startsWith('intent://login-callback'));
  assert.ok(navigations[0].includes('scheme=com.budgetassistant.app'));
});

test('bounce page prefers the custom scheme when the payload is in the hash', () => {
  const url = 'https://www.budgetassistant.org/?code=auth-code-3#state=' + encodeURIComponent(STATE_JSON);
  const { navigations, fetches } = runBounce({ url });

  assert.equal(fetches.length, 1);
  const body = JSON.parse(fetches[0].options.body);
  assert.equal(body.state, STATE_JSON, 'the hash state must reach the server too');
  const parsed = new URL(url);
  assert.equal(navigations[0], 'com.budgetassistant.app://login-callback' + parsed.search + parsed.hash);
});

test('bounce page schedules a second redirect attempt and a manual fallback UI', () => {
  const { timers, navigations, getBodyHtml } = runBounce({ url: BANK_CALLBACK_URL });

  assert.equal(timers.length, 2, 'a retry and a fallback UI must both be scheduled');
  assert.equal(timers[0].delay, 900);
  assert.equal(timers[1].delay, 1800);

  timers[0].fn();
  assert.equal(navigations.length, 2);
  assert.ok(
    navigations[1].startsWith('com.budgetassistant.app://login-callback'),
    'the retry must fall back to the custom scheme'
  );

  timers[1].fn();
  const html = getBodyHtml();
  assert.ok(html, 'the fallback UI must be rendered when the app did not open');
  assert.ok(html.includes('Άνοιγμα Εφαρμογής'), 'the fallback UI needs a manual open button');
  assert.ok(
    html.includes('href="com.budgetassistant.app://login-callback'),
    'the manual button must use the custom scheme, which every Android browser can hand off'
  );
});

test('bounce page ignores desktop browsers and the already-native WebView', () => {
  const desktop = runBounce({ url: BANK_CALLBACK_URL, userAgent: DESKTOP_UA });
  assert.equal(desktop.fetches.length, 0);
  assert.equal(desktop.navigations.length, 0);
  assert.equal(desktop.timers.length, 0);

  const native = runBounce({ url: BANK_CALLBACK_URL, native: true });
  assert.equal(native.fetches.length, 0);
  assert.equal(native.navigations.length, 0);
  assert.equal(native.timers.length, 0);
});

test('the native shell registers the custom scheme and forwards incoming intents', () => {
  const manifest = fs.readFileSync(
    path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );
  assert.ok(
    manifest.includes('<data android:scheme="com.budgetassistant.app" />'),
    'the bounce redirect target must be declared by an intent-filter'
  );
  assert.ok(
    manifest.includes('<data android:scheme="budgetassistant" />'),
    'the legacy scheme stays declared for the OAuth flow'
  );

  const mainActivity = fs.readFileSync(
    path.join(rootDir, 'android', 'app', 'src', 'main', 'java', 'com', 'budgetassistant', 'app', 'MainActivity.java'),
    'utf8'
  );
  assert.ok(mainActivity.includes('protected void onNewIntent(Intent intent)'), 'MainActivity must override onNewIntent');
  assert.ok(mainActivity.includes('super.onNewIntent(intent)'), 'the Capacitor bridge only sees links through super');
  assert.ok(mainActivity.includes('setIntent(intent)'), 'the launch intent must be refreshed for getLaunchUrl');
});

// ---------------------------------------------------------------------------
// "/" is served by functions/index.js -> landing.html, and "/app" by
// functions/app.js -> index.html. The open-banking redirect URL is
// /index.html, which Cloudflare Pages 308-redirects to "/?code=..&state=..",
// so a bank callback physically lands on the landing page. The landing page
// therefore has to forward every auth payload to the app document, otherwise
// the bounce block above never executes and the connection is lost.
// ---------------------------------------------------------------------------

const landingHtml = fs.readFileSync(path.join(rootDir, 'landing.html'), 'utf8');

function extractLandingRedirect() {
  const marker = 'var hasAuthParams';
  const markerIdx = landingHtml.indexOf(marker);
  assert.notEqual(markerIdx, -1, 'landing.html must forward auth payloads to the app document');
  const startIdx = landingHtml.lastIndexOf('(function () {', markerIdx);
  assert.notEqual(startIdx, -1, 'landing redirect IIFE not found in landing.html');
  const endIdx = landingHtml.indexOf('})();', markerIdx);
  assert.notEqual(endIdx, -1, 'landing redirect IIFE is not closed');
  return landingHtml.slice(startIdx, endIdx + 5);
}

const landingSource = extractLandingRedirect();

function runLanding({ url, standalone = false, session = false }) {
  const parsed = new URL(url);
  const replacements = [];
  const locationMock = {
    search: parsed.search,
    hash: parsed.hash,
    href: url,
    replace(value) { replacements.push(value); }
  };

  const store = {};
  if (session) store.currentUser = 'user-1';
  const localStorageMock = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    key(index) { return Object.keys(store)[index] || null; },
    get length() { return Object.keys(store).length; }
  };

  const windowMock = {
    location: locationMock,
    navigator: { standalone },
    matchMedia() { return { matches: false }; }
  };

  const run = new Function('window', 'localStorage', 'URLSearchParams', landingSource);
  run(windowMock, localStorageMock, URLSearchParams);

  return { replacements };
}

test('landing page forwards a bank callback to the app document', () => {
  const { replacements } = runLanding({ url: BANK_CALLBACK_URL });
  const parsed = new URL(BANK_CALLBACK_URL);

  assert.equal(replacements.length, 1, 'the callback must be handed to /app exactly once');
  assert.equal(replacements[0], '/app' + parsed.search + parsed.hash);
  assert.ok(
    replacements[0].includes('code=auth-code-1'),
    'the authorization code must survive the /index.html -> / 308 redirect'
  );
});

test('landing page forwards OAuth hash tokens to the app document', () => {
  const url = 'https://www.budgetassistant.org/#access_token=token-1&refresh_token=refresh-1';
  const { replacements } = runLanding({ url });

  assert.equal(replacements.length, 1);
  assert.equal(replacements[0], '/app' + new URL(url).search + new URL(url).hash);
});

test('landing page keeps marketing visitors and the explicit opt-out on the page', () => {
  assert.deepEqual(runLanding({ url: 'https://www.budgetassistant.org/' }).replacements, []);
  assert.deepEqual(
    runLanding({ url: 'https://www.budgetassistant.org/?code=auth-code-1&landing=1' }).replacements,
    [],
    '?landing is a deliberate opt-out and must win over the auth forwarding'
  );
});

test('landing page still sends returning users and installed PWAs to the app', () => {
  const returning = runLanding({ url: 'https://www.budgetassistant.org/', session: true });
  assert.deepEqual(returning.replacements, ['/app']);

  const standalone = runLanding({ url: 'https://www.budgetassistant.org/', standalone: true });
  assert.deepEqual(standalone.replacements, ['/app']);
});

test('Cloudflare routes serve "/" from landing.html and "/app" from index.html', () => {
  const indexFn = fs.readFileSync(path.join(rootDir, 'functions', 'index.js'), 'utf8');
  const appFn = fs.readFileSync(path.join(rootDir, 'functions', 'app.js'), 'utf8');

  assert.ok(indexFn.includes("'/landing.html'"), '"/" must map to the landing page');
  assert.ok(appFn.includes("'/index.html'"), '"/app" must map to the app document');
  assert.ok(
    landingHtml.includes('<link rel="manifest"'),
    'sanity: the file read as the landing page really is landing.html'
  );
});

