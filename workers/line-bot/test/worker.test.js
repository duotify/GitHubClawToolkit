import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { buildLineSignature } from '../src/line.js';

const DEFAULT_OWNER = 'octo';
const DEFAULT_REPO = 'fallback';
const DEFAULT_ISSUE_NUMBER = 501;
const DEFAULT_REPO_FULL_NAME = `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
const DEFAULT_ISSUE_URL = `https://github.com/${DEFAULT_REPO_FULL_NAME}/issues/${DEFAULT_ISSUE_NUMBER}`;

function createMockD1(initialRows = []) {
  const rows = new Map();
  for (const row of initialRows) {
    rows.set(row.source_key, { ...row });
  }

  function createStatement(sql, params = []) {
    return {
      bind(...args) {
        return createStatement(sql, args);
      },
      async first() {
        const key = params[0];
        return rows.get(key) || null;
      },
      async run() {
        if (sql.startsWith('INSERT OR IGNORE')) {
          const key = params[0];
          if (rows.has(key)) {
            return { meta: { changes: 0 } };
          }
          rows.set(key, {
            source_key: key,
            status: params[1],
            issue_number: null,
            issue_url: null,
            created_at: params[2],
            updated_at: params[3],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith('UPDATE')) {
          const key = params[4];
          const row = rows.get(key);
          if (row) {
            row.status = params[0];
            row.issue_number = params[1];
            row.issue_url = params[2];
            row.updated_at = params[3];
          }
          return { meta: { changes: row ? 1 : 0 } };
        }
        if (sql.startsWith('DELETE')) {
          const key = params[0];
          const had = rows.has(key);
          rows.delete(key);
          return { meta: { changes: had ? 1 : 0 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }

  return { prepare: (sql) => createStatement(sql) };
}

function createEnv(overrides = {}) {
  return {
    CLAW_SYS_GITHUB_TOKEN: 'github-token',
    GITHUB_OWNER: DEFAULT_OWNER,
    GITHUB_REPO: DEFAULT_REPO,
    ISSUE_NUMBER: String(DEFAULT_ISSUE_NUMBER),
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token',
    ...overrides,
  };
}

function createContext() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(promise);
    },
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function notFoundResponse() {
  return jsonResponse(404, { message: 'Not Found' });
}

function binaryResponse(contentType, bodyText, extraHeaders = {}) {
  return new Response(bodyText, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(new TextEncoder().encode(bodyText).byteLength),
      ...extraHeaders,
    },
  });
}

function isLineProfileUrl(url) {
  return /https:\/\/api\.line\.me\/v2\/bot\/(profile|group|room)\//.test(
    String(url),
  );
}

function isLineGroupSummaryUrl(url) {
  return /https:\/\/api\.line\.me\/v2\/bot\/group\/[^/]+\/summary$/.test(
    String(url),
  );
}

function isLineReplyUrl(url) {
  return String(url) === 'https://api.line.me/v2/bot/message/reply';
}

function issueCreateUrl(repoFullName = DEFAULT_REPO_FULL_NAME) {
  return `https://api.github.com/repos/${repoFullName}/issues`;
}

function issueCommentUrl(
  issueNumber = DEFAULT_ISSUE_NUMBER,
  repoFullName = DEFAULT_REPO_FULL_NAME,
) {
  return `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`;
}

function issueUrl(
  issueNumber = DEFAULT_ISSUE_NUMBER,
  repoFullName = DEFAULT_REPO_FULL_NAME,
) {
  return `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`;
}

function repositoryUrl(repoFullName = DEFAULT_REPO_FULL_NAME) {
  return `https://api.github.com/repos/${repoFullName}`;
}

function issueBranchRefUrl(
  issueNumber = DEFAULT_ISSUE_NUMBER,
  repoFullName = DEFAULT_REPO_FULL_NAME,
) {
  return `https://api.github.com/repos/${repoFullName}/git/ref/heads/issue-${issueNumber}`;
}

function defaultBranchRefUrl(
  repoFullName = DEFAULT_REPO_FULL_NAME,
  branch = 'main',
) {
  return `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`;
}

function issueContentUrl(path, repoFullName = DEFAULT_REPO_FULL_NAME) {
  return `https://api.github.com/repos/${repoFullName}/contents/${path}`;
}

function issueWorkspacePath(fileName, issueNumber = DEFAULT_ISSUE_NUMBER) {
  return `workspaces/issue-${issueNumber}/line/${fileName}`;
}

function repoLabelUrl(name, repoFullName = DEFAULT_REPO_FULL_NAME) {
  return `https://api.github.com/repos/${repoFullName}/labels/${encodeURIComponent(name)}`;
}

function repoLabelsUrl(repoFullName = DEFAULT_REPO_FULL_NAME) {
  return `https://api.github.com/repos/${repoFullName}/labels`;
}

async function createSignedRequest(path, payload, envOverrides = {}) {
  const env = createEnv(envOverrides);
  const body = JSON.stringify(payload);
  const signature = await buildLineSignature(env.LINE_CHANNEL_SECRET, body);

  return {
    env,
    request: new Request(`https://example.com${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signature,
      },
      body,
    }),
  };
}

function installFetchStub(handler) {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function createArtifactUploadResponder({
  issueNumber = DEFAULT_ISSUE_NUMBER,
  repoFullName = DEFAULT_REPO_FULL_NAME,
  path,
  commitMessage,
  putResponsePath = path,
  baseSha = `main-sha-${issueNumber}`,
}) {
  return (url, init = {}) => {
    const requestUrl = String(url);

    if (requestUrl === issueBranchRefUrl(issueNumber, repoFullName)) {
      return notFoundResponse();
    }

    if (requestUrl === repositoryUrl(repoFullName)) {
      return jsonResponse(200, { default_branch: 'main' });
    }

    if (requestUrl === defaultBranchRefUrl(repoFullName)) {
      return jsonResponse(200, {
        object: {
          sha: baseSha,
        },
      });
    }

    if (
      requestUrl === `${repositoryUrl(repoFullName)}/git/refs` &&
      init.method === 'POST'
    ) {
      return jsonResponse(201, {
        ref: `refs/heads/issue-${issueNumber}`,
        object: {
          sha: baseSha,
        },
      });
    }

    if (
      requestUrl ===
      `${issueContentUrl(path, repoFullName)}?ref=issue-${issueNumber}`
    ) {
      return notFoundResponse();
    }

    if (
      requestUrl === issueContentUrl(path, repoFullName) &&
      init.method === 'PUT'
    ) {
      const payload = JSON.parse(init.body);
      assert.equal(payload.branch, `issue-${issueNumber}`);
      if (commitMessage) {
        assert.equal(payload.message, commitMessage);
      }

      return jsonResponse(201, {
        content: {
          path: putResponsePath,
          sha: `sha-${issueNumber}-${path}`,
        },
      });
    }

    return null;
  };
}

test('health endpoint returns fixed LINEBotWorker metadata', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/health'),
    createEnv(),
    createContext(),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.webhookPath, '/line/webhook');
  assert.equal(payload.defaultRepo, DEFAULT_REPO_FULL_NAME);
  assert.equal(payload.issueBindingMode, 'fixed');
  assert.equal(payload.workerName, 'octo-fallback-line-bot-worker');
  assert.equal(payload.targetIssueNumber, DEFAULT_ISSUE_NUMBER);
  assert.equal(payload.targetIssueUrl, DEFAULT_ISSUE_URL);
});

test('status endpoint shows which GitHub issue the worker is bound to', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/status'),
    createEnv(),
    createContext(),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.issueBindingMode, 'fixed');
  assert.equal(payload.workerName, 'octo-fallback-line-bot-worker');
  assert.equal(payload.targetIssueNumber, DEFAULT_ISSUE_NUMBER);
  assert.equal(payload.targetIssueUrl, DEFAULT_ISSUE_URL);
});

test('status endpoint shows dynamic issue binding when ISSUE_NUMBER is omitted', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/status'),
    createEnv({
      ISSUE_NUMBER: undefined,
    }),
    createContext(),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.issueBindingMode, 'dynamic-by-source');
  assert.equal(payload.workerName, 'octo-fallback-line-bot-worker');
  assert.equal(payload.targetIssueNumber, null);
  assert.equal(payload.targetIssueUrl, null);
});

test('webhook rejects invalid LINE signature', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/line/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'invalid',
      },
      body: JSON.stringify({ events: [] }),
    }),
    createEnv(),
    createContext(),
  );

  assert.equal(response.status, 401);
});

test('sticker message is ignored and does not comment on the worker issue', async () => {
  const fetchStub = installFetchStub(async (url) => {
    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'message',
          webhookEventId: 'event-sticker-1',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: 'Usticker123',
          },
          message: {
            id: 'sticker-1',
            type: 'sticker',
            packageId: '1',
            stickerId: '1',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);
    assert.equal(fetchStub.calls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

test('group text message comments on the fixed deployment issue with source metadata', async () => {
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Alice' });
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 901,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-901`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'message',
          webhookEventId: 'event-group-1',
          timestamp: 1_710_000_000_000,
          source: {
            type: 'group',
            groupId: 'Cgroup123',
            userId: 'Ualice',
          },
          message: {
            id: '987654321',
            type: 'text',
            text: 'LINE group bug report\nThe service is down.',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(),
    );
    assert.ok(commentCall);

    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(commentPayload.body, /^<!-- line-meta: /);
    assert.match(commentPayload.body, /## LINE text message/);
    assert.match(commentPayload.body, /- Worker name: octo-fallback-line-bot-worker/);
    assert.match(
      commentPayload.body,
      /- Worker issue: #501 \(https:\/\/github\.com\/octo\/fallback\/issues\/501\)/,
    );
    assert.match(commentPayload.body, /- LINE origin: group:Cgroup123/);
    assert.match(commentPayload.body, /- Source type: group/);
    assert.match(commentPayload.body, /- Group ID: Cgroup123/);
    assert.match(commentPayload.body, /- User ID: Ualice/);
    assert.match(commentPayload.body, /- Sender: Alice/);
    assert.match(commentPayload.body, /> LINE group bug report/);
    assert.match(commentPayload.body, /> The service is down\./);
    assert.match(commentPayload.body, /"source":"line"/);
    assert.match(commentPayload.body, /"source_key":"group:Cgroup123"/);
    assert.match(commentPayload.body, /"msg_id":"987654321"/);
  } finally {
    fetchStub.restore();
  }
});

test('direct user message also comments on the fixed deployment issue', async () => {
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Charlie' });
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 902,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-902`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'message',
          webhookEventId: 'event-user-1',
          timestamp: 1_710_000_100_000,
          source: {
            type: 'user',
            userId: 'Udirect123',
          },
          message: {
            id: 'message-user-1',
            type: 'text',
            text: 'Direct message report',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(),
    );
    assert.ok(commentCall);

    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(commentPayload.body, /- LINE origin: user:Udirect123/);
    assert.match(commentPayload.body, /- Source type: user/);
    assert.match(commentPayload.body, /- User ID: Udirect123/);
    assert.match(commentPayload.body, /- Sender: Charlie/);
    assert.match(commentPayload.body, /> Direct message report/);
  } finally {
    fetchStub.restore();
  }
});

test('direct user message reuses the existing source issue when ISSUE_NUMBER is omitted', async () => {
  const dynamicIssueNumber = 612;
  const dynamicIssueUrl = `https://github.com/${DEFAULT_REPO_FULL_NAME}/issues/${dynamicIssueNumber}`;
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Charlie' });
    }

    if (String(url) === issueUrl(dynamicIssueNumber) && init.method === 'GET') {
      return jsonResponse(200, {
        number: dynamicIssueNumber,
        title: '[LINE][user] Charlie (Udirect123)',
        html_url: dynamicIssueUrl,
      });
    }

    if (String(url) === issueCommentUrl(dynamicIssueNumber) && init.method === 'POST') {
      return jsonResponse(201, {
        id: 1902,
        html_url: `${dynamicIssueUrl}#issuecomment-1902`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const mockDB = createMockD1([
      {
        source_key: 'user:Udirect123',
        status: 'ready',
        issue_number: dynamicIssueNumber,
        issue_url: dynamicIssueUrl,
      },
    ]);
    const { env, request } = await createSignedRequest(
      '/line/webhook',
      {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-user-dynamic-1',
            timestamp: 1_710_000_100_000,
            source: {
              type: 'user',
              userId: 'Udirect123',
            },
            message: {
              id: 'message-user-dynamic-1',
              type: 'text',
              text: 'Dynamic direct message report',
            },
          },
        ],
      },
      {
        ISSUE_NUMBER: undefined,
        DB: mockDB,
      },
    );

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(dynamicIssueNumber),
    );
    assert.ok(commentCall);

    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(
      commentPayload.body,
      /- Worker issue: #612 \(https:\/\/github\.com\/octo\/fallback\/issues\/612\)/,
    );
    assert.match(commentPayload.body, /- LINE origin: user:Udirect123/);

    const createIssueCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCreateUrl() && call.init.method === 'POST',
    );
    assert.equal(createIssueCall, undefined);
  } finally {
    fetchStub.restore();
  }
});

test('group message creates a unique source issue when ISSUE_NUMBER is omitted', async () => {
  const dynamicIssueNumber = 620;
  const dynamicIssueUrl = `https://github.com/${DEFAULT_REPO_FULL_NAME}/issues/${dynamicIssueNumber}`;
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineGroupSummaryUrl(url)) {
      return jsonResponse(200, { groupName: 'Support Squad' });
    }

    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Alice' });
    }

    if (
      [repoLabelUrl('linebotworker')].includes(String(url)) &&
      init.method === 'GET'
    ) {
      return notFoundResponse();
    }

    if (String(url) === repoLabelsUrl() && init.method === 'POST') {
      const payload = JSON.parse(init.body);
      return jsonResponse(201, payload);
    }

    if (String(url) === issueCreateUrl() && init.method === 'POST') {
      const payload = JSON.parse(init.body);
      assert.match(payload.title, /^\[LINE\]\[group\] Support Squad \(Cgroup999\)$/);
      assert.match(payload.body, /- Source type: group/);
      assert.match(payload.body, /- Source key: group:Cgroup999/);
      assert.match(payload.body, /- Group ID: Cgroup999/);
      assert.match(payload.body, /- Source display name: Support Squad/);
      assert.deepEqual(payload.labels, ['linebotworker']);

      return jsonResponse(201, {
        number: dynamicIssueNumber,
        html_url: dynamicIssueUrl,
      });
    }

    if (String(url) === issueCommentUrl(dynamicIssueNumber) && init.method === 'POST') {
      return jsonResponse(201, {
        id: 1903,
        html_url: `${dynamicIssueUrl}#issuecomment-1903`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const mockDB = createMockD1();
    const { env, request } = await createSignedRequest(
      '/line/webhook',
      {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-group-dynamic-1',
            timestamp: 1_710_000_000_000,
            source: {
              type: 'group',
              groupId: 'Cgroup999',
              userId: 'Ualice',
            },
            message: {
              id: '987654322',
              type: 'text',
              text: 'Dynamic LINE group bug report',
            },
          },
        ],
      },
      {
        ISSUE_NUMBER: undefined,
        DB: mockDB,
      },
    );

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(dynamicIssueNumber),
    );
    assert.ok(commentCall);

    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(
      commentPayload.body,
      /- Worker issue: #620 \(https:\/\/github\.com\/octo\/fallback\/issues\/620\)/,
    );
    assert.match(commentPayload.body, /- Group ID: Cgroup999/);
    assert.match(commentPayload.body, /- Sender: Alice/);
  } finally {
    fetchStub.restore();
  }
});

test('group message updates the existing dynamic issue title when the group name changes', async () => {
  const dynamicIssueNumber = 621;
  const dynamicIssueUrl = `https://github.com/${DEFAULT_REPO_FULL_NAME}/issues/${dynamicIssueNumber}`;
  const oldTitle = '[LINE][group] Support Squad (Cgroup999)';
  const newTitle = '[LINE][group] Renamed Squad (Cgroup999)';
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineGroupSummaryUrl(url)) {
      return jsonResponse(200, { groupName: 'Renamed Squad' });
    }

    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Alice' });
    }

    if (String(url) === issueUrl(dynamicIssueNumber) && init.method === 'GET') {
      return jsonResponse(200, {
        number: dynamicIssueNumber,
        title: oldTitle,
        html_url: dynamicIssueUrl,
      });
    }

    if (String(url) === issueUrl(dynamicIssueNumber) && init.method === 'PATCH') {
      const payload = JSON.parse(init.body);
      assert.equal(payload.title, newTitle);
      return jsonResponse(200, {
        number: dynamicIssueNumber,
        title: payload.title,
        html_url: dynamicIssueUrl,
      });
    }

    if (String(url) === issueCommentUrl(dynamicIssueNumber) && init.method === 'POST') {
      return jsonResponse(201, {
        id: 1904,
        html_url: `${dynamicIssueUrl}#issuecomment-1904`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const mockDB = createMockD1([
      {
        source_key: 'group:Cgroup999',
        status: 'ready',
        issue_number: dynamicIssueNumber,
        issue_url: dynamicIssueUrl,
      },
    ]);
    const { env, request } = await createSignedRequest(
      '/line/webhook',
      {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-group-dynamic-rename-1',
            timestamp: 1_710_000_010_000,
            source: {
              type: 'group',
              groupId: 'Cgroup999',
              userId: 'Ualice',
            },
            message: {
              id: '987654323',
              type: 'text',
              text: 'Title sync check',
            },
          },
        ],
      },
      {
        ISSUE_NUMBER: undefined,
        DB: mockDB,
      },
    );

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const updateIssueCall = fetchStub.calls.find(
      (call) => String(call.url) === issueUrl(dynamicIssueNumber) && call.init.method === 'PATCH',
    );
    assert.ok(updateIssueCall);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(dynamicIssueNumber),
    );
    assert.ok(commentCall);
  } finally {
    fetchStub.restore();
  }
});

test('follow event comments on the fixed deployment issue', async () => {
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'New Friend' });
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 903,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-903`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'follow',
          webhookEventId: 'event-follow-1',
          timestamp: 1_710_000_300_000,
          source: {
            type: 'user',
            userId: 'Ufollow123',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(),
    );
    assert.ok(commentCall);

    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(commentPayload.body, /## LINE follow event/);
    assert.match(commentPayload.body, /- Sender: New Friend/);
    assert.match(commentPayload.body, /- LINE origin: user:Ufollow123/);
    assert.match(
      commentPayload.body,
      /The user followed this LINE Official Account\./,
    );
  } finally {
    fetchStub.restore();
  }
});

test('image message uploads media to the fixed issue branch and comments with preview', async () => {
  const respondArtifactUpload = createArtifactUploadResponder({
    path: issueWorkspacePath('image-55.png'),
    commitMessage: 'Store LINE image message image-55',
  });
  const fetchStub = installFetchStub(async (url, init = {}) => {
    const artifactResponse = respondArtifactUpload(url, init);
    if (artifactResponse) {
      return artifactResponse;
    }

    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Image Creator' });
    }

    if (String(url).endsWith('/content')) {
      return binaryResponse('image/png', 'fake-image-binary');
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 904,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-904`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'message',
          webhookEventId: 'event-image-55',
          timestamp: Date.UTC(2024, 2, 9, 12, 0, 0),
          source: {
            type: 'user',
            userId: 'Uimage55',
          },
          message: {
            id: 'image-55',
            type: 'image',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(),
    );
    assert.ok(commentCall);
    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(commentPayload.body, /- Issue branch: `issue-501`/);
    assert.match(
      commentPayload.body,
      /- Repo path: `workspaces\/issue-501\/line\/image-55\.png`/,
    );
    assert.match(
      commentPayload.body,
      /blob\/issue-501\/workspaces\/issue-501\/line\/image-55\.png\?raw=true/,
    );
    assert.match(
      commentPayload.body,
      /!\[image-55\.png\]\(https:\/\/github\.com\/octo\/fallback\/blob\/issue-501\/workspaces\/issue-501\/line\/image-55\.png\?raw=true\)/,
    );

    const uploadCall = fetchStub.calls.find(
      (call) =>
        String(call.url) ===
          issueContentUrl(issueWorkspacePath('image-55.png')) &&
        call.init.method === 'PUT',
    );
    assert.ok(uploadCall);
  } finally {
    fetchStub.restore();
  }
});

test('audio, video, and file uploads use the fixed issue branch and comment on the same issue', async (t) => {
  await t.test('audio upload', async () => {
    const respondArtifactUpload = createArtifactUploadResponder({
      path: issueWorkspacePath('audio-1.mp3'),
      commitMessage: 'Store LINE audio message audio-1',
    });
    const fetchStub = installFetchStub(async (url, init = {}) => {
      const artifactResponse = respondArtifactUpload(url, init);
      if (artifactResponse) {
        return artifactResponse;
      }

      if (isLineProfileUrl(url)) {
        return jsonResponse(200, { displayName: 'Audio User' });
      }

      if (String(url).includes('/content/transcoding')) {
        return jsonResponse(200, { status: 'succeeded' });
      }

      if (String(url).endsWith('/content')) {
        return binaryResponse('audio/mpeg', 'fake-audio-binary');
      }

      if (String(url) === issueCommentUrl() && init.method === 'POST') {
        return jsonResponse(201, {
          id: 905,
          html_url: `${DEFAULT_ISSUE_URL}#issuecomment-905`,
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    try {
      const ctx = createContext();
      const { env, request } = await createSignedRequest('/line/webhook', {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-audio-1',
            timestamp: Date.UTC(2024, 2, 9, 12, 0, 0),
            source: {
              type: 'user',
              userId: 'Uaudio123',
            },
            message: {
              id: 'audio-1',
              type: 'audio',
              duration: 1234,
            },
          },
        ],
      });

      const response = await worker.fetch(request, env, ctx);
      assert.equal(response.status, 200);

      await Promise.all(ctx.promises);

      const commentCall = fetchStub.calls.find(
        (call) => String(call.url) === issueCommentUrl(),
      );
      assert.ok(commentCall);
      const commentPayload = JSON.parse(commentCall.init.body);
      assert.match(commentPayload.body, /## LINE audio message/);
      assert.match(commentPayload.body, /audio-1\.mp3/);
      assert.match(commentPayload.body, /Issue branch: `issue-501`/);
      assert.match(
        commentPayload.body,
        /Repo path: `workspaces\/issue-501\/line\/audio-1\.mp3`/,
      );
    } finally {
      fetchStub.restore();
    }
  });

  await t.test('video upload', async () => {
    const respondArtifactUpload = createArtifactUploadResponder({
      path: issueWorkspacePath('video-1.mp4'),
      commitMessage: 'Store LINE video message video-1',
    });
    const fetchStub = installFetchStub(async (url, init = {}) => {
      const artifactResponse = respondArtifactUpload(url, init);
      if (artifactResponse) {
        return artifactResponse;
      }

      if (isLineProfileUrl(url)) {
        return jsonResponse(200, { displayName: 'Victor' });
      }

      if (String(url).includes('/content/transcoding')) {
        return jsonResponse(200, { status: 'succeeded' });
      }

      if (String(url).endsWith('/content')) {
        return binaryResponse('video/mp4', 'fake-video-binary');
      }

      if (String(url) === issueCommentUrl() && init.method === 'POST') {
        return jsonResponse(201, {
          id: 906,
          html_url: `${DEFAULT_ISSUE_URL}#issuecomment-906`,
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    try {
      const ctx = createContext();
      const { env, request } = await createSignedRequest('/line/webhook', {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-video-1',
            timestamp: 1_710_000_450_000,
            source: {
              type: 'user',
              userId: 'Uvideo123',
            },
            message: {
              id: 'video-1',
              type: 'video',
              duration: 4_500,
            },
          },
        ],
      });

      const response = await worker.fetch(request, env, ctx);
      assert.equal(response.status, 200);

      await Promise.all(ctx.promises);

      const commentCall = fetchStub.calls.find(
        (call) => String(call.url) === issueCommentUrl(),
      );
      assert.ok(commentCall);
      const commentPayload = JSON.parse(commentCall.init.body);
      assert.match(commentPayload.body, /## LINE video message/);
      assert.match(commentPayload.body, /video-1\.mp4/);
      assert.match(commentPayload.body, /Issue branch: `issue-501`/);
      assert.match(
        commentPayload.body,
        /Repo path: `workspaces\/issue-501\/line\/video-1\.mp4`/,
      );
      assert.match(
        commentPayload.body,
        /<video src="https:\/\/github\.com\/octo\/fallback\/blob\/issue-501\/workspaces\/issue-501\/line\/video-1\.mp4\?raw=true"/,
      );
    } finally {
      fetchStub.restore();
    }
  });

  await t.test('file upload keeps stored filename metadata', async () => {
    const respondTextArtifactUpload = createArtifactUploadResponder({
      path: issueWorkspacePath('file-1.txt'),
      commitMessage: 'Store LINE file message file-1',
    });
    const textFetchStub = installFetchStub(async (url, init = {}) => {
      const artifactResponse = respondTextArtifactUpload(url, init);
      if (artifactResponse) {
        return artifactResponse;
      }

      if (isLineProfileUrl(url)) {
        return jsonResponse(200, { displayName: 'File User' });
      }

      if (String(url).endsWith('/content')) {
        return binaryResponse('text/plain', 'todo 1\ntodo 2');
      }

      if (String(url) === issueCommentUrl() && init.method === 'POST') {
        return jsonResponse(201, {
          id: 907,
          html_url: `${DEFAULT_ISSUE_URL}#issuecomment-907`,
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    try {
      const ctx = createContext();
      const { env, request } = await createSignedRequest('/line/webhook', {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-file-1',
            timestamp: Date.UTC(2024, 2, 9, 12, 0, 0),
            source: {
              type: 'user',
              userId: 'Ufile123',
            },
            message: {
              id: 'file-1',
              type: 'file',
              fileName: 'notes.txt',
              fileSize: 13,
            },
          },
        ],
      });

      const response = await worker.fetch(request, env, ctx);
      assert.equal(response.status, 200);

      await Promise.all(ctx.promises);

      const commentCall = textFetchStub.calls.find(
        (call) => String(call.url) === issueCommentUrl(),
      );
      assert.ok(commentCall);
      const commentPayload = JSON.parse(commentCall.init.body);
      assert.match(commentPayload.body, /Stored file: \[notes\.txt\]/);
      assert.match(commentPayload.body, /Issue branch: `issue-501`/);
      assert.match(
        commentPayload.body,
        /Repo path: `workspaces\/issue-501\/line\/file-1\.txt`/,
      );
    } finally {
      textFetchStub.restore();
    }

    const respondWordArtifactUpload = createArtifactUploadResponder({
      path: issueWorkspacePath('word-1.docx'),
      commitMessage: 'Store LINE file message word-1',
    });
    const wordFetchStub = installFetchStub(async (url, init = {}) => {
      const artifactResponse = respondWordArtifactUpload(url, init);
      if (artifactResponse) {
        return artifactResponse;
      }

      if (isLineProfileUrl(url)) {
        return jsonResponse(200, { displayName: 'Dora' });
      }

      if (String(url).endsWith('/content')) {
        return binaryResponse(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'fake-docx-binary',
          {
            'Content-Disposition': 'attachment; filename="meeting-notes.docx"',
          },
        );
      }

      if (String(url) === issueCommentUrl() && init.method === 'POST') {
        return jsonResponse(201, {
          id: 908,
          html_url: `${DEFAULT_ISSUE_URL}#issuecomment-908`,
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    try {
      const ctx = createContext();
      const { env, request } = await createSignedRequest('/line/webhook', {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-word-1',
            timestamp: 1_710_000_550_000,
            source: {
              type: 'user',
              userId: 'Uword123',
            },
            message: {
              id: 'word-1',
              type: 'file',
              fileSize: 16,
            },
          },
        ],
      });

      const response = await worker.fetch(request, env, ctx);
      assert.equal(response.status, 200);

      await Promise.all(ctx.promises);

      const commentCall = wordFetchStub.calls.find(
        (call) => String(call.url) === issueCommentUrl(),
      );
      assert.ok(commentCall);
      const commentPayload = JSON.parse(commentCall.init.body);
      assert.match(commentPayload.body, /Stored file: \[meeting-notes\.docx\]/);
      assert.match(
        commentPayload.body,
        /Repo path: `workspaces\/issue-501\/line\/word-1\.docx`/,
      );
      assert.match(commentPayload.body, /Issue branch: `issue-501`/);
    } finally {
      wordFetchStub.restore();
    }
  });
});

test('worker uses configured default reply message for replyable events', async () => {
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Mention User' });
    }

    if (isLineReplyUrl(url)) {
      return jsonResponse(200, {});
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 910,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-910`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest(
      '/line/webhook',
      {
        events: [
          {
            type: 'message',
            webhookEventId: 'event-canned-1',
            timestamp: Date.now(),
            replyToken: 'reply-token-canned-1',
            source: {
              type: 'user',
              userId: 'Ucanned1',
            },
            message: {
              id: 'canned-msg-1',
              type: 'text',
              text: '你在嗎',
            },
          },
        ],
      },
      {
        LINE_DEFAULT_REPLY_MESSAGE: '這是 LINE Bot 的預設回應訊息',
      },
    );

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const replyCall = fetchStub.calls.find((call) => isLineReplyUrl(call.url));
    assert.ok(replyCall);

    const replyPayload = JSON.parse(replyCall.init.body);
    assert.equal(
      replyPayload.messages[0].text,
      '這是 LINE Bot 的預設回應訊息',
    );
  } finally {
    fetchStub.restore();
  }
});

test('image upload permission error becomes a readable comment on the fixed issue', async () => {
  const fetchStub = installFetchStub(async (url, init = {}) => {
    if (isLineProfileUrl(url)) {
      return jsonResponse(200, { displayName: 'Image User' });
    }

    if (String(url).endsWith('/content')) {
      return binaryResponse('image/png', 'fake-image-binary');
    }

    if (String(url) === issueBranchRefUrl()) {
      return notFoundResponse();
    }

    if (String(url) === repositoryUrl()) {
      return jsonResponse(200, { default_branch: 'main' });
    }

    if (String(url) === defaultBranchRefUrl()) {
      return jsonResponse(200, {
        object: {
          sha: 'main-sha-99',
        },
      });
    }

    if (
      String(url) === `${repositoryUrl()}/git/refs` &&
      init.method === 'POST'
    ) {
      return jsonResponse(201, {
        ref: 'refs/heads/issue-501',
        object: {
          sha: 'main-sha-99',
        },
      });
    }

    if (
      String(url) ===
      `${issueContentUrl(issueWorkspacePath('image-large-1.png'))}?ref=issue-501`
    ) {
      return notFoundResponse();
    }

    if (
      String(url) === issueContentUrl(issueWorkspacePath('image-large-1.png'))
    ) {
      return new Response(
        JSON.stringify({
          message: 'Resource not accessible by personal access token',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (String(url) === issueCommentUrl() && init.method === 'POST') {
      return jsonResponse(201, {
        id: 910,
        html_url: `${DEFAULT_ISSUE_URL}#issuecomment-910`,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const ctx = createContext();
    const { env, request } = await createSignedRequest('/line/webhook', {
      events: [
        {
          type: 'message',
          webhookEventId: 'event-image-err-1',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: 'Uimageerr1',
          },
          message: {
            id: 'image-large-1',
            type: 'image',
          },
        },
      ],
    });

    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 200);

    await Promise.all(ctx.promises);

    const commentCall = fetchStub.calls.find(
      (call) => String(call.url) === issueCommentUrl(),
    );
    assert.ok(commentCall);
    const commentPayload = JSON.parse(commentCall.init.body);
    assert.match(
      commentPayload.body,
      /Media storage error: GitHub token lacks required permission\. Media upload needs repository Contents: write\./,
    );
  } finally {
    fetchStub.restore();
  }
});
