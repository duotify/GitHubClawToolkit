import test from 'node:test';
import assert from 'node:assert/strict';

import { ConfigError, getConfig } from '../src/config.js';

test('getConfig parses fixed worker issue settings', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
    GITHUB_OWNER: 'octo',
    GITHUB_REPO: 'fallback',
    ISSUE_NUMBER: '123',
  });

  assert.equal(config.github.repoFullName, 'octo/fallback');
  assert.equal(config.line.webhookPath, '/line/webhook');
  assert.equal(config.line.issueBindingMode, 'fixed');
  assert.equal(config.assistant.utcOffsetMinutes, 8 * 60);
  assert.equal(config.assistant.defaultReplyText, null);
  assert.equal(config.line.targetIssueNumber, 123);
  assert.equal(config.line.workerName, 'octo-fallback-line-bot-worker');
  assert.equal(config.line.targetIssueUrl, 'https://github.com/octo/fallback/issues/123');
});

test('getConfig tolerates quoted env values from dotenv-style deployment files', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: '"github-token"',
    LINE_CHANNEL_SECRET: '"line-secret"',
    LINE_CHANNEL_ACCESS_TOKEN: '"line-access-token"',
    GITHUB_OWNER: '"octo"',
    GITHUB_REPO: '"fallback"',
    ISSUE_NUMBER: '"123"',
  });

  assert.equal(config.github.repoFullName, 'octo/fallback');
  assert.equal(config.line.issueBindingMode, 'fixed');
  assert.equal(config.line.targetIssueNumber, 123);
  assert.equal(config.line.workerName, 'octo-fallback-line-bot-worker');
  assert.equal(config.assistant.defaultReplyText, null);
});

test('getConfig allows overriding fixed API defaults from vars', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
    GITHUB_OWNER: 'octo',
    GITHUB_REPO: 'fallback',
    ISSUE_NUMBER: '123',
    GITHUB_API_BASE_URL: 'https://example.github.local',
    GITHUB_API_VERSION: '2099-01-01',
    LINE_API_BASE_URL: 'https://example.line.local',
    LINE_DATA_API_BASE_URL: 'https://example-data.line.local',
    LINE_WEBHOOK_PATH: '/webhooks/line',
  });

  assert.equal(config.github.apiBaseUrl, 'https://example.github.local');
  assert.equal(config.github.apiVersion, '2099-01-01');
  assert.equal(config.line.apiBaseUrl, 'https://example.line.local');
  assert.equal(config.line.dataApiBaseUrl, 'https://example-data.line.local');
  assert.equal(config.line.webhookPath, '/webhooks/line');
});

test('getConfig reads the optional default LINE reply message', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
    GITHUB_OWNER: 'octo',
    GITHUB_REPO: 'fallback',
    LINE_DEFAULT_REPLY_MESSAGE: '"已收到訊息，稍後回覆你。"',
  });

  assert.equal(config.line.issueBindingMode, 'dynamic-by-source');
  assert.equal(config.line.targetIssueNumber, null);
  assert.equal(
    config.assistant.defaultReplyText,
    '已收到訊息，稍後回覆你。',
  );
});

test('getConfig normalizes the derived worker name for workers.dev compatibility', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
    GITHUB_OWNER: 'octo',
    GITHUB_REPO: 'fallback.bot_v2',
  });

  assert.equal(config.line.workerName, 'octo-fallback-bot-v2-line-bot-worker');
});

test('getConfig allows dynamic issue binding when ISSUE_NUMBER is omitted', () => {
  const config = getConfig({
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    GITHUB_OWNER: 'octo',
    GITHUB_REPO: 'fallback',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
  });

  assert.equal(config.line.issueBindingMode, 'dynamic-by-source');
  assert.equal(config.line.targetIssueNumber, null);
  assert.equal(config.line.targetIssueUrl, null);
});

test('getConfig rejects invalid ISSUE_NUMBER values', () => {
  assert.throws(
    () =>
      getConfig({
        CLAW_SYS_GITHUB_TOKEN: 'github-token',
        GITHUB_OWNER: 'octo',
        GITHUB_REPO: 'fallback',
        LINE_CHANNEL_SECRET: 'line-secret',
        LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
        ISSUE_NUMBER: 'abc',
      }),
    (error) =>
      error instanceof ConfigError
      && /ISSUE_NUMBER/.test(error.message),
  );
});

test('getConfig rejects an overlong derived worker name', () => {
  assert.throws(
    () =>
      getConfig({
        CLAW_SYS_GITHUB_TOKEN: 'github-token',
        GITHUB_OWNER: 'o'.repeat(30),
        GITHUB_REPO: 'r'.repeat(30),
        LINE_CHANNEL_SECRET: 'line-secret',
        LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
      }),
    (error) =>
      error instanceof ConfigError
      && /63 個字元/.test(error.message),
  );
});

test('getConfig requires a fixed GitHub repo', () => {
  assert.throws(
    () =>
      getConfig({
        CLAW_SYS_GITHUB_TOKEN: 'github-token',
        LINE_CHANNEL_SECRET: 'line-secret',
        LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
        ISSUE_NUMBER: '123',
      }),
    (error) =>
      error instanceof ConfigError
      && /GITHUB_OWNER and GITHUB_REPO are required/.test(error.message),
  );
});
