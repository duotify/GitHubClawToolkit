import { spawnSync } from 'node:child_process';

import { requireCloudflareWorkerName } from '../src/infrastructure/config/worker-name.js';

const wranglerArgs = process.argv.slice(2);
const rawWorkerName = process.env.WORKER_NAME;

if (typeof rawWorkerName !== 'string' || rawWorkerName.trim() === '') {
  console.error('Missing required environment variable: WORKER_NAME');
  process.exit(1);
}

if (wranglerArgs.length === 0) {
  console.error('Missing Wrangler arguments.');
  process.exit(1);
}

let normalizedWorkerName;

try {
  const result = requireCloudflareWorkerName(rawWorkerName, {
    label: 'WORKER_NAME',
    workersDev: true,
  });
  normalizedWorkerName = result.normalizedValue;

  if (result.changed) {
    console.error(
      `Worker 名稱已正規化：${JSON.stringify(rawWorkerName)} -> ${JSON.stringify(normalizedWorkerName)}`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const bunxCommand = process.platform === 'win32' ? 'bunx.cmd' : 'bunx';
const commandResult = spawnSync(
  bunxCommand,
  ['wrangler', ...wranglerArgs, '--name', normalizedWorkerName],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      WORKER_NAME: normalizedWorkerName,
    },
  },
);

if (commandResult.error) {
  console.error(commandResult.error.message);
  process.exit(1);
}

process.exit(commandResult.status ?? 1);

