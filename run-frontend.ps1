param(
    [string]$NgrokUrl = $env:NGROK_URL
)

if (-not $NgrokUrl) {
    Write-Error "NgrokUrl is required. Pass via -NgrokUrl or set NGROK_URL env var."
    exit 1
}

$env:NEXT_PUBLIC_API_URL = $NgrokUrl
$env:NEXT_PUBLIC_BOT_USERNAME = if ($env:NEXT_PUBLIC_BOT_USERNAME) { $env:NEXT_PUBLIC_BOT_USERNAME } else { "Yozuv_cl_bot" }
$env:HOSTNAME = "0.0.0.0"
$env:PORT = "3000"
cd D:\yozuv\frontend
# Copy static/public assets into standalone (Next standalone needs these alongside)
if (Test-Path ".next\standalone") {
  if (-not (Test-Path ".next\standalone\.next\static")) {
    New-Item -ItemType Directory -Force ".next\standalone\.next" | Out-Null
    Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
  }
  if ((Test-Path "public") -and (-not (Test-Path ".next\standalone\public"))) {
    Copy-Item -Recurse -Force "public" ".next\standalone\public"
  }
  node .next\standalone\server.js
} else {
  npm run start
}
