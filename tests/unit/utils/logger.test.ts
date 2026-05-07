import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createLogger } from '../../../src/utils/logger';
import type { Logger, LoggerConfig } from '../../../src/utils/logger';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 临时日志目录，避免写入 /var/log
const TMP_DIR = '/tmp/alice-way-test-logs';

// 捕获 console.log 输出
let consoleLogMock: ReturnType<typeof mock>;
let capturedLogs: string[] = [];

function setupConsoleMock() {
  capturedLogs = [];
  consoleLogMock = mock((...args: unknown[]) => {
    capturedLogs.push(args.map(String).join(' '));
  });
  // 保存原始 console.log 以便恢复
  const originalLog = console.log;
  console.log = consoleLogMock as unknown as typeof console.log;
  return originalLog;
}

function restoreConsoleLog(originalLog: typeof console.log) {
  console.log = originalLog;
}

describe('createLogger', () => {
  let logger: Logger;
  let originalLog: typeof console.log;

  beforeEach(() => {
    originalLog = setupConsoleMock();
    // 确保临时目录干净
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    restoreConsoleLog(originalLog);
    // 清理临时目录
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    // 清理可能由降级测试创建的 .log 目录
    if (existsSync('.log')) {
      rmSync('.log', { recursive: true, force: true });
    }
  });

  it('creates logger with all methods', () => {
    const config: LoggerConfig = {
      logLevel: 'debug',
      logFile: join(TMP_DIR, 'all-methods.log'),
    };
    logger = createLogger(config);

    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.flush).toBe('function');
    expect(typeof logger.close).toBe('function');
  });

  it('level filtering works - debug level logs everything', () => {
    const config: LoggerConfig = {
      logLevel: 'debug',
      logFile: join(TMP_DIR, 'debug-level.log'),
    };
    logger = createLogger(config);

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    // debug 级别应该输出所有日志
    expect(capturedLogs.length).toBe(4);
  });

  it('level filtering works - info level filters out debug', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'info-level.log'),
    };
    logger = createLogger(config);

    logger.debug('should be filtered');
    logger.info('should pass');
    logger.warn('should pass');
    logger.error('should pass');

    // debug 被过滤，只有 info/warn/error 输出
    expect(capturedLogs.length).toBe(3);
    expect(capturedLogs[0]).toContain('INFO');
    expect(capturedLogs[1]).toContain('WARN');
    expect(capturedLogs[2]).toContain('ERROR');
  });

  it('level filtering works - warn level filters out debug and info', () => {
    const config: LoggerConfig = {
      logLevel: 'warn',
      logFile: join(TMP_DIR, 'warn-level.log'),
    };
    logger = createLogger(config);

    logger.debug('filtered');
    logger.info('filtered');
    logger.warn('should pass');
    logger.error('should pass');

    expect(capturedLogs.length).toBe(2);
    expect(capturedLogs[0]).toContain('WARN');
    expect(capturedLogs[1]).toContain('ERROR');
  });

  it('level filtering works - error level filters out everything except error', () => {
    const config: LoggerConfig = {
      logLevel: 'error',
      logFile: join(TMP_DIR, 'error-level.log'),
    };
    logger = createLogger(config);

    logger.debug('filtered');
    logger.info('filtered');
    logger.warn('filtered');
    logger.error('should pass');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('ERROR');
  });
});

describe('Logger methods', () => {
  let logger: Logger;
  let originalLog: typeof console.log;

  beforeEach(() => {
    originalLog = setupConsoleMock();
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    restoreConsoleLog(originalLog);
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    if (existsSync('.log')) {
      rmSync('.log', { recursive: true, force: true });
    }
  });

  it('info logs with correct format', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'info-test.log'),
    };
    logger = createLogger(config);

    logger.info('test info message');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('INFO');
    expect(capturedLogs[0]).toContain('test info message');
  });

  it('warn logs with correct format', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'warn-test.log'),
    };
    logger = createLogger(config);

    logger.warn('test warn message');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('WARN');
    expect(capturedLogs[0]).toContain('test warn message');
  });

  it('error logs with correct format', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'error-test.log'),
    };
    logger = createLogger(config);

    logger.error('test error message');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('ERROR');
    expect(capturedLogs[0]).toContain('test error message');
  });

  it('debug logs are filtered when level is info', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'debug-filtered.log'),
    };
    logger = createLogger(config);

    logger.debug('should not appear');

    expect(capturedLogs.length).toBe(0);
  });

  it('logs include meta object as JSON', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'meta-test.log'),
    };
    logger = createLogger(config);

    logger.info('with meta', { key: 'value', count: 42 });

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('"key":"value"');
    expect(capturedLogs[0]).toContain('"count":42');
  });

  it('logs include requestId when provided', () => {
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: join(TMP_DIR, 'requestid-test.log'),
    };
    logger = createLogger(config);

    logger.info('with request id', undefined, 'req-123');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('[req-123]');
  });

  it('log format includes timestamp', () => {
    const config: LoggerConfig = {
      logLevel: 'debug',
      logFile: join(TMP_DIR, 'timestamp-test.log'),
    };
    logger = createLogger(config);

    logger.info('timestamp test');

    expect(capturedLogs.length).toBe(1);
    // 时间戳格式: [2024-01-15T10:30:00.000Z]
    const timestampPattern = /\[\d{4}-\d{2}-\d{2}T/;
    expect(capturedLogs[0]).toMatch(timestampPattern);
  });
});

describe('FileWriter', () => {
  let logger: Logger;
  let originalLog: typeof console.log;

  beforeEach(() => {
    originalLog = setupConsoleMock();
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    restoreConsoleLog(originalLog);
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    if (existsSync('.log')) {
      rmSync('.log', { recursive: true, force: true });
    }
  });

  it('writes log entries to file', async () => {
    const logFile = join(TMP_DIR, 'file-write.log');
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile,
    };
    logger = createLogger(config);

    logger.info('file write test');

    // 刷新并关闭以确保写入磁盘
    await logger.flush();
    await logger.close();

    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, 'utf-8');
    expect(content).toContain('INFO');
    expect(content).toContain('file write test');
  });

  it('writes multiple log entries to file', async () => {
    const logFile = join(TMP_DIR, 'multi-write.log');
    const config: LoggerConfig = {
      logLevel: 'debug',
      logFile,
    };
    logger = createLogger(config);

    logger.info('first line');
    logger.warn('second line');
    logger.error('third line');

    await logger.flush();
    await logger.close();

    const content = readFileSync(logFile, 'utf-8');
    expect(content).toContain('first line');
    expect(content).toContain('second line');
    expect(content).toContain('third line');
  });
});

describe('FileWriter path degradation', () => {
  let logger: Logger;
  let originalLog: typeof console.log;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalLog = setupConsoleMock();
    // 同时 mock console.warn 以捕获降级警告
    capturedLogs = [];
    originalWarn = console.warn;
    console.warn = mock((...args: unknown[]) => {
      capturedLogs.push(args.map(String).join(' '));
    }) as unknown as typeof console.warn;

    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    console.warn = originalWarn;
    restoreConsoleLog(originalLog);
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    if (existsSync('.log')) {
      rmSync('.log', { recursive: true, force: true });
    }
  });

  it('falls back to .log/ directory when primary path is unwritable', async () => {
    // 使用一个不存在的深层路径，模拟不可写的情况
    const unwritablePath = '/nonexistent/deep/path/that/does/not/exist/gateway.log';
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: unwritablePath,
    };
    logger = createLogger(config);

    logger.info('fallback test');

    // 等待文件写入完成
    await logger.flush();
    await logger.close();

    // 验证降级警告被输出
    const warnMessages = capturedLogs.filter((log) =>
      log.includes('falling back')
    );
    expect(warnMessages.length).toBeGreaterThan(0);

    // 验证 .log/ 目录下的降级文件被创建
    const fallbackFile = join('.log', 'gateway.log');
    expect(existsSync(fallbackFile)).toBe(true);

    const content = readFileSync(fallbackFile, 'utf-8');
    expect(content).toContain('fallback test');
  });

  it('falls back and preserves original filename', async () => {
    const unwritablePath = '/nonexistent/path/my-app.log';
    const config: LoggerConfig = {
      logLevel: 'info',
      logFile: unwritablePath,
    };
    logger = createLogger(config);

    logger.info('filename preservation test');

    await logger.flush();
    await logger.close();

    // 降级文件应保留原文件名 my-app.log
    const fallbackFile = join('.log', 'my-app.log');
    expect(existsSync(fallbackFile)).toBe(true);
  });
});