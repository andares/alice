# Ollawe

> A lightweight, production-ready **Ollama Gateway** with OpenAI-compatible API.

**Ollawe** exposes your local [Ollama](https://ollama.com) instance through a secure, OpenAI-compatible HTTP API. Any client that supports the OpenAI API — Claude CLI, LangChain, Continue.dev, ChatGPT-Next-Web, etc. — can connect to your self-hosted models without exposing Ollama's native port (11434) directly.

---

## Quick Start

### 1. Install Dependencies

Requires [Bun](https://bun.sh) runtime.

```bash
bun install
```

### 2. Configure

Copy the example config and edit the API key:

```bash
cp config.example.json /etc/alice-way/config.json
# Edit /etc/alice-way/config.json and set a strong apiKey
```

Or use a local config for development:

```bash
CONFIG_PATH=./config.example.json bun run dev
```

### 3. Run

```bash
# Development (auto-reload)
bun run dev

# Production
CONFIG_PATH=/etc/alice-way/config.json bun run src/index.ts
```

The gateway listens on the port configured in `config.json` (default: **3000**).

---

## API Usage

### List Models

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

### Chat Completion (non-streaming)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Chat Completion (streaming)

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","ollama":"reachable"}
```

---

## Configuration

`config.json` fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3000` | HTTP server port |
| `apiKey` | string | — | Bearer token for API authentication |
| `ollamaUrl` | string | `http://127.0.0.1:11434` | Ollama base URL |
| `logLevel` | string | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `logFile` | string | `/var/log/alice-way/gateway.log` | Log file path |
| `dbFile` | string | `/var/lib/alice-way/alice.db` | SQLite database path for request logs |
| `modelAliases` | object | `{}` | Map OpenAI model names to Ollama model names |

**Example `modelAliases`**:

```json
{
  "gpt-4": "llama3.1:8b",
  "gpt-3.5-turbo": "qwen2.5:7b"
}
```

---

## Deploy as systemd Service

### 1. Compile to Single Binary

```bash
./build.sh
# Produces: ./ollama-gateway
```

`./build.sh` also rebuilds the Alice dashboard stylesheet before compiling the
binary.

### 2. Install

```bash
sudo ./install.sh
```

This will:
- Create a system user `alice-way`
- Install the binary to `/usr/local/bin/alice-way`
- Install config to `/etc/alice-way/config.json`
- Install and enable the systemd service

### 3. Start

```bash
sudo systemctl start alice-way
sudo systemctl enable alice-way   # auto-start on boot
```

### 4. View Logs

```bash
sudo journalctl -u alice-way -f
# or
sudo tail -f /var/log/alice-way/gateway.log
```

---

## Testing

Ollawe uses Bun's built-in test runner (`bun:test`). All tests live in the `tests/` directory, separated from source code.

### Run All Tests

```bash
bun test
```

### Run with Coverage Report

```bash
bun test --coverage
```

Target line coverage: **≥ 90%** (currently **92.57%**).

### Run Specific Test Suites

```bash
# Unit tests only
bun test tests/unit

# Integration tests only
bun test tests/integration

# Single file
bun test tests/unit/transformers/openai.test.ts
```

### Test Structure

| Directory | Contents |
|-----------|----------|
| `tests/unit/` | Pure function tests, mock-based tests |
| `tests/integration/` | Elysia route/middleware tests, SQLite integration |
| `tests/fixtures/` | Mock data and factory functions |

---

## Architecture

```
Client (OpenAI API) → HTTPS → Ollawe (port 3000) → Ollama (port 11434)
```

Typical production setup with reverse proxy:

```
Internet → Nginx/Caddy (HTTPS, 443) → Ollawe (3000, localhost) → Ollama (11434)
```

### Admin Dashboard (/alice)

Ollawe includes a built-in admin dashboard at `/alice` for operational visibility:

- **Status page** — Ollama health check and loaded models
- **Config page** — Read-only view of current configuration (API key masked)
- **Logs page** — Request/response history with pagination and JSON detail view

The dashboard is built with **HTMX**, **Tailwind CSS v4**, and **DaisyUI 5**. Request logs are stored in a local **SQLite** database (configurable via `dbFile`). The dashboard has no built-in authentication; protect it with your reverse proxy (e.g., nginx HTTP Basic Auth) in production.

Alice styles are generated from `src/alice/styles.css` into
`public/alice.css` using:

```bash
bun run build:css
```

The build runs fully under Bun: it resolves the repository root from
`npm_package_json` and executes the Tailwind CLI through `bunx --bun`, so it
does not depend on a separate Node.js runtime when invoked from `bun run`.

---

## Features

- **OpenAI-compatible API** — `/v1/chat/completions` (streaming & non-streaming), `/v1/models`
- **Bearer Token authentication** — simple API key protection
- **JSON configuration** — no code changes needed for deployment
- **Async dual-output logging** — colored console + rotating file logs
- **Single binary deployment** — compile once, deploy anywhere (Bun `--compile`)
- **Graceful shutdown** — SIGTERM/SIGINT handling
- **Model aliasing** — transparently map client model names to Ollama models
- **Upstream health check** — `/health` endpoint reports Ollama connectivity
- **Admin Dashboard (/alice)** — Web UI for monitoring, config viewing, and request logs

---

## Requirements

- [Bun](https://bun.sh) >= 1.0 (for development & compilation)
- [Ollama](https://ollama.com) running and accessible
- Linux with systemd (for service deployment)
- AVX2 CPU support (for compiled binary)

---

## License

MIT
