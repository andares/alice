import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { html } from '@elysiajs/html';
import type { Database } from 'bun:sqlite';
import { StatusPage } from './pages/status';
import { ConfigPage } from './pages/config';
import { LogsPage } from './pages/logs';
import { checkHealth, listModels, listRunningModels } from '../services/ollama';
import { getLogs, getLogById, getTotalCount } from '../services/logger-db';
import { config } from '../config';
import { Field } from './components/field';
import { JsonTextarea } from './components/json-textarea';
import type { LogRow } from '../services/logger-db';
import type { OllamaModel, RunningModel } from '../types';

function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return key.slice(0, 2) + '***' + key.slice(-2);
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function renderLogDetail(log: LogRow): string {
  const fields = [
    { label: 'ID', value: String(log.id) },
    { label: 'Timestamp', value: formatTimestamp(log.timestamp) },
    { label: 'Method', value: log.method },
    { label: 'Path', value: log.path },
    { label: 'Status Code', value: log.status_code !== null ? String(log.status_code) : '-' },
    { label: 'Duration', value: log.duration_ms !== null ? `${log.duration_ms}ms` : '-' },
    { label: 'User ID', value: log.user_id },
    { label: 'Key ID', value: log.key_id },
  ];

  const fieldElements = fields.map(
    (f) => Field({ label: f.label, value: f.value }),
  );

  const requestBodyEl = log.request_body
    ? JsonTextarea({ content: log.request_body, label: 'Request Body' })
    : Field({ label: 'Request Body', value: '(empty)' });

  const responseBodyEl = log.response_body
    ? JsonTextarea({ content: log.response_body, label: 'Response Body' })
    : Field({ label: 'Response Body', value: '(empty)' });

  return `<div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      ${fieldElements.join('\n')}
    </div>
    <div class="mt-4">
      ${requestBodyEl}
    </div>
    <div class="mt-4">
      ${responseBodyEl}
    </div>
  </div>`;
}

export const aliceStaticPlugin = new Elysia()
  .use(staticPlugin({
    assets: 'public',
    prefix: '/alice/static',
  }));

export const aliceRoutes = (db: Database) =>
  new Elysia({ prefix: '/alice' })
    .use(html())
    .get('/', async () => {
      const [healthyResult, modelsResult, runningResult] = await Promise.allSettled([
        checkHealth(),
        listModels(),
        listRunningModels(),
      ]);

      const healthy = healthyResult.status === 'fulfilled' ? healthyResult.value : false;
      const models: OllamaModel[] = modelsResult.status === 'fulfilled'
        ? modelsResult.value.models
        : [];
      const runningModels: RunningModel[] = runningResult.status === 'fulfilled'
        ? runningResult.value
        : [];

      return StatusPage({ healthy, models, runningModels });
    })
    .get('/config', () => {
      const maskedConfig = {
        port: config.port,
        apiKey: maskApiKey(config.apiKey),
        ollamaUrl: config.ollamaUrl,
        logLevel: config.logLevel,
        logFile: config.logFile,
        dbFile: config.dbFile,
      };
      return ConfigPage({ config: maskedConfig });
    })
    .get('/logs', ({ query }) => {
      const page = Number(query.page) || 1;
      const perPage = 30;
      const total = getTotalCount(db);
      const totalPages = Math.min(Math.ceil(total / perPage), 50);
      const logs = getLogs(db, page, perPage);
      return LogsPage({ logs, currentPage: page, totalPages });
    })
    .get('/logs/:id', ({ params }) => {
      const log = getLogById(db, Number(params.id));
      if (!log) return '<p>Log not found</p>';
      return renderLogDetail(log);
    });