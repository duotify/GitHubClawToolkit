const WORKERS_DEV_MAX_NAME_LENGTH = 63;
const GENERAL_MAX_NAME_LENGTH = 255;
const ALLOWED_WORKER_NAME_PATTERN = /^[a-z0-9-]+$/;

function sanitizeCloudflareWorkerName(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  return rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateCloudflareWorkerName(value, { workersDev = true } = {}) {
  const errors = [];
  const maxLength = workersDev
    ? WORKERS_DEV_MAX_NAME_LENGTH
    : GENERAL_MAX_NAME_LENGTH;

  if (value.length === 0) {
    errors.push('名稱在正規化後為空值。');
    return errors;
  }

  if (!ALLOWED_WORKER_NAME_PATTERN.test(value)) {
    errors.push('名稱只能包含英數字元與連字號 `-`。');
  }

  if (value.startsWith('-') || value.endsWith('-')) {
    errors.push('名稱不能以連字號 `-` 開頭或結尾。');
  }

  if (value.length > maxLength) {
    errors.push(
      workersDev
        ? `啟用 \`workers.dev\` 時名稱長度不得超過 ${WORKERS_DEV_MAX_NAME_LENGTH} 個字元。`
        : `名稱長度不得超過 ${GENERAL_MAX_NAME_LENGTH} 個字元。`,
    );
  }

  return errors;
}

export function normalizeCloudflareWorkerName(rawValue, options = {}) {
  const normalizedValue = sanitizeCloudflareWorkerName(rawValue);
  return {
    originalValue: rawValue,
    normalizedValue,
    changed: normalizedValue !== (typeof rawValue === 'string' ? rawValue.trim() : ''),
    errors: validateCloudflareWorkerName(normalizedValue, options),
  };
}

export function requireCloudflareWorkerName(
  rawValue,
  { label = 'WORKER_NAME', workersDev = true } = {},
) {
  const result = normalizeCloudflareWorkerName(rawValue, { workersDev });

  if (result.errors.length > 0) {
    const details = result.errors.map((error) => `- ${error}`).join('\n');
    throw new Error(
      `${label} 無法轉成有效的 Cloudflare Worker 名稱。\n原始值：${JSON.stringify(rawValue)}\n正規化後：${JSON.stringify(result.normalizedValue)}\n${details}`,
    );
  }

  return result;
}

