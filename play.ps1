$nodeHome = Join-Path $env:LOCALAPPDATA "node-v24.20.0-win-x64"
if (Test-Path (Join-Path $nodeHome "node.exe")) {
  $env:Path = "$nodeHome;$env:Path"
}
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules\vite")) {
  npm install
}
npm run dev
