#!/usr/bin/env bash
# ============================================================
# CampusPilot 服务器端一键部署脚本
# 适用：Ubuntu 20.04 / 22.04 / 24.04，Debian 12
# 用法：sudo bash deploy/deploy.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[部署]${NC} $1"; }
warn()  { echo -e "${YELLOW}[提示]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# ---------- 0. 环境检查 ----------
[[ $EUID -eq 0 ]] || error "请使用 root 权限执行：sudo bash deploy/deploy.sh"
[[ -f package.json ]] || error "请在项目根目录执行本脚本"
[[ -f docker-compose.yml ]] || error "缺少 docker-compose.yml"

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
  cat > .env <<EOF
NODE_ENV=production
PORT=3001
CLIENT_URL=http://${PUBLIC_IP}
JWT_SECRET=${JWT_SECRET_VALUE}
MONGODB_URI=
AI_API_KEY=
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=10485760
EOF
  warn "已生成 .env，建议后续手动填写 MONGODB_URI 与 AI_API_KEY"
else
  info "检测到已有 .env，跳过生成"
fi

# ---------- 3. 放行防火墙 ----------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  info "放行 80 / 443 端口"
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
else
  warn "未启用 ufw；请确认云服务器安全组已放行 80 端口"
fi

# ---------- 4. 构建并启动 ----------
info "开始构建镜像（首次约需 1-3 分钟）…"
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose build --no-cache
docker compose up -d

# ---------- 5. 健康检查 ----------
info "等待服务就绪…"
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -sf http://localhost/api/health >/dev/null 2>&1; then
  PUBLIC_IP=$(grep -oP 'CLIENT_URL=\K.*' .env | head -1 || echo "http://localhost")
  echo ""
  info "部署成功！"
  echo "  访问地址：${PUBLIC_IP}"
  echo "  接口地址：${PUBLIC_IP}/api/health"
  echo "  演示账号：demo@campuspilot.dev / Demo123456"
  echo ""
  docker compose ps
else
  error "健康检查失败，请执行 docker compose logs -f app 查看日志"
fi