# ============================================================
# CampusPilot 本地一键启动脚本（Windows / PowerShell）
# 作用：拉起后端服务 + Cloudflare 临时隧道，并自动打印公网地址
#
# 用法：
#   .\deploy\start-local.ps1                 # 启动后端 + 隧道
#   .\deploy\start-local.ps1 -SkipTunnel    # 只启动后端
#   .\deploy\start-local.ps1 -Port 3001     # 自定义端口
#
# 停止：在窗口按 Ctrl+C，会自动关闭后端与隧道进程
# ============================================================
param(
    [int]$Port = 3001,
    [switch]$SkipTunnel
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $ProjectRoot ".run"
$BackendProc = $null
$TunnelProc = $null

# ---------- 工具函数 ----------
function Free-Port([int]$p) {
    $pids = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        Write-Host "      端口 $p 被进程 $procId 占用，正在结束..." -ForegroundColor Yellow
        taskkill /PID $procId /T /F 2>$null | Out-Null
    }
    if ($pids) { Start-Sleep -Milliseconds 800 }
}

function Wait-Url([string[]]$Files, [string]$Pattern, [int]$TimeoutSec = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        foreach ($f in $Files) {
            if (Test-Path $f) {
                $hit = Select-String -Path $f -Pattern $Pattern -AllMatches -ErrorAction SilentlyContinue
                if ($hit -and $hit.Matches.Count -gt 0) { return $hit.Matches[0].Value }
            }
        }
    }
    return $null
}

function Stop-Everything {
    foreach ($proc in @($script:TunnelProc, $script:BackendProc)) {
        if ($proc -and -not $proc.HasExited) {
            taskkill /PID $proc.Id /T /F 2>$null | Out-Null
        }
    }
}

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$BackendOut = Join-Path $RunDir "backend.out.log"
$BackendErr = Join-Path $RunDir "backend.err.log"
$TunnelOut = Join-Path $RunDir "tunnel.out.log"
$TunnelErr = Join-Path $RunDir "tunnel.err.log"
$UrlFile = Join-Path $RunDir "public-url.txt"

try {
    Set-Location $ProjectRoot

    # ---------- [0/5] 清理上一次的残留 ----------
    Write-Host "[0/5] 清理端口与上次日志..." -ForegroundColor Green
    Free-Port $Port
    Remove-Item $BackendOut, $BackendErr, $TunnelOut, $TunnelErr, $UrlFile -ErrorAction SilentlyContinue
    # IDE 重启后可能残留该变量，会关闭 TLS 证书校验，这里在会话内剔除
    Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue

    # ---------- [1/5] 检查依赖 ----------
    Write-Host "[1/5] 检查项目依赖..." -ForegroundColor Green
    if (-not (Test-Path (Join-Path $ProjectRoot ".env"))) {
        if (Test-Path (Join-Path $ProjectRoot ".env.example")) {
            Copy-Item (Join-Path $ProjectRoot ".env.example") (Join-Path $ProjectRoot ".env")
            Write-Host "      未找到 .env，已从 .env.example 生成，请按需填写 AI_API_KEY" -ForegroundColor Yellow
        } else {
            throw "缺少 .env 文件，请在项目根目录创建"
        }
    }
    if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Host "      未找到 node_modules，正在安装依赖（首次较慢）..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
    }

    # ---------- [2/5] 启动后端 ----------
    Write-Host "[2/5] 启动后端服务（端口 $Port）..." -ForegroundColor Green
    $BackendProc = Start-Process -FilePath "node" -ArgumentList "server/index.js" `
        -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $BackendOut -RedirectStandardError $BackendErr

    $health = $null
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        if ($BackendProc.HasExited) { break }
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($health.success) { break }
        } catch { $health = $null }
    }
    if (-not $health -or -not $health.success) {
        Write-Host "      后端启动失败，错误日志：" -ForegroundColor Red
        if (Test-Path $BackendErr) { Get-Content $BackendErr -Encoding UTF8 | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor Red } }
        throw "后端未能通过健康检查"
    }
    $aiMode = (Get-Content $BackendOut -Encoding UTF8 -ErrorAction SilentlyContinue | Select-String "AI 模式").Line
    Write-Host "      后端已就绪：http://localhost:$Port" -ForegroundColor Green
    if ($aiMode) { Write-Host "      $($aiMode.Trim())" }

    if ($SkipTunnel) {
        Write-Host ""
        Write-Host "已跳过隧道（-SkipTunnel），仅本机可访问 http://localhost:$Port" -ForegroundColor Green
        Write-Host "按 Ctrl+C 停止后端服务。" -ForegroundColor DarkGray
        while ($true) { Start-Sleep -Seconds 3600 }
    }

    # ---------- [3/5] 准备 cloudflared ----------
    Write-Host "[3/5] 检查 Cloudflare 隧道程序..." -ForegroundColor Green
    $cf = Join-Path $env:TEMP "cloudflared.exe"
    if (-not (Test-Path $cf)) {
        Write-Host "      未找到 cloudflared，正在下载..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cf
    }
    Write-Host "      已就绪：$cf"

    # ---------- [4/5] 启动隧道 ----------
    Write-Host "[4/5] 启动公网隧道..." -ForegroundColor Green
    $TunnelProc = Start-Process -FilePath $cf `
        -ArgumentList "tunnel", "--url", "http://localhost:$Port", "--no-autoupdate" `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $TunnelOut -RedirectStandardError $TunnelErr

    $publicUrl = Wait-Url -Files @($TunnelErr, $TunnelOut) -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -TimeoutSec 60

    # ---------- [5/5] 输出结果 ----------
    Write-Host ""
    if ($publicUrl) {
        $publicUrl | Set-Content -Path $UrlFile -Encoding UTF8
        Write-Host "[5/5] 启动完成" -ForegroundColor Green
        Write-Host ""
        Write-Host "  本机访问： http://localhost:$Port" -ForegroundColor Cyan
        Write-Host "  公网访问： $publicUrl" -ForegroundColor Cyan
        Write-Host "  API 自检： $publicUrl/api/ai/status" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  演示账号： demo@campuspilot.dev / Demo123456" -ForegroundColor DarkGray
        Write-Host "  地址已存至： $UrlFile" -ForegroundColor DarkGray
    } else {
        Write-Host "[5/5] 隧道已启动，但未能自动解析公网地址" -ForegroundColor Yellow
        Write-Host "      请查看日志：$TunnelErr" -ForegroundColor Yellow
        Write-Host "      登录页仍可用：http://localhost:$Port" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "服务运行中，按 Ctrl+C 停止全部服务。" -ForegroundColor DarkGray
    while ($true) { Start-Sleep -Seconds 3600 }
}
finally {
    Write-Host ""
    Write-Host "正在关闭后端与隧道..." -ForegroundColor Yellow
    Stop-Everything
    Write-Host "已全部停止。" -ForegroundColor Green
}