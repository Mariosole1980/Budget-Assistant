$path = "C:\Users\mario\Desktop\money-manager\index.html"
$lines = [System.IO.File]::ReadAllLines($path)
Write-Host "Total lines before: $($lines.Length)"
# Keep lines 0-494 (1-indexed: 1-495) and lines 578+ (1-indexed: 579+)
$kept = $lines[0..494] + $lines[578..($lines.Length - 1)]
Write-Host "Total lines after: $($kept.Length)"
[System.IO.File]::WriteAllLines($path, $kept)
Write-Host "Done!"
