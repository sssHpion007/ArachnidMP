$ErrorActionPreference = 'Stop'

$target = '__TARGET__'
$source = '__SOURCE__'
$backup = '__BACKUP__'
$scriptPath = '__SCRIPT__'
$errorPath = '__ERROR__'
$successPath = '__SUCCESS__'
$parentPid = __PARENT_PID__
$originalMoved = $false

try {
    # The updater must outlive the player process; wait until Windows releases its executable handle.
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
    }
    if (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) {
        throw 'The player process did not exit; the existing executable was left untouched.'
    }
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw 'The downloaded update file is missing.'
    }
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw 'The existing player executable is missing; refusing to install over an empty path.'
    }

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

    Move-Item -LiteralPath $source -Destination $target -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw 'The new executable was not placed at the application path.'
    }

    # Keep the backup until the replacement has actually stayed alive through startup.
    $newProcess = Start-Process -FilePath $target -PassThru -ErrorAction Stop
    Start-Sleep -Seconds 10
    $newProcess.Refresh()
    if ($newProcess.HasExited) {
        throw "The updated player exited during startup (code $($newProcess.ExitCode))."
    }

    Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    $originalMoved = $false
    if (-not [string]::IsNullOrEmpty($successPath)) {
        Set-Content -LiteralPath $successPath -Value $newProcess.Id -Encoding ASCII
    }
    if (Test-Path -LiteralPath $errorPath) {
        Remove-Item -LiteralPath $errorPath -Force -ErrorAction SilentlyContinue
    }
} catch {
    $failure = $_.Exception.Message
    if ($originalMoved -and (Test-Path -LiteralPath $backup -PathType Leaf)) {
        try {
            if (Test-Path -LiteralPath $target -PathType Leaf) {
                Remove-Item -LiteralPath $target -Force -ErrorAction Stop
            }
            Move-Item -LiteralPath $backup -Destination $target -ErrorAction Stop
            $originalMoved = $false
        } catch {
            $failure += "`r`nRollback failed; preserved backup at: $backup`r`n$($_.Exception.Message)"
        }
    }

    if (Test-Path -LiteralPath $target -PathType Leaf) {
        try { Start-Process -FilePath $target -ErrorAction SilentlyContinue | Out-Null } catch {}
    }
    if (Test-Path -LiteralPath $source -PathType Leaf) {
        Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
    }
    try { Set-Content -LiteralPath $errorPath -Value $failure -Encoding UTF8 } catch {}
} finally {
    try { Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue } catch {}
}
