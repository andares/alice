#!/bin/bash
set -e

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo ./install.sh)"
    exit 1
fi

# 配置路径
BIN_SOURCE="./ollama-gateway"
CONFIG_SOURCE="./config.example.json"
SERVICE_SOURCE="./ollama-gateway.service"
BIN_DEST="/usr/local/bin/alice-way"
CONFIG_DEST="/etc/alice-way/config.json"
LOG_DIR="/var/log/alice-way"
USER="alice"

# 1. 创建系统用户（幂等）
if ! id "$USER" &>/dev/null; then
    useradd --system --no-create-home --shell /bin/false "$USER"
    echo "Created system user: $USER"
fi

# 2. 创建日志目录和数据目录
mkdir -p "$LOG_DIR"
chown "$USER:$USER" "$LOG_DIR"
chmod 755 "$LOG_DIR"

# 创建 Alice 仪表板 SQLite 数据目录
mkdir -p /var/lib/alice-way
chown "$USER:$USER" /var/lib/alice-way
chmod 755 /var/lib/alice-way

# 3. 复制二进制和静态资源
cp "$BIN_SOURCE" "$BIN_DEST"
chmod 755 "$BIN_DEST"
chown root:root "$BIN_DEST"

# 复制 Alice 仪表板静态资源到二进制同目录下（@elysiajs/static 运行时读取）
STATIC_DIR="$(dirname "$BIN_DEST")/public"
mkdir -p "$STATIC_DIR"
cp -r public/* "$STATIC_DIR/"
chown -R "$USER:$USER" "$STATIC_DIR"
chmod -R 755 "$STATIC_DIR"

# 4. 复制配置文件（不覆盖已有配置）
mkdir -p "$(dirname "$CONFIG_DEST")"
if [ ! -f "$CONFIG_DEST" ]; then
    cp "$CONFIG_SOURCE" "$CONFIG_DEST"
    echo "Config file created at $CONFIG_DEST. Please edit API key and settings."
else
    echo "Config file already exists at $CONFIG_DEST, skipping."
fi
chown "$USER:$USER" "$CONFIG_DEST"
chmod 640 "$CONFIG_DEST"

# 5. 安装 systemd 服务
cp "$SERVICE_SOURCE" /etc/systemd/system/alice-way.service
systemctl daemon-reload

echo ""
echo "Installation completed."
echo "  Start service:  sudo systemctl start alice-way"
echo "  Enable boot:    sudo systemctl enable alice-way"
echo "  View logs:      sudo journalctl -u alice-way -f"
echo "  Edit config:    sudo vim $CONFIG_DEST"