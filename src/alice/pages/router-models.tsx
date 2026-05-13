import { Layout } from '../layout';
import { Card } from '../components/card';

interface RouterModelRow {
  id: number;
  name: string;
  variant: string;
  base_url: string;
  model: string;
  api_key: string | null;
  options: string | null;
  created_at: number;
  updated_at: number;
}

function maskApiKey(key: string | null): string {
  if (!key) return '-';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export function RouterModelsPage({ models }: { models: RouterModelRow[] }): JSX.Element {
  return (
    <Layout activeMenu="router-models" title="Router Models">
      <div class="space-y-6">
        <Card title="Add Model" color="success">
          <form id="add-model-form" hx-post="/alice/router-models" hx-target="#model-result" hx-swap="innerHTML" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name *</span></label>
              <input type="text" name="name" placeholder="e.g. gpt-4o" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Variant</span></label>
              <select name="variant" class="select select-bordered">
                <option value="openai" selected>openai</option>
                <option value="ollama">ollama</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Base URL *</span></label>
              <input type="text" name="base_url" placeholder="https://api.openai.com/v1" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Model *</span></label>
              <input type="text" name="model" placeholder="gpt-4o" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">API Key</span></label>
              <input type="password" name="api_key" placeholder="sk-..." class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Options (JSON)</span></label>
              <textarea name="options" placeholder='{"temperature": 0.7}' class="textarea textarea-bordered font-mono" rows="2" />
            </div>
            <div class="form-control md:col-span-2">
              <button type="submit" class="btn btn-primary">Add Model</button>
            </div>
          </form>
          <div id="model-result" class="mt-4" />
        </Card>

        <Card title="Router Models" color="info">
          {models.length === 0 ? (
            <p class="text-base-content/60">No router models configured</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Variant</th>
                    <th>Base URL</th>
                    <th>Model</th>
                    <th>API Key</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr>
                      <td>{m.id}</td>
                      <td class="font-mono">{m.name}</td>
                      <td><span class="badge badge-sm">{m.variant}</span></td>
                      <td class="font-mono text-xs">{m.base_url}</td>
                      <td class="font-mono">{m.model}</td>
                      <td class="font-mono text-xs">{maskApiKey(m.api_key)}</td>
                      <td>
                        <button
                          class="btn btn-error btn-xs"
                          hx-delete={`/alice/router-models/${m.id}`}
                          hx-target="#model-result"
                          hx-swap="innerHTML"
                          hx-confirm="Delete model '{m.name}'?"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <script src="/alice/static/alice-models.js" />
    </Layout>
  );
}