param([string]$DataDir, [switch]$Probe, [switch]$Stop, [switch]$Hit, [int]$X, [int]$Y)
$ErrorActionPreference = 'Stop'
if (!$DataDir) { $whaleCodex = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }; $DataDir = if ($env:WHALE_HOME) { $env:WHALE_HOME } else { Join-Path $whaleCodex 'whale-widget' } }
$DataDir = [IO.Path]::GetFullPath($DataDir)
$whaleErrorLog = Join-Path $DataDir 'logs\supervisor-stderr.log'
$whaleErrorBytes = 0
if (Test-Path -LiteralPath $whaleErrorLog) {
    try { $whaleErrorBytes = (Get-Item -LiteralPath $whaleErrorLog).Length } catch { $whaleErrorBytes = 0 }
}
function Add-WhaleStderr([string]$Line) {
    if ([string]::IsNullOrEmpty($Line)) { return }
    # The child writes provider errors and URLs here. Redact the same classes of
    # secret as runtime/log.mjs before the line reaches disk.
    $Line = [regex]::Replace($Line, '(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;"'']+', '$1[REDACTED]')
    $Line = [regex]::Replace($Line, '(?i)\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}', '$1[REDACTED]')
    $Line = [regex]::Replace($Line, '\bsk-[A-Za-z0-9_-]{8,}', 'sk-[REDACTED]')
    $Line = [regex]::Replace($Line, '(?i)((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie)\s*[:=]\s*["'']?)[^\s"''&,;}]+', '$1[REDACTED]')
    $Line = [regex]::Replace($Line, '(?i)([?&](?:key|api_key|access_token)=)[^&\s#]+', '$1[REDACTED]')
    if ($script:whaleErrorBytes -gt 2097152) {
        try { Move-Item -LiteralPath $script:whaleErrorLog -Destination ($script:whaleErrorLog + '.1') -Force; $script:whaleErrorBytes = 0 }
        catch { return }
    }
    try {
        $folder = Split-Path -Parent $script:whaleErrorLog
        if (!(Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
        [IO.File]::AppendAllText($script:whaleErrorLog, $Line + "`n")
        $script:whaleErrorBytes += $Line.Length + 1
    } catch { }
}
$whaleHasher = [Security.Cryptography.SHA256]::Create()
$whaleHash = [BitConverter]::ToString($whaleHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataDir.ToLowerInvariant()))).Replace('-', '').Substring(0,24)
$whaleHasher.Dispose()
$whaleStopName = 'Local\CodexWhaleStop-' + $whaleHash
if ($Stop) { try { $whaleSignal = [Threading.EventWaitHandle]::OpenExisting($whaleStopName); [void]$whaleSignal.Set(); $whaleSignal.Dispose() } catch [Threading.WaitHandleCannotBeOpenedException] { }; return }
Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'WindowApi.cs') -Raw)
if ($Probe) { [WhaleWindows]::Probe() | ConvertTo-Json -Depth 5 -Compress; return }
if ($Hit) { [WhaleWindows]::Hit($X, $Y) | ConvertTo-Json -Compress; return }
Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'WindowDiagnostics.cs') -Raw)
Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'WindowStacking.cs') -Raw)
[WhaleWindows]::DetachConsole()
$whaleFresh = $false
$whaleMutex = [Threading.Mutex]::new($true, ('Local\CodexWhaleWatch-' + $whaleHash), [ref]$whaleFresh)
if (!$whaleFresh) { $whaleMutex.Dispose(); return }
$whaleStop = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, $whaleStopName)
[void]$whaleStop.Reset()
$whaleChild = $null; $whaleOutput = $null; $whaleErrors = $null
$whaleLastLaunch = [DateTime]::MinValue; $whaleHeartbeat = [DateTime]::MinValue; $whaleLastMessage = ''; $whaleOverlay = '0'; $whaleOwner = '0'
$whaleSequence = 0
$whaleStateFile = Join-Path $DataDir 'supervisor-state.json'
$whaleParentPid = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId
@{ pid=$PID; parentPid=$whaleParentPid; consoleAttached=[WhaleWindows]::HasConsole(); startedAt=[DateTime]::UtcNow.ToString('o'); host='PowerShell' } | ConvertTo-Json | Set-Content -LiteralPath $whaleStateFile -Encoding utf8
function Read-WhaleJson([string]$File) { try { if (Test-Path -LiteralPath $File) { Get-Content -LiteralPath $File -Raw | ConvertFrom-Json } else { @{} } } catch { @{} } }
# Configuration changes only on an explicit user action. Re-reading the same
# files every 100 ms was part of the measured idle CPU cost; the timestamp is a
# cheap way to keep the loop responsive without parsing each time.
$whaleJsonCache = @{}
function Read-WhaleJsonCached([string]$File) {
    try {
        $item = Get-Item -LiteralPath $File -ErrorAction Stop
        $cached = $script:whaleJsonCache[$File]
        if ($cached -and $cached.Stamp -eq $item.LastWriteTimeUtc.Ticks) { return $cached.Value }
        $value = Read-WhaleJson $File
        $script:whaleJsonCache[$File] = @{ Stamp = $item.LastWriteTimeUtc.Ticks; Value = $value }
        return $value
    } catch { return (Read-WhaleJson $File) }
}
function Write-WhaleJsonAtomic([string]$File, $Value) {
    try {
        $temp = $File + '.tmp'
        [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temp -Destination $File -Force
    } catch { }
}
function Send-WhaleHost($State) {
    $whalePipeClient = $null; $whaleWriter = $null; $whaleReader = $null
    try {
        $whaleRuntime = Read-WhaleJson (Join-Path $DataDir 'runtime.json')
        if ($whaleRuntime.transport -ne 'local-ipc' -or !$whaleRuntime.pipe.StartsWith('\\.\pipe\codex-whale-') -or $whaleRuntime.pid -ne $whaleChild.Id) { return $false }
        $whalePipeName=$whaleRuntime.pipe.Substring(9)
        $whalePipeClient=[IO.Pipes.NamedPipeClientStream]::new('.', $whalePipeName, [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
        $whalePipeClient.Connect(300)
        $whaleWriter=[IO.StreamWriter]::new($whalePipeClient, [Text.UTF8Encoding]::new($false), 4096, $true)
        $whaleWriter.AutoFlush=$true
        $whalePacket=@{ token=$whaleRuntime.token; route='/internal/host'; method='POST'; body=$State } | ConvertTo-Json -Depth 8 -Compress
        $whaleWriter.WriteLine($whalePacket)
        $whaleReader=[IO.StreamReader]::new($whalePipeClient, [Text.UTF8Encoding]::new($false), $false, 4096, $true)
        $whaleReply=$whaleReader.ReadLineAsync()
        if (!$whaleReply.Wait(1500)) { return $false }
        return $true
    } catch { return $false }
    finally { if ($whaleWriter) { $whaleWriter.Dispose() }; if ($whaleReader) { $whaleReader.Dispose() }; if ($whalePipeClient) { $whalePipeClient.Dispose() } }
}
$whaleFatal = $false
$whaleStackAttempts = 0; $whaleStackRepairs = 0; $whaleLastStackAttempt = [DateTime]::MinValue
try {
    while ($true) {
        # While no widget is running there is nothing to follow: poll at 500 ms
        # instead of 100 ms. Once a child exists, keep the tight cadence.
        if ($whaleStop.WaitOne($(if ($whaleChild) { 100 } else { 500 }))) { break }
        $whaleNow = [DateTime]::UtcNow
        $whaleState = [WhaleWindows]::Probe()
        $whaleConfig = Read-WhaleJsonCached (Join-Path $DataDir 'follow-config.json')
        $whaleStandalone = $whaleConfig.mode -eq 'standalone'
        $whaleState['mode'] = if ($whaleStandalone) { 'standalone' } else { 'follow-codex' }
        if ($whaleStandalone -and $whaleOwner -ne '0') { [WhaleWindows]::Detach([long]$whaleOverlay); $whaleOwner='0' }
        $whalePause = Read-WhaleJsonCached (Join-Path $DataDir 'pause-until-host-exit.json')
        if (!$whaleState.hostAlive -and !$whalePause.pauseAll) { Remove-Item -LiteralPath (Join-Path $DataDir 'pause-until-host-exit.json') -ErrorAction SilentlyContinue }
        if ($whaleChild -and $whaleChild.HasExited) { [WhaleWindows]::StopFollowing(); $whaleChild.Dispose(); $whaleChild = $null; $whaleOverlay='0'; $whaleOwner='0'; $whaleLastMessage='' }
        if (!$whaleChild -and ($whaleState.hostAlive -or $whaleStandalone) -and ($whaleNow - $whaleLastLaunch).TotalSeconds -gt 4) {
            $whaleConfig = Read-WhaleJsonCached (Join-Path $DataDir 'follow-config.json')
            $whalePause = Read-WhaleJsonCached (Join-Path $DataDir 'pause-until-host-exit.json')
            if ($whaleConfig.enabled -eq $false -or $whalePause.pauseAll -eq $true -or ($whaleState.hostAlive -and [string]$whalePause.hostPid -eq [string]$whaleState.hostPid)) { continue }
            if (!(Test-Path -LiteralPath $whaleConfig.electronPath)) { throw 'Desktop runtime is missing.' }
            $whaleMain = Join-Path $whaleConfig.pluginRoot 'desktop\main.cjs'
            $whaleStart = [Diagnostics.ProcessStartInfo]::new()
            $whaleStart.FileName = $whaleConfig.electronPath
            $whaleStart.Arguments = '"' + $whaleMain + '" "--whale-data=' + $DataDir + '" --supervised'
            $whaleStart.WorkingDirectory = $whaleConfig.pluginRoot
            $whaleStart.UseShellExecute=$false; $whaleStart.CreateNoWindow=$true
            $whaleStart.RedirectStandardInput=$true; $whaleStart.RedirectStandardOutput=$true; $whaleStart.RedirectStandardError=$true
            $whaleStart.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
            $whaleStart.EnvironmentVariables['WHALE_INITIAL_HOST'] = ($whaleState | ConvertTo-Json -Depth 5 -Compress)
            $whaleStart.EnvironmentVariables['WHALE_LAUNCH_TIME'] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
            $whaleStart.EnvironmentVariables['WHALE_SUPERVISOR_PID'] = [string]$PID
            $whaleChild = [Diagnostics.Process]::new(); $whaleChild.StartInfo=$whaleStart
            [void]$whaleChild.Start(); $whaleLastLaunch=$whaleNow
            $whaleOutput=$whaleChild.StandardOutput.ReadLineAsync(); $whaleErrors=$whaleChild.StandardError.ReadLineAsync()
        }
        if ($whaleChild) {
            if ($whaleOutput -and $whaleOutput.IsCompleted) {
                try { $whaleLine=$whaleOutput.GetAwaiter().GetResult(); if ($whaleLine) { $whaleResponse=$whaleLine | ConvertFrom-Json; if ($whaleResponse.overlayHandle) { $whaleOverlay=[string]$whaleResponse.overlayHandle; $whaleTransitionsDisabled=[WhaleWindows]::ConfigureOverlay([long]$whaleOverlay) } } } catch { }
                $whaleOutput=$whaleChild.StandardOutput.ReadLineAsync()
            }
            for ($whaleDrain = 0; $whaleDrain -lt 50 -and $whaleErrors -and $whaleErrors.IsCompleted; $whaleDrain++) {
                try { $whaleErrorLine=$whaleErrors.GetAwaiter().GetResult() } catch { $whaleErrorLine=$null }
                if ($null -eq $whaleErrorLine) { $whaleErrors=$null; break }
                Add-WhaleStderr $whaleErrorLine
                $whaleErrors=$whaleChild.StandardError.ReadLineAsync()
            }
            if (!$whaleStandalone -and $whaleOverlay -ne '0' -and $whaleState.window -ne '0' -and $whaleOwner -ne $whaleState.window) {
                if ([WhaleWindows]::Attach([long]$whaleOverlay, [long]$whaleState.window)) { $whaleOwner=[string]$whaleState.window }
            }
            $whaleState['windowTransitionsDisabled'] = $whaleTransitionsDisabled
            $whaleState['widgetVisible'] = [WhaleWindows]::WidgetVisible([long]$whaleOverlay)
            $whaleState['attached'] = ($whaleOwner -ne '0' -and $whaleOwner -eq $whaleState.window)
            $whaleState['nativeFollowing'] = [WhaleWindows]::IsFollowing()
            $whaleState['visibilityRevision'] = [WhaleWindows]::VisibilityRevision()
            # Bounds belong to the native follower. Only lifecycle changes and
            # a one-second heartbeat use IPC/disk; there is no per-move I/O.
            $whaleMessage = if ($whaleState.nativeFollowing) { @($whaleState.mode,$whaleState.mouseButtons,$whaleState.hostAlive,$whaleState.hostPid,$whaleState.window,$whaleState.visible,$whaleState.modal,$whaleState.widgetVisible,$whaleState.visibilityRevision,$whaleState.attached,$whaleState.dpi,$whaleState.bounds.width,$whaleState.bounds.height,'native') -join '|' } else { $whaleState | ConvertTo-Json -Depth 5 -Compress }
            if ($whaleMessage -ne $whaleLastMessage -or ($whaleNow - $whaleHeartbeat).TotalSeconds -ge 1) {
                try {
                    $whaleState['visualDiagnostics'] = [WhaleWindowDiagnostics]::Snapshot([long]$whaleOverlay, [long]$whaleState.window)
                    # Capture evidence first. Correct only a verified owned
                    # window below its foreground host, with bounded retries.
                    if ($whaleState.visualDiagnostics.aboveHost) { $whaleStackAttempts = 0 }
                    if (!$whaleStandalone -and $whaleState.visualDiagnostics.orderKnown -and !$whaleState.visualDiagnostics.aboveHost -and $whaleStackAttempts -lt 3 -and ($whaleNow - $whaleLastStackAttempt).TotalSeconds -ge 2) {
                        if ([WhaleWindowStacking]::Repair([long]$whaleOverlay,$whaleChild.Id,[long]$whaleState.window,[int]$whaleState.hostPid)) {
                            $whaleStackAttempts++; $whaleStackRepairs++; $whaleLastStackAttempt=$whaleNow
                        }
                    }
                    $whaleState['stackRepairRequests'] = $whaleStackRepairs
                    $whaleSequence++; $whaleState['serial'] = $whaleSequence
                    if (Send-WhaleHost $whaleState) {
                        Write-WhaleJsonAtomic (Join-Path $DataDir 'follow-state.json') @{ childPid=$whaleChild.Id; state=$whaleState; native=[WhaleWindows]::FollowMetrics(); at=$whaleNow.ToString('o') }
                        $whaleLastMessage=$whaleMessage; $whaleHeartbeat=$whaleNow
                    }
                } catch { @{ message=$_.Exception.Message; at=$whaleNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'follow-input-error.json') -Encoding utf8 }
            }
        }
    }
} catch {
    $whaleFatal = $true
    @{ message=$_.Exception.Message; at=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDir 'supervisor-error.json') -Encoding utf8
} finally {
    [WhaleWindows]::StopFollowing()
    if ($whaleChild) {
        try { [void](Send-WhaleHost @{hostAlive=$false;monitorExit=$true}); $whaleChild.StandardInput.Close(); [void]$whaleChild.WaitForExit(7000) } catch { }
        $whaleChild.Dispose()
    }
    Remove-Item -LiteralPath $whaleStateFile -ErrorAction SilentlyContinue
    $whaleStop.Dispose(); $whaleMutex.Dispose()
}
if ($whaleFatal) { exit 1 }
