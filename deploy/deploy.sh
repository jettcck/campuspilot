#!/usr/bin/env bash
# ============================================================
# CampusPilot 服务器端一键部署脚本
# 适用：Ubuntu 20.04 / 22.04 / 24.04，Debian 12
#
# 用法：
#   sudo bash deploy/deploy.sh                          # 仅 HTTP（IP 访问）
#   sudo bash deploy/deploy.sh campus.example.com me@you.com   # 部署并自动签发 HTTPS 证书
#
# 也可用环境变量传入：DOMAIN / CERT_EMAIL / MONGODB_URI / AI_PROVIDER / AI_API_KEY
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[部署]${NC} $1"; }
warn()  { echo -e "${YELLOW}[提示]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

DOMAIN="${1:-${DOMAIN:-}}"
CERT_EMAIL="${2:-${CERT_EMAIL:-}}"

# ---------- 0. 环境检查 ----------
[[ $EUID -eq 0 ]] || error "请使用 root 权限执行：sudo bash deploy/deploy.sh"
[[ -f package.json ]] || error "请在项目根目录执行本脚本"
[[ -f docker-compose.yml ]] || error "缺少 docker-compose.yml"
if [[ -n "$DOMAIN" && -z "$CERT_EMAIL" ]]; then
  warn "已指定域名 $DOMAIN 但未提供证书邮箱，部署完成后将跳过自动签发证书"
  warn "如需 HTTPS，请稍后执行：sudo bash deploy/setup-https.sh $DOMAIN <邮箱>"
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  info "未检测到 Docker，开始安装…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null \
      || curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable docker
  systemctl start docker
  info "Docker 安装完成：$(docker --version)"
else
  info "Docker 已安装：$(docker --version)"
fi

docker compose version >/dev/null 2>&1 || error "缺少 docker compose 插件，请手动安装 docker-compose-plugin"

# ---------- 2. 生成 .env ----------
if [[ ! -f .env ]]; then
  info "未找到 .env，自动生成基础配置…"
  JWT_SECRET_VALUE=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "localhost")

  if [[ -n "$DOMAIN" ]]; then
    CLIENT_URL_VALUE="https://${DOMAIN}"
  else
    CLIENT_URL_VALUE="http://${PUBLIC_IP}"
    warn "未指定域名，将以 http://${PUBLIC_IP} 作为站点地址；纯 IP 无法签发受信任证书"
  fi

  # 没有数据库时必须显式开启文件存储，否则生产模式的启动校验会拒绝启动
  if [[ -n "${MONGODB_URI:-}" ]]; then
    ALLOW_FILE_STORAGE_VALUE=false
  else
    ALLOW_FILE_STORAGE_VALUE=true
  fi

  cat > .env <<EOF
NODE_ENV=production
PORT=3001
# 站点对外地址：同时作为 CORS 白名单与 HTTPS 跳转的目标
CLIENT_URL=${CLIENT_URL_VALUE}
# 反向代理之后必须信任一层代理，限流才能按真实客户端 IP 统计
TRUST_PROXY=true
# 强制 HTTPS：代理声明原始协议为 http 时返回 301
ENFORCE_HTTPS=true
LOG_LEVEL=info

JWT_SECRET=${JWT_SECRET_VALUE}

# 留空则使用本地文件存储（数据落在 appdata 数据卷中，容器重建不丢）
MONGODB_URI=${MONGODB_URI:-}
ALLOW_FILE_STORAGE=${ALLOW_FILE_STORAGE_VALUE}

# AI_PROVIDER 可选：deepseek / qwen / zhipu / moonshot / openai / ollama
# 切换厂商只改这一行，baseUrl 与 model 自动套用对应预设
AI_PROVIDER=${AI_PROVIDER:-deepseek}
AI_API_KEY=${AI_API_KEY:-}
# 以下两项留空即用 AI_PROVIDER 的预设值，需要自定义网关或私有部署时再填
# AI_BASE_URL=
# AI_MODEL=

UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=10485760
EOF
  if [[ "$ALLOW_FILE_STORAGE_VALUE" == "true" ]]; then
    warn "未提供 MONGODB_URI，已启用本地文件存储（appdata 数据卷，请勿执行 docker compose down -v）"
    warn "如需使用 MongoDB，请在 .env 填写 MONGODB_URI 后执行 docker compose up -d"
  fi
  warn "已生成 .env，建议后续手动填写 AI_API_KEY 以启用真实大模型"
else
  info "检测到已有 .env，跳过生成"
fi

# ---------- 3. 放行防火墙 ----------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  info "放行 80 / 443 端口"
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
else
  warn "未启用 ufw；请确认云服务器安全组已放行 80 / 443 端口（HTTPS 需要 443）"
fi

# ---------- 4. 构建并启动 ----------
info "开始构建镜像（首次约需 1-3 分钟）…"
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose build --no-cache
docker compose up -d

# ---------- 5. 健康检查 ----------
# 直接探测应用容器暴露在宿主机的端口：
# 80 端口只做 HTTPS 跳转，用它做探针只能证明 Nginx 活着，证明不了应用可用
info "等待服务就绪…"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/api/health/ready >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -sf http://127.0.0.1:3001/api/health/ready >/dev/null 2>&1; then
  SITE_URL=$(grep -oP '^CLIENT_URL=\K.*' .env | head -1 || echo "http://localhost")
  AI_MODE=$(curl -sf --max-time 20 http://127.0.0.1:3001/api/ai/status | grep -oP '"mode":"\K[^"]+' || echo "unknown")
  echo ""
  info "应用已就绪"
  echo "  访问地址：${SITE_URL}"
  echo "  AI 状态：${AI_MODE}"
  echo "  首次使用请注册账号（工作台支持一键导入示例数据）"
  echo ""
  if [[ "$AI_MODE" != "remote" ]]; then
    warn "AI 未接通（当前 ${AI_MODE}）；如需真实大模型，请填写服务器上 .env 的 AI_API_KEY 后执行 docker compose up -d"
  fi
  docker compose ps

  # ---------- 6. HTTPS 证书 ----------
  if [[ -n "$DOMAIN" && -n "$CERT_EMAIL" ]]; then
    info "开始配置 HTTPS 强制跳转…"
    bash deploy/setup-https.sh "$DOMAIN" "$CERT_EMAIL"
  elif [[ -n "$DOMAIN" ]]; then
    warn "缺少证书邮箱，已跳过 HTTPS 签发。稍后执行：sudo bash deploy/setup-https.sh $DOMAIN <邮箱>"
  else
    warn "未指定域名，当前仅支持 HTTP 访问；提供域名后可执行：sudo bash deploy/setup-https.sh <域名> <邮箱>"
  fi
else
  error "健康检查失败，请执行 docker compose logs -f app 查看日志"
fi