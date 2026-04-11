import {
  createIssue,
  createIssueComment,
  getIssue,
  updateIssue,
  uploadFileToRepo,
} from '../../infrastructure/github/line-github-service.js';
import {
  claimSourceKey,
  findSourceIssue,
  bindSourceIssue,
  deleteSourceIssue,
  waitForSourceIssue,
} from '../../infrastructure/d1/source-issue-store.js';
import {
  canReplyToLineEvent,
  getLineMessageContent,
  getLineProfile,
  getLineSourceSummary,
  replyLineTextMessage,
} from '../../infrastructure/line/line-api-client.js';
import {
  buildIssueArtifactScope,
  buildMediaFileName,
  isIgnoredEvent,
  isMediaMessageEvent,
} from '../../domain/line/media.js';
import { buildSourceIssueDefinition } from '../../domain/line/issue-binding.js';
import { getSourceInfo } from '../../domain/line/source.js';
import { buildCommentBody } from '../../domain/line/issue-formatter.js';

function buildIssueUrl(repo, issueNumber) {
  return `https://github.com/${repo.owner}/${repo.repo}/issues/${issueNumber}`;
}

async function resolveLineProfileSafe(config, sourceInfo) {
  try {
    return await getLineProfile(config.line, sourceInfo);
  } catch (error) {
    console.warn('Failed to resolve LINE sender profile', {
      sourceKey: sourceInfo.key,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveLineSourceSummarySafe(config, sourceInfo) {
  try {
    return await getLineSourceSummary(config.line, sourceInfo);
  } catch (error) {
    console.warn('Failed to resolve LINE source summary', {
      sourceKey: sourceInfo.key,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveSourceContext(config, sourceInfo) {
  if (sourceInfo.type === 'user') {
    const profile = await resolveLineProfileSafe(config, sourceInfo);
    const displayName = profile?.displayName || null;

    return {
      senderName: displayName,
      sourceDisplayName: displayName,
    };
  }

  const [profile, summary] = await Promise.all([
    resolveLineProfileSafe(config, sourceInfo),
    resolveLineSourceSummarySafe(config, sourceInfo),
  ]);

  return {
    senderName: profile?.displayName || null,
    sourceDisplayName:
      summary?.groupName ||
      summary?.roomName ||
      summary?.displayName ||
      null,
  };
}

async function resolveTargetIssue(config, repo, sourceInfo, sourceContext) {
  if (Number.isInteger(config.line.targetIssueNumber)) {
    return {
      issueNumber: config.line.targetIssueNumber,
      issueUrl:
        config.line.targetIssueUrl ||
        buildIssueUrl(repo, config.line.targetIssueNumber),
      issueState: 'fixed',
    };
  }

  const db = config.db;
  if (!db) {
    throw new Error('D1 database binding (DB) is required for dynamic issue binding.');
  }

  const existing = await findSourceIssue(db, sourceInfo.key);
  if (existing?.status === 'ready' && existing.issue_number) {
    return {
      issueNumber: existing.issue_number,
      issueUrl: existing.issue_url || buildIssueUrl(repo, existing.issue_number),
      issueState: 'existing',
    };
  }

  const inserted = await claimSourceKey(db, sourceInfo.key);

  if (inserted) {
    return await createAndBindIssue(config, repo, sourceInfo, sourceContext);
  }

  // 沒搶到鎖，等別人建好
  const waited = await waitForSourceIssue(db, sourceInfo.key);

  if (waited?.status === 'ready' && waited.issue_number) {
    return {
      issueNumber: waited.issue_number,
      issueUrl: waited.issue_url || buildIssueUrl(repo, waited.issue_number),
      issueState: 'existing',
    };
  }

  throw new Error(`Timed out waiting for issue creation for source: ${sourceInfo.key}`);
}

async function createAndBindIssue(config, repo, sourceInfo, sourceContext) {
  const issueDefinition = buildSourceIssueDefinition(sourceInfo, sourceContext);

  const createdIssue = await createIssue(config.github, repo, {
    title: issueDefinition.title,
    body: issueDefinition.body,
  });

  const issueUrl = createdIssue.html_url || buildIssueUrl(repo, createdIssue.number);
  await bindSourceIssue(config.db, sourceInfo.key, createdIssue.number, issueUrl);

  return {
    issueNumber: createdIssue.number,
    issueUrl,
    issueState: 'created',
  };
}

async function syncSourceIssueTitle(config, repo, issueBinding, sourceInfo, sourceContext) {
  if (
    issueBinding.issueState === 'fixed' ||
    issueBinding.issueState === 'created' ||
    !Number.isInteger(issueBinding.issueNumber) ||
    !sourceContext?.sourceDisplayName
  ) {
    return;
  }

  const desiredTitle = buildSourceIssueDefinition(sourceInfo, sourceContext).title;
  const currentIssue = await getIssue(config.github, repo, issueBinding.issueNumber);
  if (currentIssue?.title === desiredTitle) {
    return;
  }

  await updateIssue(config.github, repo, issueBinding.issueNumber, {
    title: desiredTitle,
  });
}

async function persistMediaMessage(config, repo, issueNumber, event) {
  if (!issueNumber || !isMediaMessageEvent(event)) {
    return {
      mediaAsset: null,
      mediaError: null,
    };
  }

  try {
    const mediaContent = await getLineMessageContent(config.line, event);
    if (!mediaContent) {
      return {
        mediaAsset: null,
        mediaError: null,
      };
    }

    const bytes = new Uint8Array(mediaContent.arrayBuffer);
    const artifactScope = buildIssueArtifactScope(config, issueNumber);
    const fileName = buildMediaFileName(event, mediaContent);
    const path = artifactScope.directory
      ? `${artifactScope.directory}/${fileName}`
      : fileName;
    const upload = await uploadFileToRepo(config.github, repo, {
      branch: artifactScope.branch,
      path,
      bytes,
      commitMessage:
        `Store LINE ${event.message?.type || 'media'} message ${event.message?.id || event.webhookEventId || ''}`.trim(),
    });

    return {
      mediaAsset: {
        fileName: mediaContent.fileName || fileName,
        branch: upload.branch,
        directory: artifactScope.directory,
        path: upload.path,
        htmlUrl: upload.htmlUrl,
        rawUrl: upload.rawUrl,
        downloadUrl: upload.downloadUrl,
        contentType: mediaContent.contentType,
        size: mediaContent.contentLength,
        isImage:
          typeof mediaContent.contentType === 'string' &&
          mediaContent.contentType.startsWith('image/'),
        isVideo:
          typeof mediaContent.contentType === 'string' &&
          mediaContent.contentType.startsWith('video/'),
      },
      mediaError: null,
    };
  } catch (error) {
    return {
      mediaAsset: null,
      mediaError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function buildEventContext(
  config,
  repo,
  event,
  issueBinding,
  senderName = null,
) {
  const mediaResult = await persistMediaMessage(
    config,
    repo,
    issueBinding.issueNumber,
    event,
  );

  return {
    senderName,
    mediaAsset: mediaResult.mediaAsset,
    mediaError: mediaResult.mediaError,
    workerName: config.line.workerName,
    workerIssueNumber: issueBinding.issueNumber,
    workerIssueUrl: issueBinding.issueUrl,
    workerIssueState: issueBinding.issueState,
  };
}

async function maybeReplyWithDefaultMessage(config, event) {
  if (!canReplyToLineEvent(event)) {
    return null;
  }

  const replyText = config.assistant.defaultReplyText || null;
  if (!replyText) {
    return null;
  }

  await replyLineTextMessage(config.line, event.replyToken, replyText);
  return replyText;
}

function isIssueNotFoundError(error) {
  const msg = error?.message || '';
  return msg.includes('Not Found') || msg.includes('status 404') || msg.includes('status 410');
}

export async function processEvent(config, event) {
  const sourceInfo = getSourceInfo(event);
  const targetRepo = {
    owner: config.github.owner,
    repo: config.github.repo,
    repoFullName: config.github.repoFullName,
  };

  if (isIgnoredEvent(event)) {
    return { ignored: 'sticker-message' };
  }

  const sourceContext = await resolveSourceContext(config, sourceInfo);
  let issueBinding = await resolveTargetIssue(
    config,
    targetRepo,
    sourceInfo,
    sourceContext,
  );

  try {
    await syncSourceIssueTitle(config, targetRepo, issueBinding, sourceInfo, sourceContext);
  } catch (error) {
    console.warn('Failed to sync LINE source issue title', {
      issueNumber: issueBinding.issueNumber,
      sourceKey: sourceInfo.key,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  let eventContext = await buildEventContext(
    config,
    targetRepo,
    event,
    issueBinding,
    sourceContext.senderName,
  );

  // LINE 回覆失敗不影響 comment 寫入
  try {
    await maybeReplyWithDefaultMessage(config, event);
  } catch (error) {
    console.warn('LINE reply failed (non-blocking)', {
      webhookEventId: event?.webhookEventId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await createIssueComment(
      config.github,
      targetRepo,
      issueBinding.issueNumber,
      buildCommentBody(event, sourceInfo, eventContext),
    );
  } catch (error) {
    // Issue 被刪除了 → 清除 D1 紀錄，重新建立 Issue
    if (isIssueNotFoundError(error) && config.db) {
      console.warn('Issue not found, clearing D1 record and retrying', {
        issueNumber: issueBinding.issueNumber,
        sourceKey: sourceInfo.key,
      });
      await deleteSourceIssue(config.db, sourceInfo.key);
      issueBinding = await resolveTargetIssue(config, targetRepo, sourceInfo, sourceContext);
      eventContext = await buildEventContext(config, targetRepo, event, issueBinding, sourceContext.senderName);
      await createIssueComment(
        config.github,
        targetRepo,
        issueBinding.issueNumber,
        buildCommentBody(event, sourceInfo, eventContext),
      );
    } else {
      throw error;
    }
  }

  return {
    commented: true,
    issueNumber: issueBinding.issueNumber,
    issueUrl: issueBinding.issueUrl,
    issueState: issueBinding.issueState,
  };
}
