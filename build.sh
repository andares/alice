#!/bin/bash
set -e

echo "Building alice..."

# 检查 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed. Please install it from https://bun.sh"
    exit 1
fi

# 安装依赖
bun install

echo "Building Alice dashboard CSS..."
bun run build:css

# Build chat frontend
echo "Building chat frontend..."
bun run build:chat

# 编译为独立二进制
# 注意：不使用 --minify（会导致 Elysia 崩溃）
# @elysiajs/bearer 必须标记为 --external 以避免编译冲突
bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --target bun \
  --external @elysiajs/bearer \
  --outfile alice \
  src/index.ts

echo "Build successful: ./alice"
ls -lh ./alice