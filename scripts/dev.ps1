param(
    [ValidateSet('init', 'format', 'build', 'up', 'check', 'stop')]
    [string]$Action = 'check'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env'
$ComposeFile = Join-Path (Join-Path (Join-Path $Root 'infra') 'docker') 'compose.yaml'

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & docker compose -p interfere --env-file $EnvFile -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Interfere Compose command failed with exit code $LASTEXITCODE."
    }
}

function Initialize-LocalEnvironment {
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        $bytes = New-Object byte[] 32
        $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $generator.GetBytes($bytes)
            $content = 'INTERFERE_DB_PASSWORD=' + [Convert]::ToBase64String($bytes) + "`n"
            [System.IO.File]::WriteAllText($EnvFile, $content, (New-Object System.Text.UTF8Encoding($false)))
        }
        finally {
            $generator.Dispose()
        }
        Write-Host 'Created ignored project-local database configuration.'
    }
    Invoke-Compose config --quiet
}

function Restore-WebDependencies {
    $lockfile = Join-Path $Root 'package-lock.json'
    if (-not (Test-Path -LiteralPath $lockfile)) {
        throw 'package-lock.json is missing. Restore the reviewed lockfile before running this gate.'
    }
    Invoke-Compose --profile tools run --rm --no-deps web-tools npm ci --no-audit --no-fund
}

function Build-VerifiedArtifacts {
    Restore-WebDependencies
    Invoke-Compose --profile tools run --rm --no-deps api-tools mvn --batch-mode --no-transfer-progress -f services/api/pom.xml verify
    Invoke-Compose --profile tools run --rm --no-deps web-tools npm run verify
    Invoke-Compose build api
    Invoke-Compose build web
}

function Test-HostEndpoints {
    $web = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri 'http://127.0.0.1:18106/healthz'
    if ($web.StatusCode -ne 200 -or $web.Content.Trim() -ne 'ok') {
        throw 'The loopback web health check did not return the expected response.'
    }
    $readiness = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Headers @{ Accept = 'application/json' } -Uri 'http://127.0.0.1:18206/actuator/health/readiness'
    if ($readiness.StatusCode -ne 200 -or ($readiness.Content | ConvertFrom-Json).status -ne 'UP') {
        throw 'The loopback API is not ready.'
    }
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri 'http://127.0.0.1:18106/api/skeleton/status'
    $status = $response.Content | ConvertFrom-Json
    if ($response.StatusCode -ne 200 -or $status.project -ne 'Interfere' -or
        $status.phase -ne 1 -or $status.fixtureId -ne 'synthetic-demo' -or
        $status.database -ne 'ready' -or $status.telemetryEnabled -ne $false -or
        $status.patchAutomationEnabled -ne $false) {
        throw 'The loopback web -> API -> PostgreSQL check returned an unexpected contract.'
    }
    Write-Host 'Host checks passed: web 18106, API 18206, and the DB-backed web proxy.'
}

Push-Location $Root
try {
    & docker info --format 'Docker engine: {{.OSType}}'
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is unavailable. Start Docker Desktop with Linux containers first.'
    }
    Initialize-LocalEnvironment
    switch ($Action) {
        'init' { Write-Host 'Interfere local environment is ready.' }
        'format' {
            Restore-WebDependencies
            Invoke-Compose --profile tools run --rm --no-deps api-tools mvn --batch-mode --no-transfer-progress -f services/api/pom.xml spotless:apply
            Invoke-Compose --profile tools run --rm --no-deps web-tools npm run format
        }
        'build' { Build-VerifiedArtifacts }
        'up' {
            Invoke-Compose up -d --no-build --pull never --wait --wait-timeout 180 db api web
            Test-HostEndpoints
        }
        'check' {
            Build-VerifiedArtifacts
            Invoke-Compose up -d --no-build --wait --wait-timeout 180 db api web
            Test-HostEndpoints
            Invoke-Compose --profile tools run --rm --no-deps smoke
            Invoke-Compose --profile tools run --rm --no-deps browser
            Invoke-Compose ps
        }
        'stop' { Invoke-Compose stop }
    }
}
finally {
    Pop-Location
}
