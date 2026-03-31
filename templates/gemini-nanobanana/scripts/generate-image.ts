import { GoogleGenAI } from '@google/genai';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ChatPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type ChatMessage = { role: 'user' | 'model'; parts: ChatPart[] };
type GitHubFileTarget = { owner: string; repo: string; ref: string; path: string };
type PlannedImageConfig = {
  finalPrompt: string;
  imageConfig: {
    aspectRatio: string;
    imageSize: '512' | '1K' | '2K' | '4K';
    personGeneration?: 'PERSON_GENERATION_UNSPECIFIED' | 'ALLOW_ALL' | 'ALLOW_ADULT' | 'ALLOW_NONE';
  };
};

const IMAGE_CONFIG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['finalPrompt', 'imageConfig'],
  properties: {
    finalPrompt: {
      type: 'string',
      description: '最終用於圖片生成的完整提示詞，需綜合多輪對話與圖片上下文。',
    },
    imageConfig: {
      type: 'object',
      additionalProperties: false,
      required: ['aspectRatio', 'imageSize'],
      properties: {
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '1:4', '4:1', '1:8', '8:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
        },
        imageSize: {
          type: 'string',
          enum: ['512', '1K', '2K', '4K'],
        },
        personGeneration: {
          type: 'string',
          enum: ['PERSON_GENERATION_UNSPECIFIED', 'ALLOW_ALL', 'ALLOW_ADULT', 'ALLOW_NONE'],
          description: '控制是否允許生成人物；若不需要特別指定可省略此欄位。',
        },
      },
    },
  },
} as const;

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stripAnsi(text: unknown): string {
  return String(text ?? '').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function mimeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

function extensionToMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  request: Parameters<GoogleGenAI['models']['generateContent']>[0],
) {
  try {
    return await ai.models.generateContent(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('429')) throw error;
    await wait(1000);
    return await ai.models.generateContent(request);
  }
}

const TEMPLATE_ROOT = path.resolve(process.env.TEMPLATE_ROOT || process.cwd());

async function readUserPrompt(promptFilePath: string): Promise<string> {
  const userPrompt = normalizeText(await readFile(promptFilePath, 'utf8'));
  if (!userPrompt) throw new Error(`${promptFilePath} 內容為空，無法生成圖片。`);
  return userPrompt;
}

async function resolveContextJsonlPath(): Promise<string> {
  const contextJsonlFile = process.env.CONTEXT_JSONL_FILE;
  if (contextJsonlFile) {
    const absPath = path.resolve(contextJsonlFile);
    await readFile(absPath, 'utf8');
    return absPath;
  }

  const files = await readdir(process.cwd(), { withFileTypes: true });
  const jsonlFile = files.find((entry) => entry.isFile() && entry.name.endsWith('.jsonl'));
  if (!jsonlFile) throw new Error('找不到可用的上下文 jsonl 檔案（根目錄 *.jsonl）。');
  return path.resolve(jsonlFile.name);
}

async function readContextJsonl(contextPath: string): Promise<string> {
  const raw = await readFile(contextPath, 'utf8');
  const normalized = stripAnsi(raw).replace(/\r\n/g, '\n').trim();
  if (!normalized) throw new Error(`${contextPath} 內容為空，無法提供上下文。`);
  return normalized;
}

async function readSystemPrompt(): Promise<string> {
  const systemPromptFile = process.env.SYSTEM_PROMPT_FILE
    ? path.resolve(process.env.SYSTEM_PROMPT_FILE)
    : path.join(TEMPLATE_ROOT, 'SYSTEM.md');
  const systemPrompt = normalizeText(await readFile(systemPromptFile, 'utf8'));
  if (!systemPrompt) throw new Error(`${systemPromptFile} 內容為空，無法生成圖片。`);
  return systemPrompt;
}

function getContextJsonlLines(contextJsonl: string): string[] {
  return contextJsonl
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseContextRecord(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getMessageRole(line: string): string | null {
  const parsed = parseContextRecord(line);
  const role = parsed?.role;
  return typeof role === 'string' ? normalizeText(role).toLowerCase() : null;
}

function mapRole(role: string | null): 'user' | 'model' | null {
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'model';
  return null;
}

function getRecordText(record: Record<string, unknown>): string {
  const content = record.content;
  if (typeof content === 'string') {
    const normalized = normalizeText(content);
    if (normalized) return normalized;
  }

  return normalizeText(JSON.stringify(record));
}

async function buildAttachmentParts(record: Record<string, unknown>): Promise<ChatPart[]> {
  const attachments = Array.isArray(record.attachments) ? record.attachments : [];
  const parts: ChatPart[] = [];

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') continue;

    const item = attachment as Record<string, unknown>;
    if (item.type !== 'photo') continue;
    const fileTarget = resolveGitHubFileTarget(item);
    if (!fileTarget) continue;
    const { data, mimeType } = await fetchGitHubFileAsBase64(fileTarget, item);

    parts.push({
      inlineData: {
        mimeType,
        data,
      },
    });
  }

  return parts;
}

function resolveGitHubFileTarget(attachment: Record<string, unknown>): GitHubFileTarget | null {
  const htmlUrl = typeof attachment.github_html_url === 'string' ? normalizeText(attachment.github_html_url) : '';
  if (htmlUrl) {
    const parsed = parseGitHubHtmlUrl(htmlUrl);
    if (parsed) return parsed;
  }

  const repoPath = typeof attachment.github_repo_path === 'string' ? normalizeText(attachment.github_repo_path) : '';
  const repository = normalizeText(process.env.GITHUB_REPOSITORY);
  if (!repoPath || !repository.includes('/')) return null;

  const [owner, repo] = repository.split('/', 2);
  const ref = normalizeText(process.env.GITHUB_REF_NAME || process.env.ISSUE_BRANCH) || 'main';
  return { owner, repo, ref, path: repoPath };
}

function parseGitHubHtmlUrl(htmlUrl: string): GitHubFileTarget | null {
  try {
    const url = new URL(htmlUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname !== 'github.com' || parts.length < 5 || parts[2] !== 'blob') return null;

    const owner = parts[0] || '';
    const repo = parts[1] || '';
    const ref = parts[3] || '';
    const filePath = parts.slice(4).join('/');
    if (!owner || !repo || !ref || !filePath) return null;

    return { owner, repo, ref, path: filePath };
  } catch {
    return null;
  }
}

async function fetchGitHubFileAsBase64(
  target: GitHubFileTarget,
  attachment: Record<string, unknown>,
): Promise<{ data: string; mimeType: string }> {
  const token = normalizeText(process.env.GITHUB_TOKEN);
  if (!token) throw new Error('缺少 GITHUB_TOKEN，無法透過 GitHub REST API 讀取圖片附件。');

  const encodedPath = target.path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(target.ref)}`;
  const requestInit = {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  let response = await fetch(url, requestInit);
  if (response.status === 429) {
    await wait(1000);
    response = await fetch(url, requestInit);
  }

  if (!response.ok) {
    throw new Error(`GitHub API 讀取附件失敗 (${response.status})：${target.owner}/${target.repo}/${target.path}@${target.ref}`);
  }

  const payload = await response.json() as { content?: string; encoding?: string };
  const content = normalizeText(payload.content);
  if (!content) {
    throw new Error(`GitHub API 未回傳附件內容：${target.owner}/${target.repo}/${target.path}@${target.ref}`);
  }

  const normalizedBase64 = payload.encoding === 'base64'
    ? content.replace(/\s+/g, '')
    : Buffer.from(content, 'utf8').toString('base64');
  const mimeType = typeof attachment.mime_type === 'string' && normalizeText(attachment.mime_type)
    ? normalizeText(attachment.mime_type)
    : extensionToMimeType(target.path);

  return {
    data: normalizedBase64,
    mimeType,
  };
}

function parseMemoryLimit(value: string | undefined): number {
  const normalized = normalizeText(value);
  if (!normalized) return 20;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`MEMORY_LIMIT 必須是大於 0 的整數，收到：${value}`);
  }

  return parsed;
}

function selectContextJsonl(contextJsonl: string, memoryLimit: number): {
  selectedContextJsonl: string;
  selectedCount: number;
  selectedTurnCount: number;
  totalCount: number;
  totalTurnCount: number;
} {
  const lines = getContextJsonlLines(contextJsonl);
  const userTurnIndexes = lines.reduce<number[]>((indexes, line, index) => {
    if (getMessageRole(line) === 'user') indexes.push(index);
    return indexes;
  }, []);

  if (userTurnIndexes.length === 0) {
    const selectedLines = lines.slice(-memoryLimit);
    return {
      selectedContextJsonl: selectedLines.join('\n'),
      selectedCount: selectedLines.length,
      selectedTurnCount: selectedLines.length,
      totalCount: lines.length,
      totalTurnCount: lines.length,
    };
  }

  const startTurnIndex = Math.max(0, userTurnIndexes.length - memoryLimit);
  const startLineIndex = userTurnIndexes[startTurnIndex] ?? 0;
  const selectedLines = lines.slice(startLineIndex);

  return {
    selectedContextJsonl: selectedLines.join('\n'),
    selectedCount: selectedLines.length,
    selectedTurnCount: userTurnIndexes.length - startTurnIndex,
    totalCount: lines.length,
    totalTurnCount: userTurnIndexes.length,
  };
}

function buildConversationContents(params: {
  userPrompt: string;
  contextJsonl: string;
  memoryLimit: number;
}): Promise<ChatMessage[]> {
  const {
    selectedContextJsonl,
  } = selectContextJsonl(
    params.contextJsonl,
    params.memoryLimit,
  );
  const contextLines = getContextJsonlLines(selectedContextJsonl);
  const contents: ChatMessage[] = [];

  return (async () => {
    for (const line of contextLines) {
      const record = parseContextRecord(line);
      if (!record) continue;

      const role = mapRole(typeof record.role === 'string' ? normalizeText(record.role).toLowerCase() : null);
      if (!role) continue;

      const parts = await buildAttachmentParts(record);
      const text = getRecordText(record);
      if (text) {
        parts.push({ text });
      }
      if (parts.length === 0) continue;

      contents.push({
        role,
        parts,
      });
    }

    contents.push({
      role: 'user',
      parts: [{
        text: params.userPrompt,
      }],
    });

    return contents;
  })();
}

function buildPlanningContents(contents: ChatMessage[]): ChatMessage[] {
  return [
    ...contents,
    {
      role: 'user',
      parts: [{
        text: [
          '請根據以上多輪對話與圖片上下文，規劃本次圖片生成參數。',
          '請依照提供的 JSON Schema 輸出結果。',
          '不要輸出 schema 之外的欄位。',
        ].join('\n'),
      }],
    },
  ];
}

function parsePlannedImageConfig(responseText: string | undefined): PlannedImageConfig {
  const parsed = JSON.parse(normalizeText(responseText)) as PlannedImageConfig;
  const finalPrompt = normalizeText(parsed?.finalPrompt);
  const aspectRatio = normalizeText(parsed?.imageConfig?.aspectRatio);
  const imageSize = normalizeText(parsed?.imageConfig?.imageSize) as PlannedImageConfig['imageConfig']['imageSize'];
  const personGeneration = normalizeText(parsed?.imageConfig?.personGeneration) as PlannedImageConfig['imageConfig']['personGeneration'] | '';

  if (!finalPrompt) throw new Error('structured output 缺少 finalPrompt。');
  if (!aspectRatio) throw new Error('structured output 缺少 imageConfig.aspectRatio。');
  if (!imageSize) throw new Error('structured output 缺少 imageConfig.imageSize。');

  return {
    finalPrompt,
    imageConfig: {
      aspectRatio,
      imageSize,
      ...(personGeneration && personGeneration !== 'PERSON_GENERATION_UNSPECIFIED' ? { personGeneration } : {}),
    },
  };
}

async function main(): Promise<void> {
  const apiKey = normalizeText(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error('缺少 GEMINI_API_KEY');

  const promptFile = process.env.PROMPT_FILE;
  if (!promptFile) throw new Error('缺少 PROMPT_FILE 環境變數');

  const issueDir = process.env.ISSUE_DIR;
  if (!issueDir) throw new Error('缺少 ISSUE_DIR 環境變數');

  const namePrefix = normalizeText(process.env.NAME_PREFIX) || 'image';
  const model = normalizeText(process.env.GEMINI_NANOBANANA_MODEL || process.env.NANOBANANA_MODEL) || 'gemini-3-pro-image-preview';
  const memoryLimit = parseMemoryLimit(process.env.MEMORY_LIMIT);
  const userPrompt = await readUserPrompt(promptFile);
  const contextJsonlPath = await resolveContextJsonlPath();
  const contextJsonl = await readContextJsonl(contextJsonlPath);
  const systemPrompt = await readSystemPrompt();

  const ai = new GoogleGenAI({
    apiKey,
  });

  console.error(`已讀取使用者提示：${path.resolve(promptFile)}`);
  console.error(`已讀取上下文 jsonl：${contextJsonlPath}`);
  const contents = await buildConversationContents({ userPrompt, contextJsonl, memoryLimit });
  const planningContents = buildPlanningContents(contents);

  const planningResponse = await generateContentWithRetry(ai, {
    model,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseJsonSchema: IMAGE_CONFIG_SCHEMA,
      tools: [{ googleSearch: {} }],
    },
    contents: planningContents,
  });
  const planned = parsePlannedImageConfig(planningResponse.text);
  console.error(`已規劃 imageConfig：${JSON.stringify(planned.imageConfig)}`);

  const response = await generateContentWithRetry(ai, {
    model,
    config: {
      systemInstruction: systemPrompt,
      imageConfig: planned.imageConfig,
      responseModalities: ['IMAGE'],
      tools: [{ googleSearch: {} }],
    },
    contents: [
      ...contents,
      {
        role: 'user',
        parts: [{ text: planned.finalPrompt }],
      },
    ],
  });

  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];

  const imageParts: Array<{ data: string; mimeType: string }> = [];
  for (const part of parts) {
    if (part?.inlineData?.data) {
      imageParts.push({
        data: part.inlineData.data,
        mimeType: normalizeText(part.inlineData.mimeType) || 'image/png',
      });
    }
  }

  if (imageParts.length === 0) {
    throw new Error('Gemini response did not contain any image output.');
  }

  const resolvedIssueDir = path.resolve(issueDir);
  await mkdir(resolvedIssueDir, { recursive: true });

  let idx = 1;
  const savedFiles: string[] = [];
  for (const image of imageParts) {
    const extension = mimeToExtension(image.mimeType);
    const filePath = path.join(resolvedIssueDir, `${namePrefix}-${idx}${extension}`);
    await writeFile(filePath, Buffer.from(image.data, 'base64'));
    const relativePath = path.relative(process.cwd(), filePath);
    savedFiles.push(relativePath);
    console.log(`Saved: ${relativePath}`);
    idx += 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
