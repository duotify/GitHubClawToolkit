const CONTENT_TYPE_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/rtf': 'rtf',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'text/plain': 'txt',
};

export function sanitizePathSegment(value) {
  return (
    String(value || 'unknown')
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function extensionFromFileName(fileName) {
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    return null;
  }

  const segments = fileName.trim().split('.');
  return segments.length > 1
    ? sanitizePathSegment(segments.pop().toLowerCase())
    : null;
}

function extensionFromContentType(contentType) {
  if (typeof contentType !== 'string' || contentType.trim() === '') {
    return 'bin';
  }

  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return (
    CONTENT_TYPE_EXTENSION_MAP[normalized] ||
    sanitizePathSegment(normalized.split('/').pop() || 'bin')
  );
}

export function buildMediaFileName(event, mediaContent) {
  const baseName = sanitizePathSegment(
    event?.message?.id || event?.webhookEventId || Date.now(),
  );
  const extension =
    extensionFromFileName(mediaContent?.fileName) ||
    extensionFromContentType(mediaContent?.contentType);
  return `${baseName}.${extension}`;
}

export function isMediaMessageEvent(event) {
  return (
    event?.type === 'message' &&
    ['image', 'audio', 'video', 'file'].includes(event?.message?.type)
  );
}

export function isIgnoredEvent(event) {
  return event?.type === 'message' && event?.message?.type === 'sticker';
}

export function buildIssueArtifactScope(config, issueNumber) {
  return {
    branch: `issue-${issueNumber}`,
    directory: 'line',
  };
}
