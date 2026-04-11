const POLL_INTERVAL_MS = 500;
const MAX_POLL_RETRIES = 60;

function nowMs() {
  return Date.now();
}

export async function findSourceIssue(db, sourceKey) {
  const row = await db
    .prepare('SELECT source_key, status, issue_number, issue_url FROM source_issues WHERE source_key = ?')
    .bind(sourceKey)
    .first();
  return row || null;
}

export async function claimSourceKey(db, sourceKey) {
  const now = nowMs();

  const result = await db
    .prepare(
      'INSERT OR IGNORE INTO source_issues (source_key, status, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    .bind(sourceKey, 'creating', now, now)
    .run();

  return result.meta?.changes === 1;
}

export async function bindSourceIssue(db, sourceKey, issueNumber, issueUrl) {
  await db
    .prepare(
      'UPDATE source_issues SET status = ?, issue_number = ?, issue_url = ?, updated_at = ? WHERE source_key = ?',
    )
    .bind('ready', issueNumber, issueUrl, nowMs(), sourceKey)
    .run();
}

export async function deleteSourceIssue(db, sourceKey) {
  await db
    .prepare('DELETE FROM source_issues WHERE source_key = ?')
    .bind(sourceKey)
    .run();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSourceIssue(db, sourceKey, maxRetries = MAX_POLL_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    await sleep(POLL_INTERVAL_MS);

    const row = await findSourceIssue(db, sourceKey);
    if (!row) {
      return null;
    }

    if (row.status === 'ready' && row.issue_number) {
      return row;
    }
  }

  return null;
}
