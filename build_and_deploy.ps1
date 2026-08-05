param()

# Set console output encoding to UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location "C:\Users\mario\Desktop\budget-assistant"

Write-Host "[INFO] Starting Build & Deploy Automation Script..." -ForegroundColor Cyan

# 1. Version Bump
Write-Host "[INFO] Bumping version numbers..." -ForegroundColor Yellow

# Read version.json and determine new master build version
$versionJsonPath = "version.json"
$currentBuild = 838
if (Test-Path $versionJsonPath) {
    try {
        $vJson = Get-Content $versionJsonPath -Raw | ConvertFrom-Json
        if ($vJson.version) {
            $currentBuild = [int]$vJson.version
        }
    } catch {}
}
$newBuild = $currentBuild + 1
Write-Host "  [INFO] Version: $currentBuild → $newBuild" -ForegroundColor Cyan

# Update app.js
$appPath = "app.js"
$appContent = Get-Content $appPath -Raw
$appContent = $appContent -replace 'build v\d+', "build v$newBuild"
Set-Content $appPath $appContent -NoNewline
Write-Host "  [SUCCESS] App build version bumped: $currentBuild -> $newBuild" -ForegroundColor Green

# Update sw.js
$swPath = "sw.js"
$swContent = Get-Content $swPath -Raw
$swContent = $swContent -replace '// SW Version \d+', "// SW Version $newBuild"
Set-Content $swPath $swContent -NoNewline
Write-Host "  [SUCCESS] Service Worker version bumped: $currentBuild -> $newBuild" -ForegroundColor Green

# Update index.html
$indexPath = "index.html"
$indexContent = Get-Content $indexPath -Raw
$indexContent = $indexContent -replace 'build v\d+', "build v$newBuild"
$indexContent = $indexContent -replace 'const CURRENT_BUILD = \d+;', "const CURRENT_BUILD = $newBuild;"
$indexContent = $indexContent -replace "sw\.js\?v=\d+", "sw.js?v=$newBuild"
Set-Content $indexPath $indexContent -NoNewline
Write-Host "  [SUCCESS] Index.html build version bumped: $currentBuild -> $newBuild" -ForegroundColor Green

# Write version.json file
$versionJsonContent = '{"version": ' + $newBuild + '}'
Set-Content $versionJsonPath $versionJsonContent -NoNewline
Write-Host "  [SUCCESS] Created version.json with version $newBuild" -ForegroundColor Green



# Update build.gradle with new version and signing configurations
node scratch/configure_signing.js

# 2. Copy files to www folder
Write-Host "[INFO] Copying assets to www/ folder..." -ForegroundColor Yellow
if (Test-Path www) {
    Remove-Item -Recurse -Force www
}
New-Item -ItemType Directory -Path www -Force | Out-Null

Copy-Item app.js www/app.js -Force
Copy-Item -Recurse -Force js www/
Copy-Item index.html www/index.html -Force
Copy-Item style.css www/style.css -Force
Copy-Item sw.js www/sw.js -Force
Copy-Item manifest.json www/manifest.json -Force
Copy-Item icon.png www/icon.png -Force
Copy-Item xlsx.full.min.js www/xlsx.full.min.js -Force
Copy-Item version.json www/version.json -Force
Copy-Item _headers www/_headers -Force
if (Test-Path privacy.html) { Copy-Item privacy.html www/privacy.html -Force }
Write-Host "  [SUCCESS] Files copied successfully." -ForegroundColor Green

# 2.5 Generate Capgo OTA bundle
Write-Host "[INFO] Generating Capgo OTA bundle..." -ForegroundColor Yellow
$jsonOutput = (npx @capgo/cli bundle zip com.budgetassistant.app -b "1.0.$newBuild" -j --no-code-check --key-v2 | Out-String)
$startIndex = $jsonOutput.IndexOf("{")
if ($startIndex -ge 0) {
    $jsonString = $jsonOutput.Substring($startIndex)
    $zipData = $jsonString | ConvertFrom-Json
    $checksum = $zipData.checksum
    $filename = $zipData.filename
}

Copy-Item $filename "www/$filename" -Force
Remove-Item $filename -Force

$versionData = @{
    version = "1.0.$newBuild"
    url = "https://budget-assistant-pwa.pages.dev/$filename"
    checksum = $checksum
}
$versionData | ConvertTo-Json | Set-Content "www/version.json"
Write-Host "  [SUCCESS] Capgo bundle generated and version.json updated." -ForegroundColor Green

    # 3. Capacitor Sync
    Write-Host "[INFO] Running npx cap sync..." -ForegroundColor Yellow
    cmd /c npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Capacitor Sync failed!" -ForegroundColor Red
        Exit 1
    }
    Write-Host "  [SUCCESS] Capacitor Sync complete." -ForegroundColor Green

    # 4. Gradle Android Release & Debug Build
    Write-Host "[INFO] Building Android Debug APK, Release APK, and Play Store Bundle (AAB)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    Push-Location android
    .\gradlew.bat assembleDebug assembleRelease bundleRelease
    $gradleExit = $LASTEXITCODE
    Pop-Location

    if ($gradleExit -ne 0) {
        Write-Host "[ERROR] Gradle build failed!" -ForegroundColor Red
        Exit 1
    }
    Write-Host "  [SUCCESS] Android builds completed successfully." -ForegroundColor Green

    # 5. Copy APKs & AAB to Desktop
    Write-Host "[INFO] Copying builds to Desktop..." -ForegroundColor Yellow
    $apkDebugSource = "android\app\build\outputs\apk\debug\app-debug.apk"
    $apkReleaseSource = "android\app\build\outputs\apk\release\app-release.apk"
    $aabSource = "android\app\build\outputs\bundle\release\app-release.aab"
    $desktopDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"))

    if (Test-Path $apkReleaseSource) {
        Copy-Item $apkReleaseSource "$desktopDir\BudgetAssistant-Latest.apk" -Force
        Write-Host "  [SUCCESS] Signed Release APK copied to Desktop as BudgetAssistant-Latest.apk" -ForegroundColor Green
    }
    if (Test-Path $aabSource) {
        Copy-Item $aabSource "$desktopDir\BudgetAssistant.aab" -Force
        Write-Host "  [SUCCESS] Signed Play Store Bundle copied to Desktop as BudgetAssistant.aab" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Play Store Bundle (AAB) not found at $aabSource" -ForegroundColor Red
    }


# 6. Wrangler Deploy to Cloudflare Pages
Write-Host "[INFO] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
$env:PATH += ';C:\Program Files\nodejs;C:\Users\mario\AppData\Roaming\npm'

Write-Host "  [DEPLOY] Deploying to budget-assistant-pwa..." -ForegroundColor Yellow
wrangler pages deploy www --project-name=budget-assistant-pwa --branch=main
$deploy1 = $LASTEXITCODE

if ($deploy1 -ne 0) {
    Write-Host "[ERROR] Wrangler deployment failed!" -ForegroundColor Red
    Exit 1
}

# 7. Git Commit & Tag
Write-Host "[INFO] Staging and committing to Git..." -ForegroundColor Yellow
git add -A
git commit -m "build v${newBuild}: Fix 'Cannot access displayCurrency before initialization' TDZ error in renderStatsTab by declaring displayCurrency before the anti-flicker signature"
Write-Host "  [SUCCESS] Git commit created for build v${newBuild}" -ForegroundColor Green

Write-Host "[SUCCESS] All steps completed successfully! Builds are live at:" -ForegroundColor Green
Write-Host "  - https://budget-assistant-pwa.pages.dev" -ForegroundColor Green
Write-Host "  - https://budget-assistant-pwa.pages.dev" -ForegroundColor Green
