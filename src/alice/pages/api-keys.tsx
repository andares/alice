import { Layout } from '../layout';
import { Card } from '../components/card';

interface ApiKeyRow {
  id: number;
  key_prefix: string;
  description: string | null;
  created_at: number;
  is_active: number;
}

export function ApiKeysPage({ keys }: { keys: ApiKeyRow[] }): JSX.Element {
  return (
    <Layout activeMenu="api-keys" title="API Keys">
      <div class="space-y-6">
        <Card title="Create New Key" color="success">
          <form hx-post="/alice/api-keys" hx-target="#key-result" hx-swap="innerHTML" class="flex gap-4 items-end">
            <div class="form-control flex-1">
              <label class="label">
                <span class="label-text">Description (optional)</span>
              </label>
              <input type="text" name="description" placeholder="e.g. Production key" class="input input-bordered w-full" />
            </div>
            <button type="submit" class="btn btn-primary">Create Key</button>
          </form>
          <div id="key-result" class="mt-4" />
        </Card>

        <Card title="API Keys" color="info">
          {keys.length === 0 ? (
            <p class="text-base-content/60">No API keys found</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Prefix</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr>
                      <td>{key.id}</td>
                      <td class="font-mono">{key.key_prefix}***</td>
                      <td>{key.description ?? '-'}</td>
                      <td>{new Date(key.created_at * 1000).toLocaleString()}</td>
                      <td>
                        {key.is_active ? (
                          <span class="badge badge-success badge-sm">Active</span>
                        ) : (
                          <span class="badge badge-error badge-sm">Inactive</span>
                        )}
                      </td>
                      <td class="flex gap-2">
                        {key.is_active ? (
                          <button
                            class="btn btn-warning btn-xs"
                            hx-post={`/alice/api-keys/${key.id}/deactivate`}
                            hx-target="#key-result"
                            hx-swap="innerHTML"
                          >
                            Deactivate
                          </button>
                        ) : null}
                        <button
                          class="btn btn-error btn-xs"
                          hx-delete={`/alice/api-keys/${key.id}`}
                          hx-target="#key-result"
                          hx-swap="innerHTML"
                          hx-confirm="Are you sure you want to delete this key?"
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

      <script src="/alice/static/alice-keys.js" />
    </Layout>
  );
}