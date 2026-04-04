import { getAssistantConfigFromEnv } from '../../domain/shared/assistant-core.js';
import {
  optionalString,
  parseDefaultGitHub,
  requireString,
} from './source-rules.js';
import { requireCloudflareWorkerName } from './worker-name.js';

const DEFAULT_GH_API_BASE_URL = 'https://api.github.com';
const DEFAULT_LINE_API_BASE_URL = 'https://api.line.me';
const DEFAULT_LINE_DATA_API_BASE_URL = 'https://api-data.line.me';
const LINE_WEBHOOK_PATH = '/line/webhook';
const GITHUB_API_VERSION = '2022-11-28';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function createAssistantConfig(env) {
  return getAssistantConfigFromEnv(env, {
    utcOffsetKey: 'DEFAULT_UTC_OFFSET',
    defaultReplyTextKey: 'LINE_DEFAULT_REPLY_MESSAGE',
    defaultUtcOffsetMinutes: 8 * 60,
  });
}

function getOptionalConfig(env, key, fallback) {
  return optionalString(env, key) || fallback;
}

function parseOptionalPositiveInteger(env, keys, createError) {
  const candidateKeys = Array.isArray(keys) ? keys : [keys];

  for (const key of candidateKeys) {
    const rawValue = optionalString(env, key);
    if (!rawValue) {
      continue;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw createError(
        `Invalid environment variable: ${key} must be a positive integer.`,
      );
    }

    return parsedValue;
  }

  return null;
}

export function getConfig(env) {
  const createError = (message) => new ConfigError(message);
  const defaultGithub = parseDefaultGitHub(env, { createError });

  if (!defaultGithub) {
    throw createError(
      'GITHUB_OWNER and GITHUB_REPO are required for LINEBotWorker.',
    );
  }

  const targetIssueNumber = parseOptionalPositiveInteger(
    env,
    'ISSUE_NUMBER',
    createError,
  );
  const derivedWorkerName = `${defaultGithub.owner}-${defaultGithub.repo}-line-bot-worker`;

  let workerName;
  try {
    workerName = requireCloudflareWorkerName(derivedWorkerName, {
      label: 'derived LINEBotWorker name',
      workersDev: true,
    }).normalizedValue;
  } catch (error) {
    throw createError(error.message);
  }

  return {
    github: {
      owner: defaultGithub.owner,
      repo: defaultGithub.repo,
      repoFullName: defaultGithub.repoFullName,
      token: requireString(env, 'CLAW_SYS_GITHUB_TOKEN', { createError }),
      apiBaseUrl: getOptionalConfig(
        env,
        'GITHUB_API_BASE_URL',
        DEFAULT_GH_API_BASE_URL,
      ),
      apiVersion: getOptionalConfig(
        env,
        'GITHUB_API_VERSION',
        GITHUB_API_VERSION,
      ),
    },
    line: {
      channelSecret: requireString(env, 'LINE_CHANNEL_SECRET', { createError }),
      channelAccessToken: requireString(env, 'LINE_CHANNEL_ACCESS_TOKEN', {
        createError,
      }),
      apiBaseUrl: getOptionalConfig(
        env,
        'LINE_API_BASE_URL',
        DEFAULT_LINE_API_BASE_URL,
      ),
      dataApiBaseUrl: getOptionalConfig(
        env,
        'LINE_DATA_API_BASE_URL',
        DEFAULT_LINE_DATA_API_BASE_URL,
      ),
      webhookPath: getOptionalConfig(env, 'LINE_WEBHOOK_PATH', LINE_WEBHOOK_PATH),
      issueBindingMode: targetIssueNumber ? 'fixed' : 'dynamic-by-source',
      targetIssueNumber,
      targetIssueUrl: targetIssueNumber
        ? `https://github.com/${defaultGithub.owner}/${defaultGithub.repo}/issues/${targetIssueNumber}`
        : null,
      workerName,
    },
    assistant: createAssistantConfig(env),
  };
}
