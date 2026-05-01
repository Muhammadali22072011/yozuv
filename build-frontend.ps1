param(
    [string]$NgrokUrl = $env:NGROK_URL
)

if (-not $NgrokUrl) {
    Write-Error "NgrokUrl is required. Pass via -NgrokUrl or set NGROK_URL env var."
    exit 1
}

$env:NEXT_PUBLIC_API_URL = $NgrokUrl
$env:NEXT_PUBLIC_BOT_USERNAME = if ($env:NEXT_PUBLIC_BOT_USERNAME) { $env:NEXT_PUBLIC_BOT_USERNAME } else { "Yozuv_cl_bot" }
cd D:\yozuv\frontend
npm run build
