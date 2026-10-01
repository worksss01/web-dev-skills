# Read-only Windows developer-environment diagnostics. Compatible syntax: PS 5.1+.
[CmdletBinding()]
param(
    [string]$ProjectRoot = '.',
    [ValidateRange(1,65535)][int[]]$Ports = @(),
    [string]$PortList,
    [string]$OutFile
)
$ErrorActionPreference = 'Stop'
if ($PortList) {
    if ($PortList -notmatch '^\d+(,\d+)*$') { throw 'PortList must contain comma-separated integers' }
    foreach ($portText in $PortList.Split(',')) { $portValue = [int]$portText; if ($portValue -lt 1 -or $portValue -gt 65535) { throw 'PortList value is out of range' }; $Ports += $portValue }
}
$report = [ordered]@{
    schema = 1
    observedAt = [DateTime]::UtcNow.ToString('o')
    supported = ($env:OS -eq 'Windows_NT')
    powerShell = [ordered]@{ version = $PSVersionTable.PSVersion.ToString(); edition = $PSVersionTable.PSEdition }
    os = $null
    project = $null
    tools = @()
    executionPolicies = @()
    ports = @()
    warnings = @()
    note = 'Read-only report. No process termination, policy/firewall/PATH changes, tool installs or WSL startup. Paths describe this machine only and are not portable configuration. No environment-variable values or process command lines are collected.'
}
if ($report.supported) {
    try {
        $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -OperationTimeoutSec 5
        $report.os = [ordered]@{ caption = $osInfo.Caption; version = $osInfo.Version; build = $osInfo.BuildNumber; architecture = $osInfo.OSArchitecture }
    } catch { $report.warnings += 'OS details unavailable; Windows kernel version alone does not identify the product edition.' }
    $resolvedProject = (Resolve-Path -LiteralPath $ProjectRoot).Path
    if (-not (Test-Path -LiteralPath $resolvedProject -PathType Container)) { throw 'ProjectRoot must be a directory' }
    $report.project = [ordered]@{ path = $resolvedProject; pathLength = $resolvedProject.Length; containsSpaces = $resolvedProject.Contains(' '); isWSLShare = ($resolvedProject -match '^\\\\wsl(?:\$|\.localhost)\\'); hasGitEntry = (Test-Path -LiteralPath (Join-Path $resolvedProject '.git')) }
    foreach ($toolName in @('node.exe','npm.cmd','git.exe','gh.exe','pwsh.exe','wsl.exe')) {
        $toolMatches = @(Get-Command -Name $toolName -CommandType Application -All -ErrorAction SilentlyContinue)
        $toolPaths = @($toolMatches | ForEach-Object { $_.Source } | Select-Object -Unique)
        $report.tools += [ordered]@{ name = $toolName; found = ($toolPaths.Count -gt 0); paths = $toolPaths }
        if ($toolPaths.Count -gt 1) { $report.warnings += "Multiple PATH candidates for $toolName; confirm the runtime used by the project." }
    }
    try { $report.executionPolicies = @(Get-ExecutionPolicy -List | ForEach-Object { [ordered]@{ scope = $_.Scope.ToString(); policy = $_.ExecutionPolicy.ToString() } }) }
    catch { $report.warnings += 'Execution-policy query unavailable.' }
    if ($Ports.Count -gt 0) {
        try {
            $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
            foreach ($portNumber in @($Ports | Select-Object -Unique)) {
                $owners = @()
                foreach ($listener in @($listeners | Where-Object { $_.LocalPort -eq $portNumber })) {
                    $ownerName = $null
                    try { $ownerName = (Get-Process -Id $listener.OwningProcess -ErrorAction Stop).ProcessName } catch {}
                    $owners += [ordered]@{ address = $listener.LocalAddress; processId = $listener.OwningProcess; processName = $ownerName }
                }
                $report.ports += [ordered]@{ port = $portNumber; querySucceeded = $true; listening = ($owners.Count -gt 0); owners = $owners }
            }
        } catch {
            foreach ($portNumber in @($Ports | Select-Object -Unique)) { $report.ports += [ordered]@{ port = $portNumber; querySucceeded = $false; listening = $null; owners = @() } }
            $report.warnings += 'TCP listener query unavailable; a failed query does not mean the ports are free.'
        }
    }
} else {
    $report.warnings += 'This helper inspects native Windows only. Run it in Windows PowerShell/PowerShell on Windows; use the WSL guidance separately.'
}
$json = $report | ConvertTo-Json -Depth 12
if ($OutFile) {
    $destination = [System.IO.Path]::GetFullPath($OutFile)
    $parentDirectory = [System.IO.Path]::GetDirectoryName($destination)
    if ($destination -eq [System.IO.Path]::GetFullPath($PSCommandPath)) { throw 'Output cannot overwrite the running script' }
    if (Test-Path -LiteralPath $destination) {
        $outputItem = Get-Item -LiteralPath $destination -Force
        if ($outputItem.PSIsContainer -or ($outputItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or $outputItem.LinkType -eq 'HardLink') { throw 'Output must not replace a link or directory' }
    }
    [System.IO.Directory]::CreateDirectory($parentDirectory) | Out-Null
    $temporaryOutput = Join-Path $parentDirectory ('.web-debug-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [System.IO.File]::WriteAllText($temporaryOutput, $json, (New-Object System.Text.UTF8Encoding($false)))
        if (Test-Path -LiteralPath $destination) { [System.IO.File]::Replace($temporaryOutput, $destination, [NullString]::Value) }
        else { [System.IO.File]::Move($temporaryOutput, $destination) }
    } finally { if (Test-Path -LiteralPath $temporaryOutput) { [System.IO.File]::Delete($temporaryOutput) } }
}
# Keep stdout valid across inherited Windows console code pages without changing
# the user's console encoding. JSON readers recover the original Unicode text.
$consoleJson = [regex]::Replace($json, '[^\x00-\x7F]', [System.Text.RegularExpressions.MatchEvaluator]{ param($match) '\u{0:x4}' -f [int][char]$match.Value[0] })
Write-Output $consoleJson
