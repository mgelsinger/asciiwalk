import { spawnSync } from 'node:child_process';
import { root } from './launch.mjs';

if (process.platform !== 'win32') {
  console.log('Desktop shortcuts are for Windows. Use npm start and npm stop on this device.');
  process.exit(0);
}

// Inline PowerShell uses Windows' shortcut API without changing execution policy.
const script = String.raw`$ErrorActionPreference = 'Stop'
$projectRoot = $env:ASCII_SHORTCUT_ROOT
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$iconPath = Join-Path $projectRoot 'public\ascii-walk.ico'

# A small native text icon keeps the launcher recognizable without downloaded assets.
if (-not (Test-Path -LiteralPath $iconPath)) {
    Add-Type -AssemblyName System.Drawing
    $bitmap = [System.Drawing.Bitmap]::new(64, 64)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(16, 26, 26))
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(215, 223, 197))
    $pen = [System.Drawing.Pen]::new($brush, 2)
    $font = [System.Drawing.Font]::new('Consolas', 18, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawRectangle($pen, 3, 3, 57, 57)
    $graphics.DrawString('A/W', $font, $brush, 9, 18)
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
    $stream = [System.IO.File]::Create($iconPath)
    try { $icon.Save($stream) } finally {
        $stream.Dispose(); $icon.Dispose(); $font.Dispose(); $pen.Dispose()
        $brush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
    }
}

$shortcutShell = New-Object -ComObject WScript.Shell
foreach ($item in @(
    @{ Name = 'ASCII Walk'; Target = 'Launch ASCII Walk.cmd'; Description = 'Explore Warsaw in ASCII. Starts the local app and opens your default browser.' },
    @{ Name = 'Stop ASCII Walk'; Target = 'Stop ASCII Walk.cmd'; Description = 'Stop the local ASCII Walk server.' }
)) {
    $shortcutPath = Join-Path $desktopDirectory ($item.Name + '.lnk')
    $targetPath = Join-Path $projectRoot $item.Target
    $shortcut = $shortcutShell.CreateShortcut($shortcutPath)
    if ((Test-Path -LiteralPath $shortcutPath) -and $shortcut.TargetPath -ne $targetPath) {
        throw "A different shortcut already exists at $shortcutPath. It was not changed."
    }
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.Description = $item.Description
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Output "Created $shortcutPath"
}`;
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
  windowsHide: true,
  stdio: 'inherit',
  env: { ...process.env, ASCII_SHORTCUT_ROOT: root },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
