import { Layout } from '../layout';
import { Card } from '../components/card';
import { Field } from '../components/field';

export type MaskedConfig = {
  port: number;
  apiKey: string;
  ollamaUrl: string;
  logLevel: string;
  logFile: string;
  dbFile: string;
};

export function ConfigPage({ config }: { config: MaskedConfig }): JSX.Element {
  return (
    <Layout activeMenu="config" title="Configuration">
      <div class="space-y-6">
        <Card title="Gateway Configuration" color="info">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Port" value={String(config.port)} />
            <Field label="Ollama URL" value={config.ollamaUrl} />
            <Field label="API Key" value={config.apiKey} />
            <Field label="Log Level" value={config.logLevel} />
            <Field label="Log File" value={config.logFile} />
            <Field label="DB File" value={config.dbFile} />
          </div>
        </Card>
      </div>
    </Layout>
  );
}
