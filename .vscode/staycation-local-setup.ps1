$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

function Write-Utf8FileWithoutBom([string]$Path, [string[]]$Lines) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines((Join-Path $root $Path), $Lines, $encoding)
}

if (-not (Test-Path (Join-Path $root 'backend\.env'))) {
    $jwt = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $admin = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Write-Utf8FileWithoutBom 'backend\.env' @(
        'DATABASE_URL=postgresql+psycopg://staycation:staycation@db:5432/staycation'
        "JWT_SECRET=$jwt"
        'JWT_EXPIRE_MINUTES=60'
        'ADMIN_USERNAME=stayadmin'
        "ADMIN_PASSWORD=$admin"
        'CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173'
        'CLOUDINARY_CLOUD_NAME='
        'CLOUDINARY_API_KEY='
        'CLOUDINARY_API_SECRET='
    )
    Write-Output 'Created backend/.env with local random secrets.'
} else {
    Write-Output 'Kept existing backend/.env unchanged.'
}

if (-not (Test-Path (Join-Path $root '.env'))) {
    Write-Utf8FileWithoutBom '.env' @('VITE_API_URL=http://localhost:8000')
    Write-Output 'Created frontend .env.'
} else {
    Write-Output 'Kept existing frontend .env unchanged.'
}

Write-Output ('Node: ' + (& node --version))
if ($LASTEXITCODE -ne 0) { throw 'Node.js is unavailable.' }
Write-Output ('npm: ' + (& npm --version))
if ($LASTEXITCODE -ne 0) { throw 'npm is unavailable.' }
Write-Output ('Docker: ' + (& docker --version))
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running or is unavailable.' }

docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw 'Failed to start PostgreSQL.' }
Start-Sleep -Seconds 5
docker compose up -d --build api
if ($LASTEXITCODE -ne 0) { throw 'Failed to build or start the API.' }

npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

$viteLog = Join-Path $env:TEMP 'staycation-vite.log'
$viteErrorLog = Join-Path $env:TEMP 'staycation-vite-error.log'
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$vite = Start-Process -FilePath $npmCommand -ArgumentList 'run dev -- --host 127.0.0.1' -WorkingDirectory $root -PassThru -RedirectStandardOutput $viteLog -RedirectStandardError $viteErrorLog
Write-Output ('Started Vite process ID ' + $vite.Id + '.')

$siteReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $siteReady = $true
            break
        }
    } catch {
        if ($attempt -eq 29) { throw 'Vite did not become responsive. Check the Vite log in the system temp folder.' }
    }
}
if (-not $siteReady) { throw 'Vite did not become responsive.' }
Write-Output 'Website is responding at http://localhost:5173/.'

try {
    $api = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 5
    Write-Output ('API is responding at http://localhost:8000/ (HTTP ' + $api.StatusCode + ').')
} catch {
    Write-Output 'API container was started, but its HTTP endpoint is not responding yet.'
}
