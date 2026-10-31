$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'

Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"'), 'Process')
  }
}

$sourceDatabase = $env:PGDATABASE
$env:PGDATABASE = 'cats_preview_codex'
$env:PORT = '3001'
$env:HOST = '0.0.0.0'
$env:HTTPS_ENABLED = 'false'
$env:COOKIE_SECURE = 'false'
$env:PUBLIC_ORIGIN = 'http://192.168.250.2:3001'
$env:NODE_ENV = 'development'
$env:DISABLE_AUTOMATIC_BACKUPS = 'true'
$env:SESSION_COOKIE_NAME = 'shelter_preview_session'
$env:VISITOR_COOKIE_NAME = 'shelter_preview_visitor'
if ($env:PGDATABASE -eq $sourceDatabase) {
  throw 'Preview database must be different from the source database.'
}

Set-Location -LiteralPath $projectRoot
npm run dev
