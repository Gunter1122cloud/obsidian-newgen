$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'ObsidianCommandNewGen'
$file = Join-Path $directory 'curseforge-key.dpapi'
$secret = Read-Host 'Enter your own CurseForge API key (hidden)' -AsSecureString
try {
    if ($secret.Length -eq 0) { throw 'No key entered.' }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $file -Encoding ascii
    Write-Host 'Saved for the current Windows user. Restart Obsidian NewGen. Future app updates retain this credential.'
} finally {
    $secret.Dispose()
}
