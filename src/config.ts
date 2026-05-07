import { z } from 'zod';
import type { Config } from './types';

const configSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  apiKey: z.string().min(1),
  ollamaUrl: z.string().url().default('http://127.0.0.1:11434'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logFile: z.string().default('/var/log/alice-way/gateway.log'),
  dbFile: z.string().default('/var/lib/alice-way/alice.db'),
  modelAliases: z.record(z.string(), z.string()).optional(),
});

const configPath = process.env.CONFIG_PATH || '/etc/alice-way/config.json';
const file = Bun.file(configPath);

if (!(await file.exists())) {
  console.error(`Config file not found: ${configPath}`);
  process.exit(1);
}

const raw = await file.text();

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error(`Invalid JSON in config file: ${configPath}`);
  process.exit(1);
}

const result = configSchema.safeParse(parsed);

if (!result.success) {
  console.error(`Config validation failed:\n${result.error.format()}`);
  process.exit(1);
}

export const config: Config = result.data;