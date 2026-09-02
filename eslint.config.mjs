// eslint.config.mjs
// ESLint v9 flat config for Budget Assistant.
//
// All rules are WARN (not error) — gives visibility without blocking releases.
// Tighten rules per-module as code is extracted.

import globals from 'globals';

export default [
  // Ignores (vendored libs + build artifacts)
  {
    ignores: [
      'www/**',
      'android/**',
      'backups/**',
      'archive/**',
      'scratch/**',
      'node_modules/**',
      'js/supabase.js',
      'js/chart.js',
      'js/chartjs-plugin-datalabels.js',
      'js/sortable.min.js',
      'xlsx.full.min.js',
      'ota-boot-loader.js',
    ],
  },

  // Browser application files (app.js, web-ui.js, js/ modules)
  {
    files: [
      'app.js',
      'web-ui.js',
      'js/NLPProcessor.js',
      'js/MemoryEngine.js',
      'js/DecisionEngine.js',
      'js/OnlineAIProvider.js',
      'js/AIEngine.js',
      'js/IntentCorpus.js',
      'js/KnowledgeGraph.js',
      'js/CurrencyService.js',
      'js/categoryIcons.js',
      'js/translations.js',
      'js/transactionMerge.js',
      'js/utils.js',
      'js/constants.js',
      'js/receiptStorage.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Cross-file globals exposed by js/* modules
        CurrencyService: 'readonly',
        TransactionMerge: 'readonly',
        BAUtils: 'readonly',
        BAConstants: 'readonly',
        AIEngine: 'readonly',
        NLPProcessor: 'readonly',
        MemoryEngine: 'readonly',
        DecisionEngine: 'readonly',
        OnlineAIProvider: 'readonly',
        IntentCorpus: 'readonly',
        KnowledgeGraph: 'readonly',
        CategoryIcons: 'readonly',
        TRANSLATIONS: 'readonly',
        ReceiptStorage: 'readonly',
        // Third-party libs
        Capacitor: 'readonly',
        Chart: 'readonly',
        Sortable: 'readonly',
        XLSX: 'readonly',
        // UMD pattern: `typeof module !== 'undefined'` — valid in browser context
        // (always false at runtime, but ESLint doesn't evaluate typeof guards)
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-console': 'off',
    },
  },

  // Node.js scripts + tests
  {
    files: ['scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-console': 'off',
    },
  },

  // Cloudflare Pages Functions (ES modules)
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        addEventListener: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-console': 'off',
    },
  },
];
