# Windows 개발 실행기. 환경은 이 프로세스에서만 바꾸며 기존 secret/DB는 보존한다.
# Java/Vite는 직접 실행해 PID를 소유하고 종료 시 이번 실행의 자식만 정리한다.
param([switch]$Rebuild, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = if ($env:SC_HOME) { $env:SC_HOME } else { Join-Path $projectRoot '.runtime\dev' }
if ($runtimeRoot -notmatch '^(?:[A-Za-z]:[\\/]|\\\\)') {
    throw 'SC_HOME must be an absolute Windows path.'
}
$runtimeRoot = [IO.Path]::GetFullPath($runtimeRoot)
$runDirectory = Join-Path $runtimeRoot 'run'
$stopFile = Join-Path $runDirectory 'dev.stop'
if ($Stop) {
    if (!(Test-Path -LiteralPath (Join-Path $runDirectory 'dev.pid'))) {
        throw 'No Windows development launcher is running for this SC_HOME.'
    }
    [IO.File]::WriteAllText($stopFile, '')
    Write-Host 'Development server stop requested.'
    exit 0
}

# 별도 포트/자료를 지정할 수 있지만 외부 Spring/JVM/다른 앱의 설정은 상속하지 않는다.
$savedEnvironment = @{}
Get-ChildItem Env: | ForEach-Object { $savedEnvironment[$_.Name] = $_.Value }
$server = $null
$frontend = $null
$ownsLock = $false
$lockDirectory = Join-Path $runDirectory 'app.lock'
$exitCode = 0
function Assert-FreePort([int]$Port) {
    if ($Port -lt 1024 -or $Port -gt 65535) { throw "Invalid development port: $Port" }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    $listener.Server.ExclusiveAddressUse = $true
    try { $listener.Start() } catch { throw "Port $Port is already in use." }
    finally { $listener.Stop() }
}
function Wait-Ready([string]$Url, [Diagnostics.Process]$Child, [string]$LogPath) {
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $stopFile) { throw 'Development startup was stopped.' }
        if ($Child.HasExited) { throw "Process exited ($($Child.ExitCode)). Check $LogPath" }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch [System.Net.WebException] { }
        Start-Sleep -Milliseconds 250
    }
    throw "Startup timed out: $Url. Check $LogPath"
}
try {
    Set-Location -LiteralPath $projectRoot
    Get-ChildItem Env: | Where-Object {
        $_.Name -match '^(APP_|WORKBOARD_|SPRING_|SERVER_|LOGGING_|MANAGEMENT_)' -or
        $_.Name -in @('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS')
    } | ForEach-Object { Remove-Item -LiteralPath "Env:$($_.Name)" }

    # Git Bash 환경변수도 Windows npm을 통해 이 실행기로 들어올 수 있다.
    function Convert-JavaPath([string]$Value) {
        if ($Value -match '^/([A-Za-z])/(.*)$') { return "$($Matches[1]):/$($Matches[2])" }
        return $Value
    }
    $java = if ($env:JAVA21_HOME) { Join-Path (Convert-JavaPath $env:JAVA21_HOME) 'bin\java.exe' }
        elseif ($env:JAVA_BIN) { Convert-JavaPath $env:JAVA_BIN }
        elseif ($env:JAVA_HOME) { Join-Path (Convert-JavaPath $env:JAVA_HOME) 'bin\java.exe' }
        else { (Get-Command java.exe -ErrorAction Stop).Source }
    if (!(Test-Path -LiteralPath $java)) { throw 'JDK 21 not found. Set JAVA21_HOME or JAVA_HOME.' }
    # Java의 정상 version 출력도 stderr이므로 PS 5.1 오류 처리와 분리해 읽는다.
    $javaInfo = [Diagnostics.ProcessStartInfo]::new($java, '-version')
    $javaInfo.UseShellExecute = $false
    $javaInfo.CreateNoWindow = $true
    $javaInfo.RedirectStandardError = $true
    $javaCheck = [Diagnostics.Process]::Start($javaInfo)
    $javaVersion = $javaCheck.StandardError.ReadToEnd()
    $javaCheck.WaitForExit()
    if ($javaCheck.ExitCode -ne 0 -or $javaVersion -notmatch 'version "21\.') {
        throw 'This project requires JDK 21.'
    }
    $javaCheck.Dispose()
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java)
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $serverPort = if ($env:SC_PORT) { [int]$env:SC_PORT } else { 18082 }
    $frontendPort = if ($env:SC_FRONTEND_PORT) { [int]$env:SC_FRONTEND_PORT } else { 5175 }
    if ($serverPort -eq $frontendPort) { throw 'Frontend and backend ports must be different.' }
    Assert-FreePort $serverPort
    Assert-FreePort $frontendPort
    $profile = if ($env:SC_PROFILE) { $env:SC_PROFILE } else { 'dev' }
    if ($profile -notin @('dev', 'dev,operations')) { throw 'SC_PROFILE must be dev or dev,operations.' }
    # 제품명을 명시할 때만 외부 개발 DB를 사용하며, 기본 H2의 격리 실행 계약은 유지한다.
    $dbVendor = if ($env:SC_DB_VENDOR) { $env:SC_DB_VENDOR } else { 'h2' }
    $dbProfiles = @{ h2 = 'db-h2'; oracle = 'db-oracle'; db2 = 'db-db2'; sqlserver = 'db-mssql'; postgresql = 'db-postgresql' }
    if (!$dbProfiles.ContainsKey($dbVendor)) { throw 'SC_DB_VENDOR must be h2/oracle/db2/sqlserver/postgresql.' }
    if ($dbVendor -ne 'h2' -and (!$env:SC_DB_URL -or !$env:SC_DB_USERNAME -or $null -eq $env:SC_DB_PASSWORD)) {
        throw 'External development DB requires SC_DB_URL, SC_DB_USERNAME and SC_DB_PASSWORD.'
    }

    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $lockDirectory -ErrorAction Stop | Out-Null
    $ownsLock = $true
    if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
    [IO.File]::WriteAllText((Join-Path $runDirectory 'dev.pid'), [string]$PID)
    $jar = Join-Path $projectRoot 'backend\reference-app\target\sc-reference-app.jar'
    if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
        & $npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    }
    $missingLibrary = @('date', 'i18n', 'excel', 'ui', 'runtime') | Where-Object {
        !(Test-Path -LiteralPath (Join-Path $projectRoot "frontend\packages\$_\dist\index.js"))
    }
    if ($Rebuild -or $missingLibrary -or !(Test-Path -LiteralPath $jar)) {
        & $npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    }
    if ($Rebuild -or !(Test-Path -LiteralPath $jar)) {
        # 개발 기동용 패키징이다. 전체 검증은 기존 build.sh/CI와 별도로 수행한다.
        & (Join-Path $projectRoot 'backend\mvnw.cmd') -B -ntp -f backend/pom.xml '-DskipTests' "-P$($dbProfiles[$dbVendor])" package
        if ($LASTEXITCODE -ne 0) { throw 'Backend packaging failed.' }
    }

    $logs = Join-Path $runtimeRoot 'logs'
    $secrets = Join-Path $runtimeRoot 'secrets'
    New-Item -ItemType Directory -Path $logs, $secrets, (Join-Path $runtimeRoot 'data'), (Join-Path $runtimeRoot 'uploads') -Force | Out-Null
    # Windows에서는 POSIX 600 대신 현재 사용자만 접근 가능한 ACL을 적용한다.
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    function Set-PrivateAccess([string]$Path, [bool]$Directory) {
        $acl = Get-Acl -LiteralPath $Path
        $rules = @($acl.Access)
        # 이미 현재 사용자 전용이면 보안 설명자를 다시 쓰지 않는다.
        if ($acl.AreAccessRulesProtected -and $rules.Count -eq 1 -and
            $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid.Value -and
            $rules[0].AccessControlType -eq 'Allow' -and $rules[0].FileSystemRights -eq 'FullControl') { return }
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }
        $rule = if ($Directory) {
            [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        } else { [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow') }
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $Path -AclObject $acl
    }
    Set-PrivateAccess $secrets $true
    $secretFile = Join-Path $secrets 'bootstrap.secret'
    if (!(Test-Path -LiteralPath $secretFile)) {
        $randomBytes = New-Object byte[] 24
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
        [IO.File]::WriteAllText($secretFile, [Convert]::ToBase64String($randomBytes), [Text.UTF8Encoding]::new($false))
    }
    Set-PrivateAccess $secretFile $false

    $env:SC_HOME = $runtimeRoot
    $env:SC_PORT = [string]$serverPort
    $env:SC_ADDRESS = '127.0.0.1'
    $env:SC_APP = 'reference'
    $env:SC_APP_JAR = $jar
    $env:SC_DB_BASE = (Join-Path $runtimeRoot 'data\sc-reference').Replace('\', '/')
    $env:SC_DB_VENDOR = $dbVendor
    if ($dbVendor -eq 'h2') {
        $env:SC_DB_URL = "jdbc:h2:file:$env:SC_DB_BASE;DB_CLOSE_ON_EXIT=FALSE"
        $env:SC_DB_USERNAME = 'sa'
        $env:SC_DB_PASSWORD = ''
    }
    $env:SC_BOOTSTRAP_USERNAME = 'admin'
    $env:SC_BOOTSTRAP_SECRET_FILE = $secretFile
    $env:SC_LOG_FILE = Join-Path $logs 'application.log'
    $env:SC_UPLOAD_DIR = Join-Path $runtimeRoot 'uploads'
    $env:SC_ECHO_URL = 'http://127.0.0.1:9'
    $env:SPRING_PROFILES_ACTIVE = $profile
    $env:SC_API_TARGET = "http://127.0.0.1:$serverPort"
    $backendLog = Join-Path $logs 'backend.stdout.log'
    $server = Start-Process -FilePath $java -ArgumentList @('-Xms128m', '-Xmx512m', '-jar', "`"$jar`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $backendLog -RedirectStandardError (Join-Path $logs 'backend.stderr.log')
    [IO.File]::WriteAllText((Join-Path $runDirectory 'app.pid'), [string]$server.Id)
    [IO.File]::WriteAllText((Join-Path $runDirectory 'app.jar'), $jar)
    Write-Host "Starting Spring: http://127.0.0.1:$serverPort (logs: $logs)"
    Wait-Ready "$env:SC_API_TARGET/api/health" $server $backendLog
    $vite = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
    $frontendLog = Join-Path $logs 'frontend.stdout.log'
    $frontend = Start-Process -FilePath $node -ArgumentList @("`"$vite`"", '--host', '127.0.0.1', '--port', $frontendPort, '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend\apps\reference-app') -WindowStyle Hidden -PassThru -RedirectStandardOutput $frontendLog -RedirectStandardError (Join-Path $logs 'frontend.stderr.log')
    Wait-Ready "http://127.0.0.1:$frontendPort" $frontend $frontendLog
    Write-Host "Vue: http://localhost:$frontendPort"
    Write-Host "Spring: http://localhost:$serverPort"
    Write-Host "Admin: admin / password file: $secretFile"
    Write-Host 'Stop: Ctrl+C (or npm run dev -- --stop in another terminal)'
    while (!(Test-Path -LiteralPath $stopFile)) {
        if ($server.HasExited -or $frontend.HasExited) { throw "Development process exited. Check $logs" }
        Start-Sleep -Milliseconds 300
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "At $($_.InvocationInfo.ScriptName):$($_.InvocationInfo.ScriptLineNumber)"
    $exitCode = 1
} finally {
    # PID 검색/일괄 종료 없이 이번 실행에서 얻은 Process 객체만 종료한다.
    foreach ($child in @($frontend, $server)) {
        if ($null -ne $child -and !$child.HasExited) {
            Stop-Process -InputObject $child -ErrorAction SilentlyContinue
            $child.WaitForExit()
        }
    }
    if ($ownsLock) {
        foreach ($name in @('dev.pid', 'app.pid', 'app.jar', 'dev.stop')) {
            $ownedFile = Join-Path $runDirectory $name
            if (Test-Path -LiteralPath $ownedFile) { Remove-Item -LiteralPath $ownedFile }
        }
        # 내용이 없는 소유 잠금 디렉터리만 삭제한다. 실행 자료는 삭제하지 않는다.
        [IO.Directory]::Delete($lockDirectory)
    }
    Get-ChildItem Env: | Where-Object { !$savedEnvironment.ContainsKey($_.Name) } |
        ForEach-Object { Remove-Item -LiteralPath "Env:$($_.Name)" }
    foreach ($name in $savedEnvironment.Keys) { Set-Item -LiteralPath "Env:$name" -Value $savedEnvironment[$name] }
}
exit $exitCode
