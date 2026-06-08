# PowerShell script to download Node.js portable, install dependencies, and run Melody Ear Trainer Pro.
$ErrorActionPreference = "Stop"

$workspaceDir = "E:\music"
$nodeVersion = "v20.11.0"
$zipName = "node-$nodeVersion-win-x64.zip"
$downloadUrl = "https://nodejs.org/dist/$nodeVersion/$zipName"
$zipPath = Join-Path $workspaceDir "node.zip"
$portableDir = Join-Path $workspaceDir "node_portable"
$nodeBinDir = Join-Path $portableDir "node-$nodeVersion-win-x64"
$nodeExe = Join-Path $nodeBinDir "node.exe"
$npmCmd = Join-Path $nodeBinDir "npm.cmd"

# Step 1: Download Node.js portable if not already present
if (-not (Test-Path $nodeExe)) {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Downloading portable Node.js ($nodeVersion)..." -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    
    # Enable TLS 1.2
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
    
    Write-Host "Extracting Node.js package..." -ForegroundColor Cyan
    if (-not (Test-Path $portableDir)) {
        New-Item -ItemType Directory -Path $portableDir | Out-Null
    }
    
    Expand-Archive -Path $zipPath -DestinationPath $portableDir -Force
    Remove-Item $zipPath
    Write-Host "Node.js unpacked successfully." -ForegroundColor Green
} else {
    Write-Host "Node.js portable already present in workspace." -ForegroundColor Green
}

# Add node binary folder to path for this process session
$env:Path = "$nodeBinDir;" + $env:Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Installing NPM dependencies..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Step 2: Install project dependencies
& $npmCmd install

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Starting Vite development server..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Step 3: Run dev server
& $npmCmd run dev
