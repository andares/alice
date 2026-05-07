import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  initDb,
  insertLog,
  getLogs,
  getLogById,
  getTotalCount,
  closeDb,
} from '../../../src/services/logger-db';

/** 辅助函数：等待 setImmediate 异步写入完成 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(() => resolve()));
}

describe('logger-db integration', () => {
  let db: Database;

  beforeAll(() => {
    db = initDb(':memory:');
  });

  afterAll(() => {
    closeDb(db);
  });

  // ============================================================
  // initDb 测试
  // ============================================================
  describe('initDb', () => {
    it('should create request_logs table', () => {
      const result = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='request_logs'")
        .get() as { name: string } | null;
      expect(result).not.toBeNull();
      expect(result!.name).toBe('request_logs');
    });

    it('should create idx_timestamp index', () => {
      const result = db
        .query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_timestamp'")
        .get() as { name: string } | null;
      expect(result).not.toBeNull();
      expect(result!.name).toBe('idx_timestamp');
    });

    it('should set journal_mode (wal for file-based, memory for :memory:)', () => {
      const result = db.query('PRAGMA journal_mode').get() as {
        journal_mode: string;
      };
      // :memory: 数据库无法使用 WAL 模式，journal_mode 为 'memory'
      // 文件数据库会返回 'wal'，此处验证 PRAGMA 已执行
      expect(['wal', 'memory']).toContain(result.journal_mode);
    });
  });

  // ============================================================
  // insertLog + getLogs 测试
  // ============================================================
  describe('insertLog + getLogs', () => {
    it('should insert and retrieve a log entry', async () => {
      const log = {
        timestamp: 1000000,
        method: 'POST',
        path: '/v1/chat/completions',
        request_body: '{"model":"gpt-4","messages":[]}',
        response_body: '{"id":"chatcmpl-1"}',
        user_id: 'user-1',
        key_id: 'key-1',
        duration_ms: 150,
        status_code: 200,
      };

      insertLog(db, log);
      await flushAsync();

      const logs = getLogs(db, 1, 100);
      const inserted = logs.find(
        (l) => l.method === 'POST' && l.path === '/v1/chat/completions',
      );
      expect(inserted).toBeDefined();
      expect(inserted!.method).toBe('POST');
      expect(inserted!.path).toBe('/v1/chat/completions');
      expect(inserted!.request_body).toBe(log.request_body);
      expect(inserted!.response_body).toBe(log.response_body);
      expect(inserted!.user_id).toBe('user-1');
      expect(inserted!.key_id).toBe('key-1');
      expect(inserted!.duration_ms).toBe(150);
      expect(inserted!.status_code).toBe(200);
    });

    it('should handle pagination correctly', async () => {
      // 插入 5 条记录用于分页测试
      for (let i = 0; i < 5; i++) {
        insertLog(db, {
          timestamp: 2000000 + i,
          method: 'GET',
          path: `/v1/models?page=${i}`,
        });
      }
      await flushAsync();

      // 每页 2 条，第 1 页
      const page1 = getLogs(db, 1, 2);
      expect(page1.length).toBe(2);

      // 每页 2 条，第 2 页
      const page2 = getLogs(db, 2, 2);
      expect(page2.length).toBe(2);

      // 每页 2 条，第 3 页（可能不足 2 条）
      const page3 = getLogs(db, 3, 2);
      expect(page3.length).toBeLessThanOrEqual(2);

      // 验证分页结果不重叠
      const page1Ids = page1.map((l) => l.id);
      const page2Ids = page2.map((l) => l.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toEqual([]);
    });

    it('should return empty array for out-of-range page', () => {
      const logs = getLogs(db, 9999, 10);
      expect(logs).toEqual([]);
    });

    it('should default null fields when optional values are omitted', async () => {
      const log = {
        timestamp: 3000000,
        method: 'DELETE',
        path: '/v1/models/test-defaults',
      };

      insertLog(db, log);
      await flushAsync();

      const logs = getLogs(db, 1, 100);
      const inserted = logs.find(
        (l) => l.method === 'DELETE' && l.path === '/v1/models/test-defaults',
      );
      expect(inserted).toBeDefined();
      // 未提供的可选字段应为 null 或默认值
      expect(inserted!.request_body).toBeNull();
      expect(inserted!.response_body).toBeNull();
      expect(inserted!.user_id).toBe('0');
      expect(inserted!.key_id).toBe('0');
      expect(inserted!.duration_ms).toBeNull();
      expect(inserted!.status_code).toBeNull();
    });
  });

  // ============================================================
  // getLogById 测试
  // ============================================================
  describe('getLogById', () => {
    it('should find a log by ID', async () => {
      // 直接插入以获取已知 ID
      db.run(
        'INSERT INTO request_logs (timestamp, method, path) VALUES (?, ?, ?)',
        [4000000, 'PUT', '/v1/models/by-id-test'],
      );

      const row = db
        .query('SELECT * FROM request_logs WHERE method = ?')
        .get('PUT') as { id: number } | null;
      expect(row).not.toBeNull();

      const found = getLogById(db, row!.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(row!.id);
      expect(found!.method).toBe('PUT');
      expect(found!.path).toBe('/v1/models/by-id-test');
    });

    it('should return null for non-existent ID', () => {
      const found = getLogById(db, 999999);
      expect(found).toBeNull();
    });
  });

  // ============================================================
  // getTotalCount 测试
  // ============================================================
  describe('getTotalCount', () => {
    it('should return 0 for empty table', () => {
      // 使用独立的 :memory: 数据库测试空表
      const emptyDb = initDb(':memory:');
      try {
        const count = getTotalCount(emptyDb);
        expect(count).toBe(0);
      } finally {
        closeDb(emptyDb);
      }
    });

    it('should return correct count after inserts', async () => {
      const countBefore = getTotalCount(db);

      // 插入 3 条记录
      for (let i = 0; i < 3; i++) {
        insertLog(db, {
          timestamp: 5000000 + i,
          method: 'PATCH',
          path: `/v1/models/count-test-${i}`,
        });
      }
      await flushAsync();

      const countAfter = getTotalCount(db);
      expect(countAfter).toBe(countBefore + 3);
    });
  });

  // ============================================================
  // closeDb 测试
  // ============================================================
  describe('closeDb', () => {
    it('should close database without error', () => {
      const tempDb = initDb(':memory:');
      // 插入一些数据确保数据库有内容
      tempDb.run(
        'INSERT INTO request_logs (timestamp, method, path) VALUES (?, ?, ?)',
        [6000000, 'OPTIONS', '/health'],
      );

      // closeDb 应正常执行（包含 WAL checkpoint 和关闭）
      expect(() => closeDb(tempDb)).not.toThrow();
    });
  });
});