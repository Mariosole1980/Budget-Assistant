const fs = require('fs');
const path = require('path');

const billingPluginPath = path.resolve(__dirname, '..', 'node_modules', 'capacitor-billing', 'android', 'src', 'main', 'java', 'de', 'carstenklaffke', 'billing', 'BillingPlugin.java');

if (fs.existsSync(billingPluginPath)) {
  let code = fs.readFileSync(billingPluginPath, 'utf8');

  if (!code.includes('PendingPurchasesParams')) {
    code = code.replace(
      'import com.android.billingclient.api.BillingResult;',
      'import com.android.billingclient.api.BillingResult;\nimport com.android.billingclient.api.PendingPurchasesParams;'
    );
  }

  if (code.includes('.enablePendingPurchases()')) {
    const newCreateMethod = `    private BillingClient createNewBillingClient(PurchasesUpdatedListener listener) {
        PendingPurchasesParams pendingPurchasesParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();
        return BillingClient.newBuilder(bridge.getActivity())
                .setListener(listener)
                .enablePendingPurchases(pendingPurchasesParams)
                .build();
    }`;

    code = code.replace(
      /private BillingClient createNewBillingClient\(PurchasesUpdatedListener listener\) \{[\s\S]*?\.enablePendingPurchases\(\)[\s\S]*?\.build\(\);\s*\}/,
      newCreateMethod
    );
  }

  code = code.replace(
    /billingClient\.queryProductDetailsAsync\(params, \(billingResult1, productDetailsList\) -> \{/g,
    'billingClient.queryProductDetailsAsync(params, (billingResult1, productDetailsResult) -> {\n                        List<ProductDetails> productDetailsList = productDetailsResult != null ? productDetailsResult.getProductDetailsList() : null;'
  );

  fs.writeFileSync(billingPluginPath, code, 'utf8');
  console.log('  [PASS] Patched capacitor-billing for Google Play Billing Library 8.0.0');
}

const billingGradlePath = path.resolve(__dirname, '..', 'node_modules', 'capacitor-billing', 'android', 'build.gradle');
if (fs.existsSync(billingGradlePath)) {
  let gradle = fs.readFileSync(billingGradlePath, 'utf8');
  gradle = gradle.replace(/com\.android\.billingclient:billing:[\d\.]+/g, 'com.android.billingclient:billing:8.0.0');
  fs.writeFileSync(billingGradlePath, gradle, 'utf8');
  console.log('  [PASS] Patched capacitor-billing android/build.gradle to billing:8.0.0');
}
