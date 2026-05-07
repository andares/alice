import { Layout } from '../layout';
import { Card } from '../components/card';
import { Pagination } from '../components/pagination';
import { Modal } from '../components/modal';
import { Field } from '../components/field';
import { JsonTextarea } from '../components/json-textarea';

import type { LogRow } from '../../services/logger-db';

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'badge-success';
    case 'POST':
      return 'badge-primary';
    case 'PUT':
      return 'badge-warning';
    case 'DELETE':
      return 'badge-error';
    default:
      return 'badge-secondary';
  }
}

export function LogsPage({
  logs,
  currentPage,
  totalPages,
}: {
  logs: LogRow[];
  currentPage: number;
  totalPages: number;
}): JSX.Element {
  return (
    <Layout activeMenu="logs" title="Logs">
      <>
        <div class="space-y-6">
          <Card title="Request Logs" color="info">
            <>
              <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Method</th>
                      <th>Path</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colspan="5" class="text-center text-base-content/50 py-8">
                          No logs found
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr
                          class="cursor-pointer hover:bg-base-200"
                          hx-get={`/alice/logs/${log.id}`}
                          hx-target="#modal-content"
                          hx-swap="innerHTML"
                          hx-on="htmx:after-request: document.getElementById('log-detail').showModal()"
                        >
                          <td>{formatTimestamp(log.timestamp)}</td>
                          <td>
                            <span class={`badge badge-sm ${methodBadgeClass(log.method)}`}>
                              {log.method}
                            </span>
                          </td>
                          <td class="font-mono text-sm">{log.path}</td>
                          <td>{log.duration_ms !== null ? `${log.duration_ms}ms` : '-'}</td>
                          <td>{log.status_code !== null ? String(log.status_code) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div class="mt-4 flex justify-center">
                <Pagination current={currentPage} total={totalPages} baseUrl="/alice/logs" />
              </div>
            </>
          </Card>
        </div>

        <Modal id="log-detail" title="Log Detail">
          <div class="space-y-4">
            <p class="text-base-content/60">Click a log row to view details</p>
          </div>
        </Modal>
      </>
    </Layout>
  );
}
