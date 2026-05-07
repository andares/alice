import { describe, it, expect } from 'bun:test';
import { StatusPage } from '../../../src/alice/pages/status';
import { ConfigPage } from '../../../src/alice/pages/config';
import { LogsPage } from '../../../src/alice/pages/logs';
import { ollamaModels, runningModels } from '../../fixtures/ollama-responses';
import type { LogRow } from '../../../src/services/logger-db';

describe('StatusPage', () => {
  it('contains Ollama status indicator with Connected when healthy is true', () => {
    const html = StatusPage({ healthy: true, models: [], runningModels: [] });
    expect(html).toContain('Ollama Connection');
    expect(html).toContain('Connected');
    expect(html).toContain('text-success');
  });

  it('shows Unreachable status when healthy is false', () => {
    const html = StatusPage({ healthy: false, models: [], runningModels: [] });
    expect(html).toContain('Unreachable');
    expect(html).toContain('text-error');
    expect(html).toContain('border-error');
  });

  it('contains model list when models are provided', () => {
    const html = StatusPage({ healthy: true, models: ollamaModels, runningModels: [] });
    expect(html).toContain('llama3.1:8b');
    expect(html).toContain('qwen2.5:7b');
    expect(html).toContain('<table');
    expect(html).toContain('Installed Models');
  });

  it('shows "No models installed" when models array is empty', () => {
    const html = StatusPage({ healthy: true, models: [], runningModels: [] });
    expect(html).toContain('No models installed');
  });

  it('shows running models table when runningModels are provided', () => {
    const html = StatusPage({ healthy: true, models: [], runningModels: runningModels });
    expect(html).toContain('Running Models');
    expect(html).toContain('llama3.1:8b');
    expect(html).toContain('4.58 GB');
    expect(html).toContain('<table');
  });

  it('shows "No running models" when runningModels array is empty', () => {
    const html = StatusPage({ healthy: true, models: [], runningModels: [] });
    expect(html).toContain('No running models');
  });
});

describe('ConfigPage', () => {
  const mockConfig = {
    port: 3000,
    apiKey: 'sk***xx',
    ollamaUrl: 'http://127.0.0.1:11434',
    logLevel: 'info',
    logFile: '/var/log/alice-way/gateway.log',
    dbFile: '/var/lib/alice-way/alice.db',
  };

  it('contains configuration fields', () => {
    const html = ConfigPage({ config: mockConfig });
    expect(html).toContain('Port');
    expect(html).toContain('Ollama URL');
    expect(html).toContain('API Key');
    expect(html).toContain('Log Level');
    expect(html).toContain('Log File');
    expect(html).toContain('DB File');
    expect(html).toContain('3000');
    expect(html).toContain('http://127.0.0.1:11434');
    expect(html).toContain('info');
  });

  it('displays masked API key with ***', () => {
    const html = ConfigPage({ config: mockConfig });
    expect(html).toContain('sk***xx');
    expect(html).toContain('***');
  });

  it('contains dbFile field', () => {
    const html = ConfigPage({ config: mockConfig });
    expect(html).toContain('DB File');
    expect(html).toContain('/var/lib/alice-way/alice.db');
  });
});

describe('LogsPage', () => {
  const mockLogs: LogRow[] = [
    {
      id: 1,
      timestamp: 1700000000000,
      method: 'GET',
      path: '/v1/models',
      request_body: null,
      response_body: null,
      user_id: '0',
      key_id: '0',
      duration_ms: 45,
      status_code: 200,
    },
    {
      id: 2,
      timestamp: 1700100000000,
      method: 'POST',
      path: '/v1/chat/completions',
      request_body: '{"model":"llama3.1:8b"}',
      response_body: '{"choices":[]}',
      user_id: '0',
      key_id: '0',
      duration_ms: 1200,
      status_code: 200,
    },
  ];

  it('contains table element', () => {
    const html = LogsPage({ logs: mockLogs, currentPage: 1, totalPages: 5 });
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    expect(html).toContain('Request Logs');
  });

  it('contains pagination component', () => {
    const html = LogsPage({ logs: mockLogs, currentPage: 1, totalPages: 5 });
    expect(html).toContain('join');
    expect(html).toContain('«');
    expect(html).toContain('»');
  });

  it('shows "No logs found" when logs array is empty', () => {
    const html = LogsPage({ logs: [], currentPage: 1, totalPages: 0 });
    expect(html).toContain('No logs found');
  });

  it('displays log data when logs are provided', () => {
    const html = LogsPage({ logs: mockLogs, currentPage: 1, totalPages: 5 });
    expect(html).toContain('GET');
    expect(html).toContain('POST');
    expect(html).toContain('/v1/models');
    expect(html).toContain('/v1/chat/completions');
    expect(html).toContain('45ms');
    expect(html).toContain('1200ms');
    expect(html).toContain('200');
  });
});
