$ErrorActionPreference = 'Stop'

$target = '__TARGET__'
$source = '__SOURCE__'
$backup = '__BACKUP__'
$scriptPath = '__SCRIPT__'
$errorPath = '__ERROR__'
$successPath = '__SUCCESS__'
$logPath = '__LOG__'
$parentPid = __PARENT_PID__
$originalMoved = $false

function Write-UpdaterLog([string] $message) {
    try {
        Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) $message" -Encoding UTF8
    } catch {}
}

Write-UpdaterLog "Updater started; waiting for player PID $parentPid to exit."

try {
    # The updater must outlive the player process; wait until Windows releases its executable handle.
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
    }
    if (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) {
        throw 'The player process did not exit; the existing executable was left untouched.'
    }
    Write-UpdaterLog 'Player process exited.'
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw 'The downloaded update file is missing.'
    }
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw 'The existing player executable is missing; refusing to install over an empty path.'
    }
    Write-UpdaterLog "Validated source and target files. Source bytes: $((Get-Item -LiteralPath $source).Length)."

    # Retry only the original-file rename. Never discard the backup while installation is in progress.
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            Move-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
            $originalMoved = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $originalMoved) {
        throw 'Windows did not release the existing executable; it was not replaced.'
    }
    Write-UpdaterLog "Moved original executable to backup: $backup"

    Move-Item -LiteralPath $source -Destination $target -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw 'The new executable was not placed at the application path.'
    }
    Write-UpdaterLog 'Placed replacement executable at the application path.'

    # Keep the backup until the replacement has actually stayed alive through startup.
    $newProcess = Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -PassThru -ErrorAction Stop
    Write-UpdaterLog "Launched replacement process PID $($newProcess.Id); validating startup."
    Start-Sleep -Seconds 10
    $newProcess.Refresh()
    if ($newProcess.HasExited) {
        throw "The updated player exited during startup (code $($newProcess.ExitCode))."
    }

    Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    $originalMoved = $false
    Write-UpdaterLog "Replacement remained alive through startup; update succeeded. PID $($newProcess.Id)."
    if (-not [string]::IsNullOrEmpty($successPath)) {
        Set-Content -LiteralPath $successPath -Value $newProcess.Id -Encoding ASCII
    }
    if (Test-Path -LiteralPath $errorPath) {
        Remove-Item -LiteralPath $errorPath -Force -ErrorAction SilentlyContinue
    }
} catch {
    $failure = $_.Exception.Message
    Write-UpdaterLog "ERROR: $failure"
    if ($originalMoved -and (Test-Path -LiteralPath $backup -PathType Leaf)) {
        try {
            if (Test-Path -LiteralPath $target -PathType Leaf) {
                Remove-Item -LiteralPath $target -Force -ErrorAction Stop
            }
            Move-Item -LiteralPath $backup -Destination $target -ErrorAction Stop
            $originalMoved = $false
            Write-UpdaterLog 'Rollback restored the original executable.'
        } catch {
            $failure += "`r`nRollback failed; preserved backup at: $backup`r`n$($_.Exception.Message)"
            Write-UpdaterLog "CRITICAL: rollback failed; backup preserved at $backup. $($_.Exception.Message)"
        }
    }

    if (Test-Path -LiteralPath $target -PathType Leaf) {
        try {
            Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -ErrorAction SilentlyContinue | Out-Null
            Write-UpdaterLog 'Restarted the player executable after handling the update failure.'
        } catch { Write-UpdaterLog "WARNING: failed to restart the player: $($_.Exception.Message)" }
    }
    if (Test-Path -LiteralPath $source -PathType Leaf) {
        Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
    }
    try { Set-Content -LiteralPath $errorPath -Value $failure -Encoding UTF8 } catch {}
} finally {
    try { Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue } catch {}
}
