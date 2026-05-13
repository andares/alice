import { z } from 'zod';
import { mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Config } from './types';

function resolveConfigPath(): string {
  if (process.env.CONFIG_PATH) {
    return resolve(process.env.CONFIG_PATH);
  }

  const systemPath = '/etc/alice-way/config.json';
  try {
    if (statSync(systemPath).isFile()) return systemPath;
  } catch {}

  const localPath = resolve('./config.json');
  try {
    statSync(localPath);
  } catch {
    const minimalConfig = JSON.stringify({ port: 3000 }, null, 2) + '\n';
    Bun.write(localPath, minimalConfig);
    console.log('Auto-created ./config.json with default settings');
  }

  return localPath;
}

const configSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  apiKey: z.string().optional(),
  ollamaUrl: z.string().url().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logFile: z.string().default('./logs/alice.log'),
  dbFile: z.string().default('./data/alice.db'),
  chatDbFile: z.string().default('./data/chat.db'),
  /** @deprecated 使用 router_models 表代替，启动时自动迁移 */
  modelAliases: z.record(z.string(), z.string()).optional(),
});

const configPath = resolveConfigPath();
const file = Bun.file(configPath);

mkdirSync(dirname('./data/alice.db'), { recursive: true });
mkdirSync(dirname('./logs/alice.log'), { recursive: true });

let raw = '{}';
if (await file.exists()) {
  raw = await file.text();
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error(`Invalid JSON in config file: ${configPath}, using defaults`);
  parsed = {};
}

const result = configSchema.safeParse(parsed);

if (!result.success) {
  console.error(`Config validation failed:\n${result.error.format()}`);
  console.error('Using default configuration values');
}

export const config: Config = result.success
  ? result.data
  : configSchema.parse({});