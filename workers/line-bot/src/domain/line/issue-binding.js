function normalizeInlineText(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized === '' ? fallback : normalized;
}

function buildSourceTitle(sourceInfo, context = {}) {
  if (sourceInfo.type === 'user') {
    const displayName = normalizeInlineText(context.sourceDisplayName, 'Unknown User');
    const userId = sourceInfo.userId || 'unknown-user';
    return `[LINE][user] ${displayName} (${userId})`;
  }

  if (sourceInfo.type === 'group') {
    const groupName = normalizeInlineText(context.sourceDisplayName, 'Unknown Group');
    const groupId = sourceInfo.groupId || 'unknown-group';
    return `[LINE][group] ${groupName} (${groupId})`;
  }

  if (sourceInfo.type === 'room') {
    const roomName = normalizeInlineText(context.sourceDisplayName, 'Unknown Room');
    const roomId = sourceInfo.roomId || 'unknown-room';
    return `[LINE][room] ${roomName} (${roomId})`;
  }

  return `[LINE][${sourceInfo.type || 'unknown'}] ${sourceInfo.key}`;
}

export function buildSourceIssueDefinition(sourceInfo, context = {}) {
  return {
    title: buildSourceTitle(sourceInfo, context),
    body: [
      '# LINE Source Binding',
      '',
      'This issue is automatically managed by the LINEBotWorker.',
      '',
      `- Source type: ${sourceInfo.type}`,
      `- Source key: ${sourceInfo.key}`,
      sourceInfo.userId ? `- User ID: ${sourceInfo.userId}` : null,
      sourceInfo.groupId ? `- Group ID: ${sourceInfo.groupId}` : null,
      sourceInfo.roomId ? `- Room ID: ${sourceInfo.roomId}` : null,
      context.sourceDisplayName
        ? `- Source display name: ${normalizeInlineText(context.sourceDisplayName, '')}`
        : null,
      '',
      'Reinstalling the worker should reuse this issue when the source key matches.',
    ].filter(Boolean).join('\n'),
    labels: ['linebotworker'],
  };
}
