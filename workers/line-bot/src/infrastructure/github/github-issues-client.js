async function parseJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function encodeGitRef(ref) {
  return encodeURIComponent(ref).replace(/%2F/g, '/');
}

function encodeRepoPath(path) {
  return encodeURIComponent(path).replace(/%2F/g, '/');
}

export function buildArtifactUrls(repo, branch, path) {
  const encodedBranch = encodeGitRef(branch);
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const htmlUrl = `https://github.com/${repo.owner}/${repo.repo}/blob/${encodedBranch}/${encodedPath}`;

  return {
    htmlUrl,
    rawUrl: `${htmlUrl}?raw=true`,
  };
}

function buildHeaders(config, initHeaders = {}) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
    'X-GitHub-Api-Version': config.apiVersion,
    ...initHeaders,
  };
}

function normalizeGitHubErrorMessage(message) {
  if (typeof message !== 'string') {
    return message;
  }

  if (message.includes('Resource not accessible by personal access token')) {
    return 'GitHub token lacks required permission. Media upload needs repository Contents: write.';
  }

  return message;
}

export async function githubRequestRaw(config, path, init) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: buildHeaders(config, init?.headers),
  });

  const data = await parseJson(response);

  return { response, data };
}

export async function githubRequest(config, path, init) {
  const { response, data } = await githubRequestRaw(config, path, init);

  if (!response.ok) {
    const message = normalizeGitHubErrorMessage(
      data?.message ||
        `GitHub API request failed with status ${response.status}`,
    );
    throw new Error(message);
  }

  return data;
}

export function createIssue(config, repo, issue) {
  return githubRequest(config, `/repos/${repo.owner}/${repo.repo}/issues`, {
    method: 'POST',
    body: JSON.stringify(issue),
  });
}

export function updateIssue(config, repo, issueNumber, issue) {
  return githubRequest(
    config,
    `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      body: JSON.stringify(issue),
    },
  );
}

export function createIssueComment(config, repo, issueNumber, body) {
  return githubRequest(
    config,
    `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
}

export function defaultLabelColor() {
  return '0366d6';
}

async function getLabel(config, repo, name) {
  const { response, data } = await githubRequestRaw(
    config,
    `/repos/${repo.owner}/${repo.repo}/labels/${encodeURIComponent(name)}`,
    { method: 'GET' },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = normalizeGitHubErrorMessage(
      data?.message ||
        `GitHub API request failed with status ${response.status}`,
    );
    throw new Error(message);
  }

  return data;
}

async function getRepositoryContent(config, repo, path, branch = null) {
  const params = new URLSearchParams();
  if (branch) {
    params.set('ref', branch);
  }

  const { response, data } = await githubRequestRaw(
    config,
    `/repos/${repo.owner}/${repo.repo}/contents/${encodeRepoPath(path)}${params.size > 0 ? `?${params.toString()}` : ''}`,
    { method: 'GET' },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = normalizeGitHubErrorMessage(
      data?.message ||
        `GitHub API request failed with status ${response.status}`,
    );
    throw new Error(message);
  }

  return data;
}

function getRepository(config, repo) {
  return githubRequest(config, `/repos/${repo.owner}/${repo.repo}`, {
    method: 'GET',
  });
}

async function getRef(config, repo, ref) {
  const { response, data } = await githubRequestRaw(
    config,
    `/repos/${repo.owner}/${repo.repo}/git/ref/${encodeGitRef(ref)}`,
    { method: 'GET' },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = normalizeGitHubErrorMessage(
      data?.message ||
        `GitHub API request failed with status ${response.status}`,
    );
    throw new Error(message);
  }

  return data;
}

async function createRef(config, repo, ref, sha) {
  return githubRequest(config, `/repos/${repo.owner}/${repo.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/${ref}`,
      sha,
    }),
  });
}

async function createLabel(config, repo, name, options = {}) {
  const resolveLabelColor =
    typeof options.resolveLabelColor === 'function'
      ? options.resolveLabelColor
      : defaultLabelColor;
  const description =
    typeof options.description === 'string' && options.description.trim() !== ''
      ? options.description.trim()
      : 'Auto-created by Worker';

  return githubRequest(config, `/repos/${repo.owner}/${repo.repo}/labels`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      color: resolveLabelColor(name),
      description,
    }),
  });
}

export async function ensureLabels(config, repo, labels, options = {}) {
  const uniqueLabels = [
    ...new Set(
      labels.filter(
        (label) => typeof label === 'string' && label.trim() !== '',
      ),
    ),
  ];

  for (const label of uniqueLabels) {
    const existing = await getLabel(config, repo, label);
    if (!existing) {
      await createLabel(config, repo, label, options);
    }
  }
}

async function createOrphanBranch(config, repo, branch) {
  const repoPath = `/repos/${repo.owner}/${repo.repo}`;

  // 1. 建立空 tree（含 .gitkeep 以避免完全空的 tree）
  const tree = await githubRequest(config, `${repoPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      tree: [{ path: '.gitkeep', mode: '100644', type: 'blob', content: '' }],
    }),
  });

  // 2. 建立 orphan commit（parents: [] 是關鍵）
  const commit = await githubRequest(config, `${repoPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `chore: initialize orphan branch ${branch}`,
      tree: tree.sha,
      parents: [],
    }),
  });

  // 3. 建立 ref 指向 orphan commit
  await createRef(config, repo, `heads/${branch}`, commit.sha);
  return commit.sha;
}

export async function ensureArtifactBranch(config, repo, branch) {
  const refName = `heads/${branch}`;
  const existing = await getRef(config, repo, refName);
  if (existing?.object?.sha) {
    return existing.object.sha;
  }

  return createOrphanBranch(config, repo, branch);
}

export async function findIssueBySourceKey(
  config,
  repo,
  sourceKey,
  options = {},
) {
  const markerLabel =
    typeof options.markerLabel === 'string' && options.markerLabel.trim() !== ''
      ? options.markerLabel.trim()
      : 'Source key';
  const marker = `${markerLabel}: ${sourceKey}`;
  const query = `repo:${repo.owner}/${repo.repo} is:issue in:body "${marker}"`;
  const data = await githubRequest(
    config,
    `/search/issues?q=${encodeURIComponent(query)}&per_page=1`,
    { method: 'GET' },
  );

  return Array.isArray(data?.items) && data.items.length > 0
    ? data.items[0]
    : null;
}

export async function uploadFileToRepo(config, repo, file) {
  await ensureArtifactBranch(config, repo, file.branch);

  const existing = await getRepositoryContent(
    config,
    repo,
    file.path,
    file.branch,
  );

  const payload = {
    message: file.commitMessage,
    content: bytesToBase64(file.bytes),
    branch: file.branch,
  };

  if (existing?.sha) {
    payload.sha = existing.sha;
  }

  const data = await githubRequest(
    config,
    `/repos/${repo.owner}/${repo.repo}/contents/${encodeRepoPath(file.path)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );

  const urls = buildArtifactUrls(repo, file.branch, file.path);

  return {
    branch: file.branch,
    path: data.content?.path || file.path,
    htmlUrl: urls.htmlUrl,
    rawUrl: urls.rawUrl,
    downloadUrl: urls.rawUrl,
    sha: data.content?.sha || existing?.sha || null,
  };
}

export function getIssue(config, repo, issueNumber) {
  return githubRequest(
    config,
    `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`,
    {
      method: 'GET',
    },
  );
}

export async function listIssueComments(
  config,
  repo,
  issueNumber,
  { since, perPage = 100 } = {},
) {
  const comments = [];
  const params = new URLSearchParams();
  params.set('per_page', String(perPage));
  if (since) {
    params.set('since', since.toISOString());
  }

  for (let page = 1; page <= 5; page += 1) {
    params.set('page', String(page));
    const data = await githubRequest(
      config,
      `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments?${params.toString()}`,
      { method: 'GET' },
    );

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    comments.push(...data);

    if (data.length < perPage) {
      break;
    }
  }

  return comments;
}
