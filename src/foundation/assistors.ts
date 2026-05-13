/**
 * Assistor（Chat 角色/助手）CRUD 模块
 *
 * 提供 assistors 表的完整 CRUD：
 * - 创建者通过 created_by 关联到 users 表
 * - 所有权验证：普通用户只能操作自己创建的 assistor，管理员可以操作所有
 */

import { Database } from 'bun:sqlite';
import type { Assistor } from './types';
import { isAdmin } from './administrators';

/** 创建 Assistor 的入参 */
export interface CreateAssistorInput {
  /** 角色名称 */
  name: string;
  /** 使用的模型名 */
  model: string;
  /** 系统提示词 */
  system_prompt: string;
}

/** Assistor 的可更新字段 */
export interface UpdateAssistorInput {
  /** 角色名称 */
  name?: string;
  /** 使用的模型名 */
  model?: string;
  /** 系统提示词 */
  system_prompt?: string;
}

/**
 * 创建 Assistor
 *
 * @param db      数据库实例
 * @param userId  创建者用户 ID
 * @param input   创建参数
 * @returns 完整 Assistor 对象
 */
export function createAssistor(
  db: Database,
  userId: number,
  input: CreateAssistorInput,
): Assistor {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO assistors (name, model, system_prompt, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.name,
    input.model,
    input.system_prompt,
    userId,
    now,
    now,
  );

  return {
    id: result.lastInsertRowid as number,
    name: input.name,
    model: input.model,
    system_prompt: input.system_prompt,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 按 ID 获取 Assistor
 *
 * @param db  数据库实例
 * @param id  Assistor ID
 * @returns Assistor 对象，不存在返回 null
 */
export function getAssistor(db: Database, id: number): Assistor | null {
  const row = db.prepare('SELECT * FROM assistors WHERE id = ?').get(id);
  return row as Assistor | null;
}

/**
 * 列出 Assistor 列表
 *
 * - 管理员：列出所有 assistor
 * - 普通用户：仅列出自己创建的 assistor
 *
 * @param db      数据库实例
 * @param userId  用户 ID（可选，不传则列出全部）
 * @returns Assistor 数组，按创建时间降序
 */
export function listAssistors(db: Database, userId?: number): Assistor[] {
  if (userId === undefined) {
    return db
      .prepare('SELECT * FROM assistors ORDER BY created_at DESC')
      .all() as Assistor[];
  }

  return db
    .prepare('SELECT * FROM assistors WHERE created_by = ? ORDER BY created_at DESC')
    .all(userId) as Assistor[];
}

/**
 * 验证用户是否有权限操作指定 Assistor
 *
 * @param db      数据库实例
 * @param id      Assistor ID
 * @param userId  当前用户 ID
 * @returns 有权限返回 Assistor，无权限返回 null
 */
function verifyOwnership(db: Database, id: number, userId: number): Assistor | null {
  const assistor = getAssistor(db, id);
  if (!assistor) return null;

  // 管理员或创建者有权限
  if (isAdmin(db, userId) || assistor.created_by === userId) {
    return assistor;
  }

  return null;
}

/**
 * 更新 Assistor
 *
 * 仅更新提供的字段，未提供的字段保持不变。
 * 验证当前用户是否为创建者或管理员。
 *
 * @param db      数据库实例
 * @param id      Assistor ID
 * @param userId  当前用户 ID（用于所有权验证）
 * @param updates 要更新的字段
 * @returns 更新后的 Assistor 对象，不存在或无权限返回 null
 */
export function updateAssistor(
  db: Database,
  id: number,
  userId: number,
  updates: UpdateAssistorInput,
): Assistor | null {
  const assistor = verifyOwnership(db, id, userId);
  if (!assistor) return null;

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  const fields: (keyof UpdateAssistorInput)[] = [
    'name',
    'model',
    'system_prompt',
  ];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field] as string | null);
    }
  }

  if (setClauses.length === 0) {
    return assistor;
  }

  setClauses.push('updated_at = unixepoch()');
  params.push(id);

  db.prepare(
    `UPDATE assistors SET ${setClauses.join(', ')} WHERE id = ?`,
  ).run(...params);

  return getAssistor(db, id);
}

/**
 * 删除 Assistor
 *
 * 验证当前用户是否为创建者或管理员。
 *
 * @param db      数据库实例
 * @param id      Assistor ID
 * @param userId  当前用户 ID（用于所有权验证）
 * @returns 是否成功删除
 */
export function deleteAssistor(db: Database, id: number, userId: number): boolean {
  const assistor = verifyOwnership(db, id, userId);
  if (!assistor) return false;

  db.prepare('DELETE FROM assistors WHERE id = ?').run(id);
  return true;
}
