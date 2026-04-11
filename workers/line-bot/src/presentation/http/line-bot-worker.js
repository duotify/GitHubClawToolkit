import { Hono } from 'hono';

import { getConfig, ConfigError } from '../../infrastructure/config/line-config.js';
import { getLineEvents, isValidLineSignature } from '../../infrastructure/line/line-api-client.js';
import { processEvent } from '../../application/line/event-processor.js';

const app = new Hono();

function buildStatusPayload(config) {
  return {
    ok: true,
    workerName: config.line.workerName,
    webhookPath: config.line.webhookPath,
    defaultRepo: config.github.repoFullName,
    issueBindingMode: config.line.issueBindingMode,
    targetIssueNumber: config.line.targetIssueNumber,
    targetIssueUrl: config.line.targetIssueUrl,
  };
}

app.use('*', async (c, next) => {
  try {
    c.set('config', getConfig(c.env));
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return c.json({ error: error.message }, 500);
    }

    throw error;
  }

  await next();
});

app.get('/', (c) => c.json(buildStatusPayload(c.get('config'))));
app.get('/health', (c) => c.json(buildStatusPayload(c.get('config'))));
app.get('/status', (c) => c.json(buildStatusPayload(c.get('config'))));

app.post('/line/webhook', async (c) => {
  const config = c.get('config');
  const bodyText = await c.req.text();

  if (!(await isValidLineSignature(c.req.raw, bodyText, config.line))) {
    return c.json({ error: 'Invalid LINE webhook signature.' }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return c.json({ error: 'Invalid JSON payload.' }, 400);
  }

  const events = getLineEvents(payload);
  if (events.length === 0) {
    return c.json({ ok: true, ignored: true });
  }

  c.executionCtx.waitUntil(
    Promise.all(
      events.map((event) =>
        processEvent(config, event).catch((error) => {
          console.error('LINE event processing failed', error, {
            webhookEventId: event?.webhookEventId,
            source: event?.source,
          });
        }),
      ),
    ),
  );

  return c.json({ ok: true, accepted: events.length });
});

app.notFound((c) => c.text('Not Found', 404));

export default app;
