import { Database } from 'bun:sqlite';
import { hashPassword } from './crypto';
import { createUser } from './users';
import { promoteToAdmin, getAdminCount } from './administrators';
import { getRouterModelByName, createRouterModel } from './router-models';
import { config } from '../config';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

const INSERT_API_KEY = `
INSERT INTO api_keys (key_hash, key_prefix, description)
VALUES (?, ?, ?)`;

/**
 * 初始化默认管理员账户（幂等）
 *
 * 当 administrators 表为空时，创建 admin/admin123 并提升为管理员。
 * 已有管理员时跳过，返回 { created: false }。
 */
export async function bootstrapAdmin(db: Database): Promise<{ created: boolean; message: string }> {
  const count = getAdminCount(db);
  if (count > 0) {
    return { created: false, message: 'Administrator already exists, skipping bootstrap' };
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  const user = createUser(db, DEFAULT_ADMIN_USERNAME, passwordHash);
  promoteToAdmin(db, user.id);

  return { created: true, message: `Default admin created (username: ${DEFAULT_ADMIN_USERNAME})` };
}

/**
 * 初始化默认 API Key（幂等）
 *
 * 当 api_keys 表为空时，将 config.apiKey 导入为默认密钥。
 * 已有密钥时跳过，返回 { created: false }。
 */
export async function bootstrapApiKey(db: Database): Promise<{ created: boolean; message: string }> {
  const row = db.prepare('SELECT COUNT(*) AS count FROM api_keys').get() as { count: number };
  if (row.count > 0) {
    return { created: false, message: 'API key already exists, skipping bootstrap' };
  }

  if (!config.apiKey) {
    return { created: false, message: 'No config apiKey provided, skipping bootstrap' };
  }

  const keyHash = await hashPassword(config.apiKey);
  const prefix = config.apiKey.slice(0, 5);
  db.prepare(INSERT_API_KEY).run(keyHash, prefix, 'Default API key from config');

  return { created: true, message: `Default API key imported (prefix: ${prefix}***)` };
}

/**
 * 将 config.modelAliases 迁移到 router_models 表（幂等）
 *
 * 对每个 alias 映射创建一条 router_model 记录：
 * - name = alias key（对外暴露的名称）
 * - variant = "ollama"
 * - base_url = config.ollamaUrl
 * - model = alias value（Ollama 实际模型名）
 *
 * 已存在的 name 跳过，不覆盖。
 */
export function migrateModelAliases(db: Database): { migrated: number; skipped: number; message: string } {
  if (!config.ollamaUrl) {
    return { migrated: 0, skipped: 0, message: 'Ollama not configured, skipping modelAliases migration' };
  }

  const aliases = config.modelAliases;
  if (!aliases || Object.keys(aliases).length === 0) {
    return { migrated: 0, skipped: 0, message: 'No modelAliases to migrate' };
  }

  let migrated = 0;
  let skipped = 0;

  for (const [aliasName, aliasTarget] of Object.entries(aliases)) {
    const existing = getRouterModelByName(db, aliasName);
    if (existing) {
      skipped++;
      continue;
    }

    createRouterModel(db, {
      name: aliasName,
      variant: 'ollama',
      base_url: config.ollamaUrl ?? 'http://127.0.0.1:11434',
      model: aliasTarget,
    });
    migrated++;
  }

  return { migrated, skipped, message: `Migrated ${migrated} aliases, skipped ${skipped} existing` };
}