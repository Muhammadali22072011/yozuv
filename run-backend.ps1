param(
    [string]$NgrokUrl = $env:NGROK_URL,
    [string]$AdminTelegramIds = $env:ADMIN_TELEGRAM_IDS
)

$env:BOT_TOKEN   = if ($env:BOT_TOKEN)   { $env:BOT_TOKEN }   else { Read-Host "Enter BOT_TOKEN" }
$env:SECRET_KEY  = if ($env:SECRET_KEY)  { $env:SECRET_KEY }  else { Read-Host "Enter SECRET_KEY" }

if (-not $NgrokUrl) {
    Write-Error "NgrokUrl is required. Pass via -NgrokUrl or set NGROK_URL env var."
    exit 1
}

$env:DATABASE_URL = "sqlite:///D:/yozuv/yozuv.db"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:PUBLIC_APP_URL = $NgrokUrl
$env:PUBLIC_API_URL = $NgrokUrl
$env:CORS_ORIGINS = "http://localhost:3000,$NgrokUrl"
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"
$env:NEXT_PUBLIC_BOT_USERNAME = "YozuvBot"
$env:UPLOADS_DIR = "D:/yozuv/uploads"
if ($AdminTelegramIds) { $env:ADMIN_TELEGRAM_IDS = $AdminTelegramIds }

cd D:\yozuv\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
