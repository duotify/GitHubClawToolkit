import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCloudflareWorkerName,
  requireCloudflareWorkerName,
} from '../src/infrastructure/config/worker-name.js';

test('normalizeCloudflareWorkerName replaces invalid characters and trims edge dashes', () => {
  const result = normalizeCloudflareWorkerName('  Repo.Name__v2  ');

  assert.equal(result.normalizedValue, 'Repo-Name-v2');
  assert.equal(result.changed, true);
  assert.deepEqual(result.errors, []);
});

test('normalizeCloudflareWorkerName collapses repeated dashes', () => {
  const result = normalizeCloudflareWorkerName('foo---bar___baz');

  assert.equal(result.normalizedValue, 'foo-bar-baz');
  assert.deepEqual(result.errors, []);
});

test('requireCloudflareWorkerName rejects empty names after normalization', () => {
  assert.throws(
    () => requireCloudflareWorkerName('---___---'),
    /正規化後為空值/,
  );
});

test('requireCloudflareWorkerName rejects overlong workers.dev names', () => {
  assert.throws(
    () => requireCloudflareWorkerName('a'.repeat(64), { workersDev: true }),
    /63 個字元/,
  );
});

