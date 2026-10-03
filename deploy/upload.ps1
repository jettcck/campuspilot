# ============================================================
# CampusPilot 本地上传部署脚本（Windows / PowerShell）
# 用法：
#   .\deploy\upload.ps1 -Server 1.2.3.4 -User root
#   .\deploy\upload.ps1 -Server 1.2.3.4 -User root -Key C:\keys\id_rsa
#   .\deploy\upload.ps1 -Server 1.2.3.4 -User root -Domain campus.example.com -CertEmail me@example.com
# ============================================================
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [string]$User = "root",
    [int]$Port = 22,
    [string]$Key = "",
    [string]$RemoteDir = "/opt/campuspilot",
    # 可选：提供域名与证书邮箱后，远程部署完会顺带签发 HTTPS 证书并开启强制跳转
    [string]$Domain = "",
    [string]$CertEmail = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Archive = Join-Path $env:TEMP "campuspilot-$(Get-Date -Format 'yyyyMMddHHmmss').tar.gz"

if ($Domain -and -not $CertEmail) {
    Write-Host "已指定 -Domain 但未提供 -CertEmail，将跳过自动签发证书" -ForegroundColor Yellow
    Write-Host "稍后可在服务器执行：sudo bash deploy/setup-https.sh $Domain <邮箱>" -ForegroundColor Yellow
}

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
$remoteArgs = ""
if ($Domain) { $remoteArgs += " '$Domain'" }
if ($CertEmail) { $remoteArgs += " '$CertEmail'" }
& ssh @sshArgs $Target @"
set -e
cd $RemoteDir
tar -xzf campuspilot.tar.gz
rm -f campuspilot.tar.gz
if [ -f .env ]; then echo '检测到已有 .env，保留原配置'; fi
bash deploy/deploy.sh$remoteArgs
"@

Write-Host ""
if ($Domain -and $CertEmail) {
    Write-Host "部署完成，访问 https://$Domain 即可（HTTP 会自动 301 跳转到 HTTPS）" -ForegroundColor Green
} elseif ($Domain) {
    Write-Host "部署完成，访问 http://$Server 即可；如需 HTTPS 请在服务器执行：" -ForegroundColor Green
    Write-Host "  sudo bash deploy/setup-https.sh $Domain <证书邮箱>" -ForegroundColor Green
} else {
    Write-Host "部署完成，访问 http://$Server 即可" -ForegroundColor Green
}
Remove-Item $Archive -ErrorAction SilentlyContinue