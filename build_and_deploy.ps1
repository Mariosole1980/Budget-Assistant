# Set console output encoding to UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location "C:\Users\mario\Desktop\money-manager"

Write-Host "[INFO] Starting Build & Deploy Automation Script..." -ForegroundColor Cyan

# 1. Version Bump
Write-Host "[INFO] Bumping version numbers..." -ForegroundColor Yellow

# Read sw.js and bump SW version
$swPath = "sw.js"
$swContent = Get-Content $swPath -Raw
if ($swContent -match '// SW Version (\d+)') {
    $currentSW = [int]$Matches[1]
    $newSW = $currentSW + 1
    $swContent = $swContent -replace '// SW Version \d+', "// SW Version $newSW"
    Set-Content $swPath $swContent -NoNewline
    Write-Host "  [SUCCESS] Service Worker version bumped: $currentSW -> $newSW" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Could not find SW Version in sw.js" -ForegroundColor Yellow
}

# Read app.js and bump build version
$appPath = "app.js"
$appContent = Get-Content $appPath -Raw
# We will replace all occurrences of build vXXX in app.js
if ($appContent -match 'build v(\d+)') {
    $currentBuild = [int]$Matches[1]
    $newBuild = $currentBuild + 1
    $appContent = $appContent -replace 'build v\d+', "build v$newBuild"
    Set-Content $appPath $appContent -NoNewline
    Write-Host "  [SUCCESS] App build version bumped: $currentBuild -> $newBuild" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Could not find build version in app.js" -ForegroundColor Yellow
}

# Read index.html and bump build version
$indexPath = "index.html"
$indexContent = Get-Content $indexPath -Raw
if ($indexContent -match 'build v(\d+)') {
    $indexContent = $indexContent -replace 'build v\d+', "build v$newBuild"
    $indexContent = $indexContent -replace 'const CURRENT_BUILD = \d+;', "const CURRENT_BUILD = $newBuild;"
    # Also update the versioned SW URL (sw.js?v=OLD → sw.js?v=NEW)
    $indexContent = $indexContent -replace "sw\.js\?v=\d+", "sw.js?v=$newBuild"
    Set-Content $indexPath $indexContent -NoNewline
    Write-Host "  [SUCCESS] Index.html build version bumped to v$newBuild (SW URL: sw.js?v=$newBuild)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Could not find build version in index.html" -ForegroundColor Yellow
}

# Write version.json file
$versionJsonPath = "version.json"
$versionJsonContent = '{"version": ' + $newBuild + '}'
Set-Content $versionJsonPath $versionJsonContent -NoNewline
Write-Host "  [SUCCESS] Created version.json with version $newBuild" -ForegroundColor Green

# 2. Copy files to www folder
Write-Host "[INFO] Copying assets to www/ folder..." -ForegroundColor Yellow
if (!(Test-Path www)) {
    New-Item -ItemType Directory -Path www -Force | Out-Null
}
Copy-Item app.js www/app.js -Force
Copy-Item index.html www/index.html -Force
Copy-Item style.css www/style.css -Force
Copy-Item sw.js www/sw.js -Force
Copy-Item manifest.json www/manifest.json -Force
Copy-Item icon.png www/icon.png -Force
Copy-Item xlsx.full.min.js www/xlsx.full.min.js -Force
Copy-Item version.json www/version.json -Force
Copy-Item _headers www/_headers -Force
Copy-Item clear.html www/clear.html -Force
Write-Host "  [SUCCESS] Files copied successfully." -ForegroundColor Green

# 3. Capacitor Sync
Write-Host "[INFO] Running npx cap sync..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Capacitor Sync failed!" -ForegroundColor Red
    Exit 1
}
Write-Host "  [SUCCESS] Capacitor Sync complete." -ForegroundColor Green

# 4. Gradle Android APK Build
Write-Host "[INFO] Building Android APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Push-Location android
.\gradlew.bat assembleDebug
$gradleExit = $LASTEXITCODE
Pop-Location

if ($gradleExit -ne 0) {
    Write-Host "[ERROR] Gradle build failed!" -ForegroundColor Red
    Exit 1
}
Write-Host "  [SUCCESS] Android APK built successfully." -ForegroundColor Green

# 5. Copy APK to Desktop
Write-Host "[INFO] Copying APK to Desktop..." -ForegroundColor Yellow
$apkSource = "android\app\build\outputs\apk\debug\app-debug.apk"
$desktopDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"))
if (Test-Path $apkSource) {
    Copy-Item $apkSource "$desktopDir\BudgetAssistant.apk" -Force
    Copy-Item $apkSource "$desktopDir\BudgetAssistant-debug.apk" -Force
    Write-Host "  [SUCCESS] APK copied to Desktop as BudgetAssistant.apk and BudgetAssistant-debug.apk" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Source APK not found at $apkSource" -ForegroundColor Red
    Exit 1
}

# 6. Wrangler Deploy to Cloudflare Pages
Write-Host "[INFO] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
$env:PATH += ';C:\Program Files\nodejs;C:\Users\mario\AppData\Roaming\npm'

Write-Host "  [DEPLOY] Deploying to budget-assistant-pwa..." -ForegroundColor Yellow
wrangler pages deploy www --project-name=budget-assistant-pwa --branch=main
$deploy1 = $LASTEXITCODE

Write-Host "  [DEPLOY] Deploying to money-manager-pwa..." -ForegroundColor Yellow
wrangler pages deploy www --project-name=money-manager-pwa --branch=main
$deploy2 = $LASTEXITCODE

if ($deploy1 -ne 0 -or $deploy2 -ne 0) {
    Write-Host "[ERROR] Wrangler deployment failed on one or both projects!" -ForegroundColor Red
    Exit 1
}
Write-Host "[SUCCESS] All steps completed successfully! Build is live at both URLs:" -ForegroundColor Green
Write-Host "  - https://budget-assistant-pwa.pages.dev" -ForegroundColor Green
Write-Host "  - https://money-manager-pwa.pages.dev" -ForegroundColor Green
