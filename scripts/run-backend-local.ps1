# Sobe o backend Flutz local (Postgres deve estar no Docker).
# Uso: .\scripts\run-backend-local.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$backend = Join-Path $root "backend"

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
  $i = $line.IndexOf("=")
  $key = $line.Substring(0, $i).Trim()
  $val = $line.Substring($i + 1)
  if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
    $val = $val.Substring(1, $val.Length - 2)
  }
  Set-Item -Path "Env:$key" -Value $val
}

$fromDocker = docker exec flutz-postgres-1 printenv POSTGRES_PASSWORD 2>$null
if ($LASTEXITCODE -eq 0 -and $fromDocker) {
  $env:DATABASE_PASSWORD = "$fromDocker".Trim()
}

$hostDb = if ($env:DATABASE_HOST) { $env:DATABASE_HOST } else { "127.0.0.1" }
if ($hostDb -eq "localhost") { $hostDb = "127.0.0.1" }
$portDb = if ($env:DATABASE_PORT) { $env:DATABASE_PORT } else { "5432" }
$nameDb = if ($env:DATABASE_NAME) { $env:DATABASE_NAME } else { "flutz_app" }
$userDb = if ($env:DATABASE_USERNAME) { $env:DATABASE_USERNAME } else { "postgres" }

$jdbc = "jdbc:postgresql://${hostDb}:${portDb}/${nameDb}?currentSchema=flutz"
$env:SPRING_DATASOURCE_URL = $jdbc
$env:SPRING_DATASOURCE_USERNAME = $userDb
$env:SPRING_DATASOURCE_PASSWORD = $env:DATABASE_PASSWORD
$env:DATABASE_HOST = $hostDb

Set-Location $backend

$configDir = Join-Path $backend "config"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$configFile = Join-Path $configDir "application.properties"
$lines = @(
  "spring.datasource.url=$jdbc"
  "spring.datasource.username=$userDb"
  "spring.datasource.password=$($env:DATABASE_PASSWORD)"
)
# UTF-8 sem BOM — BOM quebra a primeira chave do Spring
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($configFile, $lines, $utf8)

Write-Host "Subindo Spring Boot em http://localhost:$($env:SERVER_PORT) ..."
mvn -q -DskipTests package
$jar = Get-ChildItem (Join-Path $backend "target") -Filter "flutz*.jar" | Where-Object { $_.Name -notmatch 'original' } | Select-Object -First 1
if (-not $jar) { throw "JAR nao encontrado em target/" }
java -jar $jar.FullName "--spring.config.additional-location=optional:file:./config/"
