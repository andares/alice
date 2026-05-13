# Alice Way — Personal Agent Console

> A lightweight personal LLM agent console with OpenAI-compatible API and multi-model routing.

**Alice Way** provides a secure, OpenAI-compatible HTTP API for your personal AI agents. Connect any OpenAI-compatible client — Claude CLI, LangChain, Continue.dev, ChatGPT-Next-Web, etc. — to your local models through a single, configurable gateway. Ollama is one supported backend, but the Router system enables multi-model routing across various providers.

---

## Quick Start

### 1. Install Dependencies

Requires [Bun](https://bun.sh) runtime.

```bash
bun install
```

### 2. Configure

The application auto-creates `./config.json` with minimal defaults if no config is found. For customization, copy the example and edit:

```bash
cp config.example.json ./config.json
# Edit ./config.json and set your apiKey and backend preferences
```

Bun automatically loads `.env` from the current working directory, so you can also set environment variables for quick testing.

### 3. Run

```bash
# Development (auto-reload)
bun run dev

# Production
bun run src/index.ts
```

The console listens on the port configured in `config.json` (default: **3000**). No `CONFIG_PATH` needed in development — the app looks for `./config.json` by default.

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
# {"status":"ok","ollama":"not_configured"}
```

When Ollama is not configured, the health check reports `ollama: "not_configured"` while the service remains fully operational for other backends.

---

## Configuration

`config.json` fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3000` | HTTP server port |
| `apiKey` | string | — | Bearer token for API authentication |
| `ollamaUrl` | string | *optional* | Ollama base URL (leave unset to disable) |
| `logLevel` | string | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `logFile` | string | `./logs/gateway.log` | Log file path (local by default) |
| `dbFile` | string | `./data/alice.db` | SQLite database for request logs (local by default) |
| `modelAliases` | object | `{}` | Map client model names to backend model names |

**Note**: `ollamaUrl` is optional. The console starts and serves requests even without Ollama configured, routing to other configured backends.

**Example `modelAliases`**:

```json
{
  "gpt-4": "llama3.1:8b",
  "gpt-3.5-turbo": "qwen2.5:7b"
}
```

---

## Architecture

```
Client (OpenAI API) → HTTPS → Alice Router (port 3000) → Backend (Ollama, etc.)
```

The Router is the primary traffic path, enabling multi-model routing across different AI providers. Ollama is one supported backend among many.

Typical production setup with reverse proxy:

```
Internet → Nginx/Caddy (HTTPS, 443) → Alice (3000, localhost) → Backend (Ollama, etc.)
```

### Admin Dashboard (/alice)

Alice includes a built-in admin dashboard at `/alice` for operational visibility:

- **Status page** — Backend health check and loaded models
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
- **Async dual-output logging** — colored console + file logs
- **Single binary deployment** — compile once, deploy anywhere (Bun `--compile`)
- **Graceful shutdown** — SIGTERM/SIGINT handling
- **Multi-model routing** — Router-based backend selection, Ollama as one option
- **Model aliasing** — transparently map client model names to backend models
- **Upstream health check** — `/health` endpoint reports backend connectivity
- **Admin Dashboard (/alice)** — Web UI for monitoring, config viewing, and request logs
- **Zero-config startup** — auto-creates `./config.json` with sensible defaults
- **`.env` support** — Bun auto-loads environment variables from CWD

---

## Deploy as systemd Service

> For system-level deployment. For local development, use `bun run dev`.

### 1. Compile to Single Binary

```bash
./build.sh
# Produces: ./alice
```

`./build.sh` also rebuilds the Alice dashboard stylesheet before compiling the
binary.

### 2. Install

```bash
sudo ./install.sh
```

This will:
- Create a system user `alice-way`
- Install the binary to `/usr/local/bin/alice`
- Install config to `/etc/alice-way/config.json`
- Install and enable the systemd service

### 3. Start

```bash
sudo systemctl start alice
sudo systemctl enable alice   # auto-start on boot
```

### 4. View Logs

```bash
sudo journalctl -u alice -f
# or
sudo tail -f /var/log/alice-way/gateway.log
```

---

## Deploy with Docker

### Prerequisites

- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### 1. Configure

Copy the example config and edit the API key:

```bash
cp config.example.json config.json
# Edit config.json and set a strong apiKey
```

### 2. Start

```bash
docker compose up -d
```

The console will be available at `http://localhost:3000`.

### 3. View Logs

```bash
docker compose logs -f
```

### 4. Stop

```bash
docker compose down
```

### Data Persistence

Docker volumes persist data across container restarts:

| Volume | Host Path | Container Path | Purpose |
|--------|-----------|----------------|---------|
| `./data` | `./data` | `/app/data` | SQLite database for request logs |
| `./logs` | `./logs` | `/app/logs` | Application log files |

To persist data on a different host path, edit `docker-compose.yml` and modify the volume mappings.

---

## Testing

Alice Way uses Bun's built-in test runner (`bun:test`). All tests live in the `tests/` directory, separated from source code.

### Run All Tests

```bash
bun test
```

### Run with Coverage Report

```bash
bun test --coverage
```

Target line coverage: **≥ 90%**.

### Run Specific Test Suites

```bash
# Unit tests only
bun test tests/unit

# Integration tests only
bun test tests/integration

# Single file
bun test tests/unit/transformers/openai.test.ts
```

### Run E2E Tests

```bash
bun run test:e2e
```

Runs Playwright end-to-end tests against the running application.

### Test Structure

| Directory | Contents |
|-----------|----------|
| `tests/unit/` | Pure function tests, mock-based tests |
| `tests/integration/` | Elysia route/middleware tests, SQLite integration |
| `tests/fixtures/` | Mock data and factory functions |

---

## Requirements

- [Bun](https://bun.sh) >= 1.0 (for development & compilation)
- Linux with systemd (for service deployment, optional)
- AVX2 CPU support (for compiled binary)
- Ollama (optional, only if using Ollama as backend)

---

## License

MIT