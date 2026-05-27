$key = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

$url = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1/transactions?id=eq.00000000-0000-0000-0000-000000000000"

$t1 = Get-Date
try {
    Write-Output "Sending DELETE fake request to Supabase..."
    $res = Invoke-WebRequest -Uri $url -Headers $headers -Method Delete -TimeoutSec 10
    $ms = [int]((Get-Date) - $t1).TotalMilliseconds
    Write-Output "Delete fake succeeded in $ms ms!"
    Write-Output "Status code: $($res.StatusCode)"
} catch {
    Write-Error "Error: $_"
}
