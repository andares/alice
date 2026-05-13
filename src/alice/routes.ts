import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { html } from '@elysiajs/html';
import { cookie } from '@elysiajs/cookie';
import type { Database } from 'bun:sqlite';
import { StatusPage } from './pages/status';
import { ConfigPage } from './pages/config';
import { LogsPage } from './pages/logs';
import { ApiKeysPage } from './pages/api-keys';
import { RouterModelsPage } from './pages/router-models';
import { UsersPage } from './pages/users';
import { checkHealth, listModels, listRunningModels } from '../services/ollama';
import { getLogs, getLogById, getTotalCount } from '../services/logger-db';
import { config } from '../config';
import { Field } from './components/field';
import { JsonTextarea } from './components/json-textarea';
import { elysiaAuthPlugin } from '../foundation/elysia-auth';
import { listApiKeys, createApiKey, deleteApiKey, deactivateApiKey } from '../foundation/api-keys';
import { listRouterModels, createRouterModel, updateRouterModel, deleteRouterModel, getRouterModel } from '../foundation/router-models';
import { isAdmin, getAllAdmins, promoteToAdmin } from '../foundation/administrators';
import type { LogRow } from '../services/logger-db';
import type { OllamaModel, RunningModel } from '../types';

function maskApiKey(key: string | undefined): string {
  if (!key) return '(not configured)';
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
    .use(cookie())
    .use(elysiaAuthPlugin(db))
    .guard({ requireAdmin: true }, (app) =>
      app
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
            ollamaUrl: config.ollamaUrl ?? 'Not configured',
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
        })

        // ===== API Key 管理页 =====
        .get('/api-keys', () => {
          const keys = listApiKeys(db);
          return ApiKeysPage({ keys });
        })
        .post('/api-keys', async ({ body }) => {
          const { description } = body as { description?: string };
          const result = await createApiKey(db, description);
          return { success: true, plaintext: result.plaintext, key: result.record };
        })
        .delete('/api-keys/:id', ({ params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) {
            set.status = 400;
            return { error: 'Invalid ID' };
          }
          deleteApiKey(db, id);
          return { success: true };
        })
        .post('/api-keys/:id/deactivate', ({ params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) {
            set.status = 400;
            return { error: 'Invalid ID' };
          }
          deactivateApiKey(db, id);
          return { success: true };
        })

        // ===== Router 模型管理页 =====
        .get('/router-models', () => {
          const models = listRouterModels(db);
          return RouterModelsPage({ models });
        })
        .post('/router-models', ({ body, set }) => {
          const { name, variant, base_url, model, api_key, options } = body as {
            name: string;
            variant?: string;
            base_url: string;
            model: string;
            api_key?: string | null;
            options?: string | null;
          };
          try {
            const created = createRouterModel(db, { name, variant, base_url, model, api_key, options });
            return { success: true, model: created };
          } catch (err) {
            set.status = 400;
            return { error: err instanceof Error ? err.message : 'Failed to create model' };
          }
        })
        .put('/router-models/:id', ({ body, params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) {
            set.status = 400;
            return { error: 'Invalid ID' };
          }
          const existing = getRouterModel(db, id);
          if (!existing) {
            set.status = 404;
            return { error: 'Model not found' };
          }
          const { name, variant, base_url, model, api_key, options } = body as {
            name?: string;
            variant?: string;
            base_url?: string;
            model?: string;
            api_key?: string | null;
            options?: string | null;
          };
          try {
            updateRouterModel(db, id, { name, variant, base_url, model, api_key, options });
            return { success: true, model: getRouterModel(db, id) };
          } catch (err) {
            set.status = 400;
            return { error: err instanceof Error ? err.message : 'Failed to update model' };
          }
        })
        .delete('/router-models/:id', ({ params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) {
            set.status = 400;
            return { error: 'Invalid ID' };
          }
          deleteRouterModel(db, id);
          return { success: true };
        })

        // ===== 用户管理页 =====
        .get('/users', () => {
          const adminList = getAllAdmins(db);
          return UsersPage({ admins: adminList });
        })
        .post('/users/promote', ({ body, set }) => {
          const { user_id } = body as { user_id: number };
          if (isNaN(Number(user_id))) {
            set.status = 400;
            return { error: 'Invalid user ID' };
          }
          try {
            promoteToAdmin(db, Number(user_id));
            return { success: true };
          } catch (err) {
            set.status = 400;
            return { error: err instanceof Error ? err.message : 'Failed to promote user' };
          }
        }),
    );