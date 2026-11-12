param([string]$OutputDirectory = 'submission')
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destinationRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
if (-not $destinationRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The submission output must be a subdirectory of this project.'
}
$null = New-Item -ItemType Directory -Path $destinationRoot -Force
$included = @(
    'README.md', 'package.json', 'package-lock.json', '.gitignore',
    'start.cmd', 'server.js', 'model.js', 'app.js', 'api.js', 'icons.js',
    'index.html', 'style.css', 'model.test.js', 'server.test.js',
    'playwright.config.js', 'tests', 'docs', 'scripts'
)
$sourcePaths = foreach ($name in $included) {
    $candidate = Join-Path $projectRoot $name
    if (-not (Test-Path -LiteralPath $candidate)) { throw "Missing submission artifact: $name" }
    $candidate
}
$archivePath = Join-Path $destinationRoot 'ViNho-FinTech-Final.zip'
if (Test-Path -LiteralPath $archivePath) {
    $archivePath = Join-Path $destinationRoot ('ViNho-FinTech-Final-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
}
Compress-Archive -LiteralPath $sourcePaths -DestinationPath $archivePath -CompressionLevel Optimal
Get-Item -LiteralPath $archivePath | Select-Object FullName, Length
Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
