import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** SQLite FCNTL code for PERSIST_WAL（来自 sqlite3.h，值为 10） */
const SQLITE_FCNTL_PERSIST_WAL = 10;

/** 会话实体类型 */
export type Conversation = {
  id: string;
  title: string;
  model: string;
  user_id: number;
  created_at: number;
  updated_at: number;
};

/** 消息实体类型 */
export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning: string | null;
  user_id: number;
  created_at: number;
};

/** 创建会话时的输入类型 */
export type CreateConversationInput = {
  title?: string;
  model?: string;
};

/** 创建消息时的输入类型 */
export type CreateMessageInput = {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string | null;
};

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT '',
  user_id INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  reasoning TEXT DEFAULT NULL,
  user_id INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
`;

const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
`;

/**
 * 确保表中存在指定列（用于迁移）
 * - 检查 PRAGMA table_info 判断列是否已存在
 * - 不存在则执行 ALTER TABLE ADD COLUMN
 * - 对旧数据库更新所有现有行的 user_id 为 1（admin）
 */
function ensureColumn(db: Database, table: string, columnDef: string, migrationName?: string): void {
  const colName = columnDef.split(' ')[0];
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  // 无论列是否已存在，都记录迁移（INSERT OR IGNORE 确保幂等性）
  if (migrationName) {
    db.run('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, executed_at INTEGER NOT NULL DEFAULT (unixepoch()))');
    db.run('INSERT OR IGNORE INTO _migrations (name, executed_at) VALUES (?, unixepoch())', [migrationName]);
  }

  if (cols.some((c) => c.name === colName)) return;

  db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  db.run(`UPDATE ${table} SET ${colName} = 1 WHERE ${colName} IS NULL;`);
}

/**
 * 初始化聊天 SQLite 数据库
 * - 自动创建父目录（如无权限则降级到项目目录下 .data/）
 * - 启用 WAL 模式
 * - 创建表和索引
 * - 迁移：为旧数据库添加 user_id 列
 */
export function initChatDb(dbPath: string): Database {
  let actualPath = dbPath;

  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch {
    // 配置路径无写权限，降级到项目目录下 .data/ 目录
    const fileName = dbPath.substring(dbPath.lastIndexOf('/') + 1);
    actualPath = `.data/${fileName}`;
    console.warn(
      `ChatDB: Cannot write to ${dbPath}, falling back to ${actualPath}`,
    );
    mkdirSync(dirname(actualPath), { recursive: true });
  }

  const db = new Database(actualPath);

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(CREATE_TABLES_SQL);

  // 迁移：为旧数据库添加 user_id 列（新数据库已在 CREATE TABLE 中包含）
  // 必须在 CREATE_INDEXES_SQL 之前执行，因为索引引用了 user_id 列
  ensureColumn(db, 'conversations', 'user_id INTEGER', 'chat_001_conversations_user_id');
  ensureColumn(db, 'messages', 'user_id INTEGER', 'chat_002_messages_user_id');

  db.run(CREATE_INDEXES_SQL);

  return db;
}

/**
 * 创建新会话
 * @returns 新创建的会话对象
 */
export function createConversation(
  db: Database,
  input: CreateConversationInput = {},
  userId: number,
): Conversation {
  const id = crypto.randomUUID();
  const now = Date.now();
  const title = input.title ?? 'New Chat';
  const model = input.model ?? '';

  db.run(
    'INSERT INTO conversations (id, title, model, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
    [id, title, model, userId, now, now],
  );

  return {
    id,
    title,
    model,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 获取指定用户的所有会话列表，按 updated_at 降序排列
 */
export function getConversations(db: Database, userId: number): Conversation[] {
  return db
    .query(
      'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC;',
    )
    .all(userId) as Conversation[];
}

/**
 * 根据 ID 获取单个会话（可选校验所有权）
 * @returns 会话对象，不存在或不属于该用户则返回 null
 */
export function getConversation(
  db: Database,
  id: string,
  userId?: number,
): Conversation | null {
  if (userId !== undefined) {
    const rows = db
      .query('SELECT * FROM conversations WHERE id = ? AND user_id = ?;')
      .all(id, userId) as Conversation[];
    return rows[0] ?? null;
  }
  const rows = db
    .query('SELECT * FROM conversations WHERE id = ?;')
    .all(id) as Conversation[];
  return rows[0] ?? null;
}

/**
 * 更新会话标题
 * @returns 更新后的会话对象，不存在则返回 null
 */
export function updateConversationTitle(
  db: Database,
  id: string,
  title: string,
): Conversation | null {
  const now = Date.now();
  const result = db.run(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?;',
    [title, now, id],
  );

  if (result.changes === 0) {
    return null;
  }

  return getConversation(db, id);
}

/**
 * 删除会话（级联删除关联消息）
 * @returns 是否成功删除
 */
export function deleteConversation(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM conversations WHERE id = ?;', [id]);
  return result.changes > 0;
}

/**
 * 创建新消息
 * @returns 新创建的消息对象
 */
export function createMessage(
  db: Database,
  input: CreateMessageInput,
  userId: number,
): Message {
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    'INSERT INTO messages (id, conversation_id, role, content, reasoning, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
    [
      id,
      input.conversation_id,
      input.role,
      input.content,
      input.reasoning ?? null,
      userId,
      now,
    ],
  );

  // 更新会话的 updated_at
  db.run('UPDATE conversations SET updated_at = ? WHERE id = ?;', [
    now,
    input.conversation_id,
  ]);

  return {
    id,
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    reasoning: input.reasoning ?? null,
    user_id: userId,
    created_at: now,
  };
}

/**
 * 获取指定会话的所有消息，先验证会话所有权（userId 匹配）
 * @returns 消息列表，若会话不属于该用户则返回空数组
 */
export function getMessages(
  db: Database,
  conversationId: string,
  userId: number,
): Message[] {
  const conv = db
    .query('SELECT id FROM conversations WHERE id = ? AND user_id = ?;')
    .get(conversationId, userId) as { id: string } | undefined;
  if (!conv) return [];

  return db
    .query(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC;',
    )
    .all(conversationId) as Message[];
}

/**
 * 更新消息内容
 * @returns 更新后的消息对象，不存在则返回 null
 */
export function updateMessageContent(
  db: Database,
  id: string,
  content: string,
): Message | null {
  const result = db.run('UPDATE messages SET content = ? WHERE id = ?;', [
    content,
    id,
  ]);

  if (result.changes === 0) {
    return null;
  }

  const rows = db
    .query('SELECT * FROM messages WHERE id = ?;')
    .all(id) as Message[];
  return rows[0] ?? null;
}

/**
 * 安全关闭聊天数据库
 * 先执行 WAL checkpoint，再关闭连接
 */
export function closeChatDb(db: Database): void {
  db.fileControl(SQLITE_FCNTL_PERSIST_WAL, 0);
  db.run('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();
}
