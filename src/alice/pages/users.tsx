import { Layout } from '../layout';
import { Card } from '../components/card';

interface AdminWithUsername {
  user_id: number;
  username: string;
  promoted_at: number;
}

export function UsersPage({ admins }: { admins: AdminWithUsername[] }): JSX.Element {
  return (
    <Layout activeMenu="users" title="Users">
      <div class="space-y-6">
        <Card title="Administrators" color="warning">
          <p class="text-sm text-base-content/70 mb-4">
            Users with admin privileges can access the Alice dashboard and manage all resources.
          </p>
          {admins.length === 0 ? (
            <p class="text-base-content/60">No administrators found</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Promoted At</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr>
                      <td>{admin.user_id}</td>
                      <td class="font-mono">{admin.username}</td>
                      <td>{new Date(admin.promoted_at * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Promote User to Admin" color="primary">
          <form hx-post="/alice/users/promote" hx-target="#promote-result" hx-swap="innerHTML" class="flex gap-4 items-end">
            <div class="form-control flex-1">
              <label class="label">
                <span class="label-text">User ID</span>
              </label>
              <input type="number" name="user_id" placeholder="Enter user ID" class="input input-bordered w-full" required />
            </div>
            <button type="submit" class="btn btn-primary">Promote</button>
          </form>
          <div id="promote-result" class="mt-4" />
        </Card>
      </div>

      <script src="/alice/static/alice-users.js" />
    </Layout>
  );
}