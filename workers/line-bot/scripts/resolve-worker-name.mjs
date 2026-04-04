import { requireCloudflareWorkerName } from '../src/infrastructure/config/worker-name.js';

const rawWorkerName = process.argv[2] ?? process.env.WORKER_NAME;

if (typeof rawWorkerName !== 'string' || rawWorkerName.trim() === '') {
  console.error('Missing required worker name input.');
  process.exit(1);
}

try {
  const result = requireCloudflareWorkerName(rawWorkerName, {
    label: 'WORKER_NAME',
    workersDev: true,
  });

  if (result.changed) {
    console.error(
      `Worker 名稱已正規化：${JSON.stringify(rawWorkerName)} -> ${JSON.stringify(result.normalizedValue)}`,
    );
  }

  process.stdout.write(result.normalizedValue);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

