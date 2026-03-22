# DomainKit Setup Script for Windows (PowerShell)
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host ""
Write-Host "  DomainKit Setup" -ForegroundColor Cyan
Write-Host "  ===============" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "  Error: Node.js is required (>= 18). Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Host "  Error: Node.js >= 18 required. You have $(node -v)" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $(node -v) ... OK" -ForegroundColor Green

# Check for pnpm, install if missing
$pnpmCheck = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCheck) {
    Write-Host "  pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Error: Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  pnpm $(pnpm -v) ... OK" -ForegroundColor Green

# Ensure pnpm global bin directory exists
$pnpmHome = pnpm store path 2>$null
$globalDir = pnpm root -g 2>$null
if (-not $globalDir) {
    Write-Host "  Configuring pnpm global directory..." -ForegroundColor Yellow
    pnpm setup
    # Refresh PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Install dependencies
Write-Host ""
Write-Host "  Installing dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: pnpm install failed" -ForegroundColor Red
    exit 1
}

# Build the project
Write-Host "  Building..." -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: Build failed" -ForegroundColor Red
    exit 1
}

# Link globally
Write-Host "  Linking globally..." -ForegroundColor Cyan
pnpm link --global
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: Global link failed. Try running 'pnpm setup' first, then re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  ================================" -ForegroundColor Green
Write-Host "  DomainKit installed successfully!" -ForegroundColor Green
Write-Host "  ================================" -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT: Close and re-open your terminal (PowerShell/CMD) for the" -ForegroundColor Yellow
Write-Host "  PATH changes to take effect." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then try:"
Write-Host "    dk --help"
Write-Host "    dk --version"
Write-Host ""
Write-Host "  To use in any project:"
Write-Host "    cd C:\path\to\your\project"
Write-Host "    dk init"
Write-Host ""
Write-Host "  To uninstall:"
Write-Host "    pnpm unlink --global domainkit"
Write-Host ""
