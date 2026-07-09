#Requires -Version 5.1
<#
.SYNOPSIS
  Copies build output, package manifests, and optionally .env files to local deploy staging folders.

.DESCRIPTION
  Run after `npm run build` and `npm run build:client:web` from the monorepo root.
  Staging output:
    D:\temp\mcp-demo-deploy\mcp-server
    D:\temp\mcp-demo-deploy\mcp-client

  Copies each app's .env from apps/<app>/.env in the repo to .env at the staging deploy root
  (same layout as production: /var/www/mcp-server/.env).

  mcp-server: also copies apps/mcp-server/knowledge/ to knowledge/ under staging, plus workspace
    manifests (apps/mcp-server/package.json, libs/api-common/package.json + dist/).
  mcp-client: copies apps/mcp-client/package.json and web/dist/ to dist/apps/web/dist/.

  When .env files are copied, the script prints warnings about production configuration.

  Before copying, the staging root folder is removed entirely (all files and sub-folders).
  The script prompts for confirmation before cleaning.

.EXAMPLE
  cd D:\projectosMindshaker2\MCP-demo
  npm run build
  npm run build:client:web
  .\docs\deploy\stage-deploy.ps1

.EXAMPLE
  .\docs\deploy\stage-deploy.ps1 -SkipEnvCopy
#>
[CmdletBinding()]
param(
  [switch] $SkipEnvCopy
)

$ErrorActionPreference = 'Stop'

$Script:EnvFilesCopied = @()

function Write-ProductionEnvWarning {
  param(
    [Parameter(Mandatory)]
    [string] $AppName,
    [Parameter(Mandatory)]
    [string] $DestinationPath
  )

  Write-Warning @"
[$AppName] .env was copied to staging:
  $DestinationPath

Be careful when uploading .env to PRODUCTION:
  - Overwriting the server .env can change API keys, secrets, ports, and upstream URLs.
  - Do not replace production settings with local or dev values by mistake.
  - For routine code deploys, upload dist + package.json + package-lock.json only; skip .env unless you intend to change configuration.
"@
}

function Confirm-StagingCleanup {
  param(
    [Parameter(Mandatory)]
    [string] $StagingRoot
  )

  Write-Host 'The destination staging folder will be cleaned (all files and sub-folders removed):'
  Write-Host "  $StagingRoot"
  if (Test-Path $StagingRoot) {
    $childCount = (Get-ChildItem -LiteralPath $StagingRoot -Force -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($childCount -gt 0) {
      Write-Host "  ($childCount item(s) currently under this folder)"
    }
  } else {
    Write-Host '  (folder does not exist yet; nothing to remove)'
  }
  Write-Host ''
  Write-Host 'Press any key to continue; Ctrl+C to quit.'
  $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
  Write-Host ''
}

function Remove-StagingRoot {
  param(
    [Parameter(Mandatory)]
    [string] $StagingRoot
  )

  if (-not (Test-Path $StagingRoot)) {
    Write-Host "Staging folder not present; skip clean: $StagingRoot"
    return
  }

  Remove-Item -LiteralPath $StagingRoot -Recurse -Force
  Write-Host "Removed staging folder: $StagingRoot"
}

function Copy-AppEnvToStaging {
  param(
    [Parameter(Mandatory)]
    [string] $AppName,
    [Parameter(Mandatory)]
    [string] $StagingDir,
    [Parameter(Mandatory)]
    [string] $EnvSourceRelativePath,
    [Parameter(Mandatory)]
    [string] $EnvDestRelativePath
  )

  $envSrc = Join-Path $RepoRoot $EnvSourceRelativePath
  $envDst = Join-Path $StagingDir $EnvDestRelativePath

  if (-not (Test-Path $envSrc)) {
    Write-Host "Skipped .env (not found): $envSrc"
    return
  }

  $envDir = Split-Path $envDst -Parent
  if ($envDir) {
    New-Item -ItemType Directory -Force -Path $envDir | Out-Null
  }
  Copy-Item -Force $envSrc $envDst
  $Script:EnvFilesCopied += $envDst
  Write-Host "Copied .env ($AppName) -> $envDst"
  Write-ProductionEnvWarning -AppName $AppName -DestinationPath $envDst
}

function Copy-WorkspaceManifests {
  param(
    [Parameter(Mandatory)]
    [string] $StagingDir,
    [Parameter(Mandatory)]
    [string[]] $AppNames,
    [switch] $IncludeApiCommon
  )

  foreach ($appName in $AppNames) {
    $appPkgSrc = Join-Path $RepoRoot "apps\$appName\package.json"
    $appPkgDst = Join-Path $StagingDir "apps\$appName\package.json"
    if (-not (Test-Path $appPkgSrc)) {
      throw "Workspace package.json not found: $appPkgSrc"
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $appPkgDst -Parent) | Out-Null
    Copy-Item -Force $appPkgSrc $appPkgDst
    Write-Host "Copied workspace manifest -> $appPkgDst"
  }

  if (-not $IncludeApiCommon) {
    return
  }

  $apiCommonPkgSrc = Join-Path $RepoRoot 'libs\api-common\package.json'
  $apiCommonDistSrc = Join-Path $RepoRoot 'libs\api-common\dist'
  $apiCommonPkgDst = Join-Path $StagingDir 'libs\api-common\package.json'
  $apiCommonDistDst = Join-Path $StagingDir 'libs\api-common\dist'

  if (-not (Test-Path $apiCommonPkgSrc)) {
    throw "Workspace package.json not found: $apiCommonPkgSrc"
  }
  if (-not (Test-Path (Join-Path $apiCommonDistSrc 'config\validate-env.js'))) {
    throw "api-common dist not found. Run 'npm run build' first: $apiCommonDistSrc"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $apiCommonPkgDst -Parent) | Out-Null
  Copy-Item -Force $apiCommonPkgSrc $apiCommonPkgDst
  Copy-Item -Recurse -Force $apiCommonDistSrc $apiCommonDistDst
  Write-Host "Copied workspace lib -> $(Split-Path $apiCommonPkgDst -Parent)"
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StagingRoot = 'D:\temp\mcp-demo-deploy'
$StagingServer = Join-Path $StagingRoot 'mcp-server'
$StagingClient = Join-Path $StagingRoot 'mcp-client'

$ServerMain = Join-Path $RepoRoot 'dist\apps\mcp-server\main.js'
$ClientServer = Join-Path $RepoRoot 'dist\apps\mcp-client\server.js'
$ClientWebDist = Join-Path $RepoRoot 'apps\mcp-client\web\dist'

if (-not (Test-Path (Join-Path $RepoRoot 'dist'))) {
  throw "dist folder not found. Run 'npm run build' from: $RepoRoot"
}
if (-not (Test-Path $ServerMain)) {
  throw "mcp-server main.js not found. Run 'npm run build' first: $ServerMain"
}
if (-not (Test-Path $ClientServer)) {
  throw "mcp-client server.js not found. Run 'npm run build' first: $ClientServer"
}
if (-not (Test-Path (Join-Path $ClientWebDist 'index.html'))) {
  throw "mcp-client web dist not found. Run 'npm run build:client:web' first: $ClientWebDist"
}

Write-Host "Repo root:     $RepoRoot"
Write-Host "Staging root:  $StagingRoot"
if ($SkipEnvCopy) {
  Write-Host '.env copy:     skipped (-SkipEnvCopy)'
}
Write-Host ''

Confirm-StagingCleanup -StagingRoot $StagingRoot
Remove-StagingRoot -StagingRoot $StagingRoot
Write-Host ''

# --- mcp-server staging ---
New-Item -ItemType Directory -Force -Path $StagingServer | Out-Null
Copy-Item -Recurse -Force (Join-Path $RepoRoot 'dist') $StagingServer
Copy-Item -Force (Join-Path $RepoRoot 'package.json'), (Join-Path $RepoRoot 'package-lock.json') $StagingServer

if (-not $SkipEnvCopy) {
  Copy-AppEnvToStaging `
    -AppName 'mcp-server' `
    -StagingDir $StagingServer `
    -EnvSourceRelativePath 'apps\mcp-server\.env' `
    -EnvDestRelativePath '.env'
}

$knowledgeSrc = Join-Path $RepoRoot 'apps\mcp-server\knowledge'
$knowledgeDst = Join-Path $StagingServer 'knowledge'
if (-not (Test-Path $knowledgeSrc)) {
  throw "Knowledge source folder not found: $knowledgeSrc"
}
Copy-Item -Recurse -Force $knowledgeSrc $knowledgeDst
Write-Host "Copied knowledge docs -> $knowledgeDst"

Copy-WorkspaceManifests -StagingDir $StagingServer -AppNames @('mcp-server') -IncludeApiCommon

# --- mcp-client staging ---
New-Item -ItemType Directory -Force -Path $StagingClient | Out-Null
Copy-Item -Recurse -Force (Join-Path $RepoRoot 'dist') $StagingClient
Copy-Item -Force (Join-Path $RepoRoot 'package.json'), (Join-Path $RepoRoot 'package-lock.json') $StagingClient

if (-not $SkipEnvCopy) {
  Copy-AppEnvToStaging `
    -AppName 'mcp-client' `
    -StagingDir $StagingClient `
    -EnvSourceRelativePath 'apps\mcp-client\.env' `
    -EnvDestRelativePath '.env'
}

$clientWebDst = Join-Path $StagingClient 'dist\apps\web\dist'
New-Item -ItemType Directory -Force -Path $clientWebDst | Out-Null
Copy-Item -Recurse -Force (Join-Path $ClientWebDist '*') $clientWebDst
Write-Host "Copied web client static assets -> $clientWebDst"

Copy-WorkspaceManifests -StagingDir $StagingClient -AppNames @('mcp-client')

Write-Host ''
Write-Host 'Staging complete.'
Write-Host "  mcp-server:  $StagingServer"
Write-Host "  mcp-client:  $StagingClient"

if ($Script:EnvFilesCopied.Count -gt 0) {
  Write-Warning @"
$($Script:EnvFilesCopied.Count) .env file(s) are in staging. Review before uploading to production:
$($Script:EnvFilesCopied -join "`n")
"@
}
