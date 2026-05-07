import { Layout } from '../layout';
import { Card } from '../components/card';

import type { OllamaModel, RunningModel } from '../../types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function StatusPage({
  healthy,
  models,
  runningModels,
}: {
  healthy: boolean;
  models: OllamaModel[];
  runningModels: RunningModel[];
}): JSX.Element {
  return (
    <Layout activeMenu="status" title="Status">
      <div class="space-y-6">
        <Card title="Ollama Connection" color={healthy ? 'success' : 'error'}>
          <div class="flex items-center gap-3">
            {healthy ? (
              <>
                <span class="text-success text-2xl">✓</span>
                <span class="text-success font-medium text-lg">Connected</span>
              </>
            ) : (
              <>
                <span class="text-error text-2xl">✕</span>
                <span class="text-error font-medium text-lg">Unreachable</span>
              </>
            )}
          </div>
        </Card>

        <Card title="Installed Models" color="info">
          {models.length === 0 ? (
            <p class="text-base-content/60">No models installed</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Modified At</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr>
                      <td class="font-mono">{model.name}</td>
                      <td>{formatBytes(model.size)}</td>
                      <td>{new Date(model.modified_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Running Models" color="primary">
          {runningModels.length === 0 ? (
            <p class="text-base-content/60">No running models</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Model</th>
                    <th>Expires At</th>
                    <th>VRAM</th>
                  </tr>
                </thead>
                <tbody>
                  {runningModels.map((rm) => (
                    <tr>
                      <td class="font-mono">{rm.name}</td>
                      <td class="font-mono">{rm.model}</td>
                      <td>{new Date(rm.expires_at).toLocaleString()}</td>
                      <td>{formatBytes(rm.size_vram)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
