import { Elysia, ValidationError } from 'elysia';
import { cors } from '@elysiajs/cors';
import { config } from './config';
import { createLogger, setDefaultLogger, getDefaultLogger } from './utils/logger';
import { authPlugin } from './middleware/auth';
import { v1Routes } from './routes/v1';
import { checkHealth } from './services/ollama';
import { transformError } from './transformers/openai';
import { initDb, closeDb } from './services/logger-db';
import { aliceStaticPlugin, aliceRoutes } from './alice/routes';
import { logSuccessfulRequest, logFailedRequest } from './middleware/request-logger';

// 初始化日志系统
const logger = createLogger({ logLevel: config.logLevel, logFile: config.logFile });
setDefaultLogger(logger);

const db = initDb(config.dbFile);

// 请求计时器（用于 SQLite 请求日志）
const requestTimings = new WeakMap<Request, number>();

// 创建 Elysia 应用
const app = new Elysia()
  // CORS 支持
  .use(cors())
  // 全局错误处理（返回 OpenAI 标准格式）
  .onError(({ error, set, path, request, body }) => {
    const logger = getDefaultLogger();
    const startTime = requestTimings.get(request);
    const duration = startTime ? performance.now() - startTime : 0;

    if (error.constructor.name === 'NotFoundError') {
      set.status = 404;
      const errorResponse = transformError(`Route not found: ${path}`, 'not_found', 'not_found');
      logFailedRequest(db, request, 404, duration, body, errorResponse);
      return errorResponse;
    }

    if (error instanceof ValidationError) {
      set.status = 400;
      const summary = error.message;
      logger?.warn('Validation error', { path, error: summary });
      const errorResponse = transformError(
        `Invalid request: ${summary}`,
        'invalid_request_error',
        'invalid_request',
      );
      logFailedRequest(db, request, 400, duration, body, errorResponse);
      return errorResponse;
    }

    // 其他未处理错误
    set.status = 500;
    logger?.error('Unhandled error', { path, error: String(error) });
    const errorResponse = transformError('Internal server error', 'internal_error', 'internal_error');
    logFailedRequest(db, request, 500, duration, body, errorResponse);
    return errorResponse;
  })
  // 请求生命周期日志
  .onBeforeHandle(({ request }) => {
    const url = new URL(request.url);
    logger.info(`${request.method} ${url.pathname}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    requestTimings.set(request, performance.now());
  })
  .onAfterHandle(({ request, set, body, response }) => {
    const url = new URL(request.url);
    logger.info(`${request.method} ${url.pathname} → ${set.status}`);

    const startTime = requestTimings.get(request);
    const duration = startTime ? performance.now() - startTime : 0;
    const statusCode = typeof set.status === 'number'
      ? set.status
      : typeof set.status === 'string'
        ? parseInt(set.status, 10) || 200
        : 200;
    logSuccessfulRequest(db, request, statusCode, duration, body, response);
  })
  // 健康检查端点
  .get('/health', async () => {
    const healthy = await checkHealth();
    if (!healthy) {
      return { status: 'degraded', ollama: 'unreachable' };
    }
    return { status: 'ok', ollama: 'reachable' };
  })
  // Alice 仪表盘（无需认证）
  .use(aliceStaticPlugin)
  .use(aliceRoutes(db))
  // 认证插件
  .use(authPlugin)
  // API 路由
  .use(v1Routes)
  // 启动服务器
  .listen(config.port);

// 启动日志
logger.info(`Ollawe Gateway started`, {
  port: config.port,
  ollamaUrl: config.ollamaUrl,
  logLevel: config.logLevel,
});
console.log(`🦊 Ollawe is running at ${app.server?.hostname}:${app.server?.port}`);

// 优雅关闭
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  app.stop();
  closeDb(db);
  await logger.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));