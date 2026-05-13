/**
 * Router 多模型网关配置管理模块
 *
 * 提供 router_models 表的完整 CRUD：
 * - name 唯一约束
 * - api_key 明文存储（上游 provider key）
 * - variant 默认 "openai"
 */

import { Database } from 'bun:sqlite';
import type { RouterModel } from './types';

/** 创建 RouterModel 的入参 */
export interface CreateRouterModelInput {
  /** 模型名称（唯一，对外暴露的名字） */
  name: string;
  /** 模型 variant 类型（默认 "openai"） */
  variant?: string;
  /** 上游 API 基础 URL */
  base_url: string;
  /** 上游实际调用的模型名 */
  model: string;
  /** 上游 API 密钥 */
  api_key?: string | null;
  /** 额外配置选项（JSON 字符串） */
  options?: string | null;
}

/** RouterModel 的可更新字段 */
export interface UpdateRouterModelInput {
  name?: string;
  variant?: string;
  base_url?: string;
  model?: string;
  api_key?: string | null;
  options?: string | null;
}

/**
 * 验证模型名称是否合法
 *
 * 规则：
 * - 长度 3-64 字符
 * - 不能以 `$` `_` `@` `.` `~` 开头
 *
 * @throws 名称不合法时抛出 Error
 */
export function validateModelName(name: string): void {
  if (name.length < 3 || name.length > 64) {
    throw new Error('模型名称长度须为 3-64 个字符');
  }

  // __ 前缀为系统保留（如 __default__），允许通过
  if (name.startsWith('__')) {
    return;
  }

  const forbiddenStart = /^[$_@.~]/;
  if (forbiddenStart.test(name)) {
    throw new Error('模型名称不能以 $ _ @ . ~ 开头');
  }
}

/**
 * 创建 Router 模型配置
 *
 * variant 默认为 "openai"；name 须满足 validateModelName 规则且唯一。
 *
 * @param db    数据库实例
 * @param input 创建参数
 * @returns 完整 RouterModel 对象
 */
export function createRouterModel(
  db: Database,
  input: CreateRouterModelInput,
): RouterModel {
  validateModelName(input.name);

  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO router_models (name, variant, base_url, model, api_key, options, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.name,
    input.variant ?? 'openai',
    input.base_url,
    input.model,
    input.api_key ?? null,
    input.options ?? null,
    now,
    now,
  );

  return {
    id: result.lastInsertRowid as number,
    name: input.name,
    variant: input.variant ?? 'openai',
    base_url: input.base_url,
    model: input.model,
    api_key: input.api_key ?? null,
    options: input.options ?? null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 按 ID 获取 Router 模型配置
 *
 * @param db 数据库实例
 * @param id 配置 ID
 * @returns RouterModel 对象，不存在返回 null
 */
export function getRouterModel(db: Database, id: number): RouterModel | null {
  const row = db.prepare('SELECT * FROM router_models WHERE id = ?').get(id);
  return row as RouterModel | null;
}

/**
 * 按名称获取 Router 模型配置
 *
 * @param db   数据库实例
 * @param name 模型名称
 * @returns RouterModel 对象，不存在返回 null
 */
export function getRouterModelByName(
  db: Database,
  name: string,
): RouterModel | null {
  const row = db
    .prepare('SELECT * FROM router_models WHERE name = ?')
    .get(name);
  return row as RouterModel | null;
}

/**
 * 列出所有 Router 模型配置
 *
 * @param db 数据库实例
 * @returns RouterModel 数组，按创建时间降序
 */
export function listRouterModels(db: Database): RouterModel[] {
  return db
    .prepare('SELECT * FROM router_models ORDER BY created_at DESC')
    .all() as RouterModel[];
}

/**
 * 更新 Router 模型配置
 *
 * 仅更新提供的字段，未提供的字段保持不变。
 * 若提供了 name 且 name 发生变更，会执行 validateModelName 校验。
 *
 * @param db      数据库实例
 * @param id      配置 ID
 * @param updates 要更新的字段
 */
export function updateRouterModel(
  db: Database,
  id: number,
  updates: UpdateRouterModelInput,
): void {
  if (updates.name !== undefined) {
    validateModelName(updates.name);
  }

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  const fields: (keyof UpdateRouterModelInput)[] = [
    'name',
    'variant',
    'base_url',
    'model',
    'api_key',
    'options',
  ];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (setClauses.length === 0) {
    return;
  }

  setClauses.push('updated_at = unixepoch()');
  params.push(id);

  db.prepare(
    `UPDATE router_models SET ${setClauses.join(', ')} WHERE id = ?`,
  ).run(...params);
}

/**
 * 删除 Router 模型配置
 *
 * @param db 数据库实例
 * @param id 配置 ID
 */
export function deleteRouterModel(db: Database, id: number): void {
  db.prepare('DELETE FROM router_models WHERE id = ?').run(id);
}
