import type { LogLevel } from '../types';
import type { FileSink } from 'bun';
import { mkdirSync } from 'node:fs';

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogWriter {
  write(line: string): void;
  flush(): Promise<void>;
}

class ConsoleWriter implements LogWriter {
  private readonly minLevel: LogLevel;

  constructor(minLevel: LogLevel) {
    this.minLevel = minLevel;
  }

  write(line: string): void {
    const levelMatch = line.match(/ \[(DEBUG|INFO|WARN|ERROR)\]:/);
    if (levelMatch) {
      const level = levelMatch[1].toLowerCase() as LogLevel;
      const color = COLORS[level] || '';
      console.log(`${color}${line}${RESET}`);
    } else {
      console.log(line);
    }
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}

class FileWriter implements LogWriter {
  private writer: FileSink | null = null;
  private filePath: string;
  private initialized = false;
  private disabled = false;
  private readonly encoder = new TextEncoder();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private ensureInitialized(): void {
    if (this.initialized || this.disabled) return;

    let lastError: unknown = null;

    // 尝试初始化指定路径的日志写入器
    const initWriter = (path: string): boolean => {
      const logDir = path.substring(0, path.lastIndexOf('/'));
      if (logDir) {
        try {
          mkdirSync(logDir, { recursive: true });
        } catch (err: unknown) {
          lastError = err;
          return false;
        }
      }

      try {
        this.writer = Bun.file(path).writer();
        this.filePath = path;
        this.initialized = true;
        return true;
      } catch (err: unknown) {
        lastError = err;
        return false;
      }
    };

    if (!initWriter(this.filePath)) {
      // 降级到当前工作目录下的 .log/ 目录，保留原文件名
      const fileName = this.filePath.substring(this.filePath.lastIndexOf('/') + 1);
      const fallbackPath = `.log/${fileName}`;

      console.warn(`Logger: Cannot write to ${this.filePath}, falling back to ${fallbackPath}`);

      if (!initWriter(fallbackPath)) {
        this.disabled = true;
        console.error(`Logger file init error: ${this.filePath} and fallback ${fallbackPath} both failed`, lastError);
      }
    }
  }

  write(line: string): void {
    this.ensureInitialized();
    if (!this.writer) return;

    try {
      this.writer.write(this.encoder.encode(line + '\n'));
    } catch (err: unknown) {
      console.error('Logger file write error:', err);
    }
  }

  async flush(): Promise<void> {
    if (!this.writer) return;
    try {
      await this.writer.end();
    } catch {
      // 关闭失败不影响后续操作，静默处理
    }
    this.writer = Bun.file(this.filePath).writer();
  }

  async close(): Promise<void> {
    if (this.writer) {
      try {
        await this.writer.end();
      } catch {
        // 关闭失败时无法恢复，静默处理
      }
      this.writer = null;
      this.initialized = false;
    }
  }
}

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>, requestId?: string): void;
  info(msg: string, meta?: Record<string, unknown>, requestId?: string): void;
  warn(msg: string, meta?: Record<string, unknown>, requestId?: string): void;
  error(msg: string, meta?: Record<string, unknown>, requestId?: string): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface LoggerConfig {
  logLevel: LogLevel;
  logFile: string;
}

export function createLogger(config: LoggerConfig): Logger {
  const consoleWriter = new ConsoleWriter(config.logLevel);
  const fileWriter = new FileWriter(config.logFile);
  const minWeight = LEVEL_WEIGHT[config.logLevel];

  const formatEntry = (entry: LogEntry): string => {
    const level = entry.level.toUpperCase().padEnd(5);
    const requestPart = entry.requestId ? ` [${entry.requestId}]` : '';
    const metaPart = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    return `[${entry.timestamp}] ${level}:${requestPart} ${entry.message}${metaPart}`;
  };

  const log = (level: LogLevel, msg: string, meta?: Record<string, unknown>, requestId?: string): void => {
    if (LEVEL_WEIGHT[level] < minWeight) return;

    const timestamp = new Date().toISOString();
    const entry: LogEntry = { level, message: msg, meta, requestId, timestamp };
    const formatted = formatEntry(entry);

    consoleWriter.write(formatted);
    fileWriter.write(formatted);
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>, requestId?: string) =>
      log('debug', msg, meta, requestId),
    info: (msg: string, meta?: Record<string, unknown>, requestId?: string) =>
      log('info', msg, meta, requestId),
    warn: (msg: string, meta?: Record<string, unknown>, requestId?: string) =>
      log('warn', msg, meta, requestId),
    error: (msg: string, meta?: Record<string, unknown>, requestId?: string) =>
      log('error', msg, meta, requestId),
    flush: async () => {
      await fileWriter.flush();
    },
    close: async () => {
      await fileWriter.close();
    },
  };
}

let defaultLogger: Logger | null = null;

export function getDefaultLogger(): Logger | null {
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}