# ---------- 构建阶段：打包前端 ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev=false

COPY . .
RUN npm run build

# ---------- 运行阶段：只保留生产依赖 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 后端代码与前端构建产物
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/server/data && chown -R node:node /app
# 以非 root 用户运行：容器被突破时限制攻击面
USER node

EXPOSE 3001
# 端口用 ${PORT} 而非写死：Render / Railway 等平台会注入自己的 PORT
# start-period 放宽到 30s，给冷启动时连接 MongoDB Atlas 留足时间
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://localhost:${PORT}/api/health" || exit 1

CMD ["node", "server/index.js"]