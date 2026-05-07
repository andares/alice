export const MOCK_API_KEY = "sk-change-me-in-production";
export const MOCK_OLLAMA_URL = "http://127.0.0.1:11434";
export const MOCK_LOG_LEVEL = "info" as const;
export const MOCK_LOG_FILE = "/var/log/alice-way/gateway.log";
export const MOCK_DB_FILE = ":memory:";
export const MOCK_PORT = 3000;

export const MOCK_MODEL_ALIASES = {
  "gpt-4": "llama3.1:8b",
  "gpt-3.5-turbo": "qwen2.5:7b",
} as const;

export const mockConfig = {
  port: MOCK_PORT,
  apiKey: MOCK_API_KEY,
  ollamaUrl: MOCK_OLLAMA_URL,
  logLevel: MOCK_LOG_LEVEL,
  logFile: MOCK_LOG_FILE,
  dbFile: MOCK_DB_FILE,
  modelAliases: MOCK_MODEL_ALIASES,
};
