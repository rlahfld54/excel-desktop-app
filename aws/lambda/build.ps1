$ErrorActionPreference = 'Stop'
$lambdaDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$zipPath = Join-Path $lambdaDir 'excel-shared-api.zip'

Push-Location $lambdaDir
try {
  npm install --omit=dev
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Compress-Archive -Path 'index.js', 'package.json', 'node_modules' -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Host "Created $zipPath"
} finally {
  Pop-Location
}
