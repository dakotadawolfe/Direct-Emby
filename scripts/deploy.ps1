param(
  [Parameter(Mandatory = $true)]
  [string]$HostName,
  [string]$RemoteDir = "",
  [Parameter(Mandatory = $true)]
  [string]$PublicBaseUrl,
  [string]$Port = "3000",
  [string]$CloudflaredToken = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Archive = Join-Path ([System.IO.Path]::GetTempPath()) "directemby-deploy.tar.gz"

if ($RemoteDir.Length -eq 0) {
  if ($HostName.Contains("@")) {
    $RemoteUser = $HostName.Split("@", 2)[0]
    $RemoteDir = "/home/$RemoteUser/directemby"
  }
  else {
    throw "RemoteDir is required when HostName does not include a user, for example -RemoteDir /home/directemby/directemby"
  }
}

if (Test-Path $Archive) {
  Remove-Item $Archive -Force
}

Push-Location $ProjectRoot
try {
  tar --exclude="./node_modules" --exclude="./dist" --exclude="./coverage" --exclude="./.env" -czf $Archive .
}
finally {
  Pop-Location
}

ssh $HostName "mkdir -p '$RemoteDir'"
scp $Archive "${HostName}:$RemoteDir/directemby-deploy.tar.gz"
ssh $HostName "cd '$RemoteDir' && tar -xzf directemby-deploy.tar.gz && chmod +x scripts/deploy.sh"

$remoteCommand = "cd '$RemoteDir' && APP_DIR='$RemoteDir' PUBLIC_BASE_URL='$PublicBaseUrl' PORT='$Port'"
if ($CloudflaredToken.Length -gt 0) {
  $remoteCommand += " CLOUDFLARED_TOKEN='$CloudflaredToken'"
}
$remoteCommand += " bash scripts/deploy.sh"

ssh $HostName $remoteCommand
