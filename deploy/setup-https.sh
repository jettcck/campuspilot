#!/usr/bin/env bash
# ============================================================
# CampusPilot HTTPS 证书签发脚本（自建服务器）
# 适用：Ubuntu 20.04 / 22.04 / 24.04，Debian 12
# 前提：已执行过 deploy/deploy.sh，站点可通过 80 端口访问
# 用法：sudo bash deploy/setup-https.sh <域名> <证书邮箱>
#   sudo bash deploy/setup-https.sh campus.example.com me@example.com
#
# 为什么用 webroot 而不是 certbot 的 nginx 插件：
#   本站的 Nginx 运行在容器内，而 certbot 只能操作宿主机上的 Nginx。
#   因此让 certbot 以 webroot 方式写入校验文件，由容器内的 Nginx 对外提供该文件。
#
# 为什么分三个阶段启动 Nginx：
#   443 段依赖证书文件，证书尚未签发时容器会启动失败，也就无法响应 ACME 校验，
#   形成死锁。所以先以「仅 80 端口」的临时配置启动，签发完成后再还原正式配置。
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[HTTPS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[提示]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

DOMAIN="${1:-${DOMAIN:-}}"
EMAIL="${2:-${CERT_EMAIL:-}}"
CONF=deploy/nginx.conf
ACME_WEBROOT=/var/www/certbot

# ---------- 1. 参数与环境校验 ----------
[[ $EUID -eq 0 ]] || error "请使用 root 权限执行：sudo bash deploy/setup-https.sh <域名> <邮箱>"
[[ -f docker-compose.yml && -f "$CONF" ]] || error "请在项目根目录执行本脚本"
[[ -n "$DOMAIN" ]] || error "缺少域名参数。用法：sudo bash deploy/setup-https.sh <域名> <邮箱>"
[[ -n "$EMAIL" ]] || error "缺少证书邮箱参数（Let's Encrypt 用于发送到期提醒）"
[[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]] \
  || error "域名格式不正确：$DOMAIN"

PROJECT_DIR="$(pwd)"

# 域名必须解析到本机，否则 ACME 校验必然失败
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "")
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || true)
if [[ -n "$PUBLIC_IP" && -n "$RESOLVED" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
  warn "域名 $DOMAIN 解析到 $RESOLVED，与本机公网 IP $PUBLIC_IP 不一致"
  warn "Let's Encrypt 要求域名指向本机，否则校验会失败"
  read -r -p "仍要继续吗？(y/N) " answer
  [[ "$answer" =~ ^[Yy]$ ]] || error "已取消，请先完成 DNS 解析"
fi

# ---------- 2. 安装 certbot ----------
if ! command -v certbot >/dev/null 2>&1; then
  info "安装 certbot…"
  apt-get update -y
  apt-get install -y certbot
fi

# ---------- 3. 写入域名并准备 ACME 校验目录 ----------
mkdir -p "$ACME_WEBROOT"
if grep -q 'your-domain.com' "$CONF"; then
  info "把 $CONF 中的占位域名替换为 $DOMAIN"
  sed -i "s/your-domain.com/${DOMAIN}/g" "$CONF"
fi

# ---------- 4. 阶段一：仅 80 端口启动，让校验路径可达 ----------
BACKUP=$(mktemp)
cp "$CONF" "$BACKUP"
restore() {
  if [[ -n "${BACKUP:-}" && -f "${BACKUP:-}" ]]; then
    cp "$BACKUP" "$CONF"
    rm -f "$BACKUP"
    BACKUP=""
  fi
  return 0
}
# 无论成功失败都还原正式配置，避免把临时配置留在仓库里
trap 'restore' EXIT

cat > "$CONF" <<'BOOTSTRAP'
# 临时配置：由 deploy/setup-https.sh 在证书签发期间使用，签发完成后自动还原为正式配置
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
BOOTSTRAP

info "以临时配置启动 Nginx（仅 80 端口）…"
docker compose up -d nginx
sleep 3
docker compose exec -T nginx nginx -t >/dev/null || error "临时配置校验失败，请检查 docker compose logs nginx"

# ---------- 5. 阶段二：签发证书 ----------
info "申请证书：$DOMAIN"
certbot certonly --webroot -w "$ACME_WEBROOT" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive

# ---------- 6. 阶段三：还原正式配置并重载 ----------
restore
info "还原正式配置并重载 Nginx…"
docker compose up -d nginx
docker compose exec -T nginx nginx -t || error "正式配置校验失败，请检查 $CONF 中的证书路径与域名"
docker compose exec -T nginx nginx -s reload

# ---------- 7. 续期后自动重载容器内 Nginx ----------
HOOK_DIR=/etc/letsencrypt/renewal-hooks/deploy
HOOK_FILE="$HOOK_DIR/reload-campuspilot-nginx.sh"
mkdir -p "$HOOK_DIR"
cat > "$HOOK_FILE" <<EOF
#!/usr/bin/env bash
# 由 deploy/setup-https.sh 生成：certbot 续期成功后重载容器内的 Nginx，使新证书生效
cd "${PROJECT_DIR}" && docker compose exec -T nginx nginx -s reload
EOF
chmod +x "$HOOK_FILE"
info "已写入续期钩子：$HOOK_FILE"

# ---------- 8. 验证 ----------
info "验证强制跳转与证书…"
HTTP_CHECK=$(curl -s -o /dev/null -w '%{http_code}' "http://${DOMAIN}/api/health" || echo 000)
HTTPS_CHECK=$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/health/ready" || echo 000)
HSTS=$(curl -sI "https://${DOMAIN}/" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="strict-transport-security"{print $2}')

echo ""
echo "  明文请求 http://${DOMAIN}/api/health  -> ${HTTP_CHECK}（期望 301）"
echo "  HTTPS 请求 https://${DOMAIN}/api/health/ready -> ${HTTPS_CHECK}（期望 200）"
echo "  HSTS：${HSTS:-未下发}"
echo "  证书有效期至：$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null | cut -d= -f2)"
echo ""

[[ "$HTTP_CHECK" == "301" ]] || warn "明文请求未返回 301，请确认 80 端口的 server 块未被其他配置覆盖"
[[ "$HTTPS_CHECK" == "200" ]] || error "HTTPS 校验失败，请检查：docker compose logs nginx、DNS 解析是否生效、安全组是否放行 443"

info "HTTPS 已就绪：https://${DOMAIN}"
if [[ "$(git status --porcelain "$CONF" 2>/dev/null)" != "" ]]; then
  warn "$CONF 中的占位域名已被替换为 $DOMAIN，建议提交到仓库以免下次部署重新替换"
fi