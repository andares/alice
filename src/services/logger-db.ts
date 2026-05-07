import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** SQLite FCNTL code for PERSIST_WAL（来自 sqlite3.h，值为 10） */
const SQLITE_FCNTL_PERSIST_WAL = 10;

/** 写入日志时的输入类型 */
export type LogEntry = {
  timestamp: number;
  method: string;
  path: string;
  request_body?: string | null;
  response_body?: string | null;
  user_id?: string;
  key_id?: string;
  duration_ms?: number;
  status_code?: number;
};

/** 从数据库读取的日志行类型 */
export type LogRow = {
  id: number;
  timestamp: number;
  method: string;
  path: string;
  request_body: string | null;
  response_body: string | null;
  user_id: string;
  key_id: string;
  duration_ms: number | null;
  status_code: number | null;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_body TEXT,
  response_body TEXT,
  user_id TEXT DEFAULT '0',
  key_id TEXT DEFAULT '0',
  duration_ms INTEGER,
  status_code INTEGER
);`;

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_timestamp ON request_logs(timestamp DESC);`;

/** 默认最大请求/响应体大小：10KB */
const DEFAULT_MAX_BODY_SIZE = 10240;

/**
 * 截断过大的请求/响应体
 * 超过 maxSize 时保留前 maxSize 字节并追加截断提示
 */
export function truncateBody(
  body: string | null | undefined,
  maxSize: number = DEFAULT_MAX_BODY_SIZE,
): string | null {
  if (body == null) return null;
  if (body.length > maxSize) {
    return `${body.substring(0, maxSize)}[truncated, ${body.length} bytes total]`;
  }
  return body;
}

/**
 * 初始化 SQLite 数据库
 * - 自动创建父目录（如无权限则降级到项目目录下 .data/）
 * - 启用 WAL 模式
 * - 创建表和索引
 */
export function initDb(dbPath: string): Database {
  let actualPath = dbPath;

  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch {
    // 配置路径无写权限，降级到项目目录下 .data/ 目录
    const fileName = dbPath.substring(dbPath.lastIndexOf('/') + 1);
    actualPath = `.data/${fileName}`;
    console.warn(`DB: Cannot write to ${dbPath}, falling back to ${actualPath}`);
    mkdirSync(dirname(actualPath), { recursive: true });
  }

  const db = new Database(actualPath);

  db.run('PRAGMA journal_mode = WAL');

  db.run(CREATE_TABLE_SQL);
  db.run(CREATE_INDEX_SQL);

  return db;
}

const INSERT_SQL = `
INSERT INTO request_logs (timestamp, method, path, request_body, response_body, user_id, key_id, duration_ms, status_code)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;

/**
 * 异步写入日志（fire-and-forget）
 * 使用 setImmediate 将写入操作推迟到下一个事件循环，
 * 避免阻塞 API 响应
 */
export function insertLog(db: Database, log: LogEntry): void {
  const truncatedRequestBody = truncateBody(log.request_body);
  const truncatedResponseBody = truncateBody(log.response_body);

  setImmediate(() => {
    db.run(
      INSERT_SQL,
      [
        log.timestamp,
        log.method,
        log.path,
        truncatedRequestBody,
        truncatedResponseBody,
        log.user_id ?? '0',
        log.key_id ?? '0',
        log.duration_ms ?? null,
        log.status_code ?? null,
      ],
    );
  });
}

/**
 * 分页查询日志
 * @param page 页码（1-indexed）
 * @param perPage 每页条数，默认 30
 */
export function getLogs(db: Database, page: number, perPage: number = 30): LogRow[] {
  const offset = (page - 1) * perPage;
  return db.query(
    'SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?;',
  ).all(perPage, offset) as LogRow[];
}

/** 根据 ID 获取单条日志 */
export function getLogById(db: Database, id: number): LogRow | null {
  const rows = db.query(
    'SELECT * FROM request_logs WHERE id = ?;',
  ).all(id) as LogRow[];
  return rows[0] ?? null;
}

/** 获取日志总条数 */
export function getTotalCount(db: Database): number {
  const result = db.query('SELECT COUNT(*) as count FROM request_logs;').get() as { count: number };
  return result.count;
}

/**
 * 安全关闭数据库
 * 先执行 WAL checkpoint，再关闭连接
 */
export function closeDb(db: Database): void {
  db.fileControl(SQLITE_FCNTL_PERSIST_WAL, 0);
  db.run('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();
}