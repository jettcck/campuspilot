# ============================================================
# CampusPilot 本地上传部署脚本（Windows / PowerShell）
# 用法：
#   .\deploy\upload.ps1 -Server 1.2.3.4 -User root
#   .\deploy\upload.ps1 -Server 1.2.3.4 -User root -Key C:\keys\id_rsa
# ============================================================
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [string]$User = "root",
    [int]$Port = 22,
    [string]$Key = "",
    [string]$RemoteDir = "/opt/campuspilot"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Archive = Join-Path $env:TEMP "campuspilot-$(Get-Date -Format 'yyyyMMddHHmmss').tar.gz"

Write-Host "[1/4] 打包项目（排除 node_modules / dist / 本地数据）..." -ForegroundColor Green
Push-Location $ProjectRoot
try {
    tar -czf $Archive `
        --exclude=node_modules `
        --exclude=dist `
        --exclude=.git `
        --exclude=server/data `
        --exclude=uploads `
        --exclude=.env `
        --exclude=*.log `
        .
    if ($LASTEXITCODE -ne 0) { throw "打包失败" }
} finally {
    Pop-Location
}
$Size = [math]::Round((Get-Item $Archive).Length / 1MB, 2)
Write-Host "      打包完成：$Archive ($Size MB)"

# 组装 ssh / scp 参数
$sshArgs = @("-p", "$Port")
$scpArgs = @("-P", "$Port")
if ($Key) { $sshArgs += @("-i", $Key); $scpArgs += @("-i", $Key) }

$Target = "$User@$Server"

Write-Host "[2/4] 检查服务器连通性..." -ForegroundColor Green
& ssh @sshArgs -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new $Target "echo ok" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "无法连接服务器 $Target，请检查 IP、端口与密钥" }

Write-Host "[3/4] 上传代码到 $RemoteDir ..." -ForegroundColor Green
& ssh @sshArgs $Target "mkdir -p $RemoteDir"
& scp @scpArgs $Archive "$Target`:$RemoteDir/campuspilot.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "上传失败" }

Write-Host "[4/4] 远程解压并执行部署脚本..." -ForegroundColor Green
& ssh @sshArgs $Target @"
set -e
cd $RemoteDir
tar -xzf campuspilot.tar.gz
rm -f campuspilot.tar.gz
if [ -f .env ]; then echo '检测到已有 .env，保留原配置'; fi
bash deploy/deploy.sh
"@

Write-Host ""
Write-Host "部署完成，访问 http://$Server 即可" -ForegroundColor Green
Remove-Item $Archive -ErrorAction SilentlyContinue