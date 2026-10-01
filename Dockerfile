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

RUN mkdir -p /app/uploads /app/server/data

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]