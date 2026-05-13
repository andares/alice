# ============================================================
# Alice Way - Multi-stage Dockerfile
# 基于 oven/bun:alpine，不编译为二进制，直接运行 bun
# ============================================================

# ---- 阶段 1：构建 ----
FROM oven/bun:alpine AS builder

WORKDIR /app

# 先复制依赖描述文件，利用 Docker 缓存层
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 复制 chat 前端依赖描述文件并安装
COPY src/chat/package.json src/chat/bun.lock ./src/chat/
RUN cd src/chat && bun install --frozen-lockfile

# 复制全部源码
COPY . .

# 构建 Alice 仪表盘 CSS
RUN bun run build:css

# 构建 Chat 前端（SolidStart → public/chat/）
RUN bun run build:chat

# 清理 chat 构建中间产物（仅保留运行时所需）
RUN rm -rf src/chat/.solid src/chat/.vinxi src/chat/.output src/chat/node_modules

# ---- 阶段 2：运行 ----
FROM oven/bun:alpine AS runner

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 复制根依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 复制源码
COPY --from=builder /app/src ./src

# 复制静态资源（含构建产物 alice.css、chat/）
COPY --from=builder /app/public ./public

# 复制配置示例（用户需挂载自己的 config.json）
COPY --from=builder /app/config.example.json ./

# 创建日志和数据目录，赋予 appuser 写权限
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app/logs /app/data /app

# 默认配置路径（可通过环境变量覆盖）
ENV CONFIG_PATH=/app/config.json

EXPOSE 3000

USER appuser

CMD ["bun", "src/index.ts"]