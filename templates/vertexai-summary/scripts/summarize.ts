import { GoogleGenAI } from '@google/genai';
import _Readability from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Readability = _Readability.default ?? _Readability;

const MODELS = {
  text: 'gemini-2.5-flash',
  url: 'gemini-2.5-flash',
  pdf: 'gemini-2.5-flash',
  video: 'gemini-2.5-flash',
  audio: 'gemini-2.5-flash',
} as const;

const MAX_CONTENT_LENGTH = 120_000;
const MIN_CONTENT_LENGTH = 200;
const FETCH_TIMEOUT_MS = 30_000;

const VIDEO_EXTENSIONS = new Set(['.3gp', '.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.ogv', '.webm']);
const VIDEO_MIME_TYPES: Record<string, string> = {
  '.3gp': 'video/3gpp',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm',
};
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.aiff', '.wma', '.opus']);
const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aiff': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',
};

const TEMPLATE_ROOT = path.resolve(process.env.TEMPLATE_ROOT || process.cwd());

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

async function readUserPrompt(promptFilePath: string): Promise<string> {
  const userPrompt = normalizeText(await readFile(promptFilePath, 'utf8'));
  if (!userPrompt) throw new Error(`${promptFilePath} 內容為空，無法摘要。`);
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
  return readFile(systemPromptFile, 'utf8');
}

function resolveInputFromUserPrompt(userPrompt: string): { type: 'remote' | 'local' | 'text'; value: string } {
  const normalized = normalizeText(userPrompt);
  if (!normalized) throw new Error('最新使用者留言內容為空，無法摘要。');

  const urlMatches = normalized.match(/https?:\/\/[^\s)]+/g) || [];
  const withoutUrls = normalizeText(normalized.replace(/https?:\/\/[^\s)]+/g, ' '));
  if (urlMatches.length === 1 && !withoutUrls) {
    return { type: 'remote', value: urlMatches[0] };
  }

  if (/^(file:\/\/\S+|\.{0,2}\/\S+|\/\S+)$/.test(normalized)) {
    return { type: 'local', value: normalized };
  }

  return { type: 'text', value: normalized };
}

function trimContent(value: string, max = MAX_CONTENT_LENGTH): { text: string; truncated: boolean } {
  const text = normalizeText(value);
  return text.length <= max
    ? { text, truncated: false }
    : { text: `${text.slice(0, max)}\n\n[內容因長度限制已截斷]`, truncated: true };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') {
      throw new Error(`抓取逾時（${FETCH_TIMEOUT_MS / 1000}秒）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function detectInputType(input: string): 'text' | 'url' | 'pdf' | 'video' | 'audio' {
  if (!input) throw new Error('請提供輸入（URL 或檔案路徑）。');
  if (input.startsWith('data:')) return 'video';

  if (isRemoteUrl(input)) {
    try {
      const url = new URL(input);
      const pathname = url.pathname.toLowerCase();
      if (pathname.endsWith('.pdf')) return 'pdf';
      const ext = path.extname(pathname);
      if (VIDEO_EXTENSIONS.has(ext)) return 'video';
      if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
      if (YOUTUBE_HOSTS.has(url.hostname)) return 'video';
      return 'url';
    } catch {
      return 'url';
    }
  }

  let local = input;
  if (input.startsWith('file://')) local = fileURLToPath(input);
  const ext = path.extname(local).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  throw new Error(`無法辨識輸入類型：${input}`);
}

function buildPrompt(params: {
  sourceType: string;
  sourceMeta: Record<string, string>;
  userPrompt: string;
  contextJsonl: string;
  content?: string;
  truncated?: boolean;
}): string {
  const metaLines = Object.entries(params.sourceMeta)
    .map(([key, value]) => `- ${key}：${value || '未提供'}`)
    .join('\n');

  const contentBlock = params.content
    ? `\n原始內容：\n"""\n${params.content}\n"""`
    : '';

  const truncationLine = typeof params.truncated === 'boolean'
    ? `\n- 內容是否截斷：${params.truncated ? '是' : '否'}`
    : '';

  return [
    '使用者需求（user.md）：',
    '"""',
    params.userPrompt,
    '"""',
    '',
    '上下文（jsonl）：',
    '"""',
    params.contextJsonl,
    '"""',
    '',
    '本次任務資訊：',
    `- 來源類型：${params.sourceType}`,
    metaLines || '- 其他資訊：未提供',
    truncationLine,
    contentBlock,
  ].join('\n');
}

type PromptContext = {
  userPrompt: string;
  contextJsonl: string;
};

async function generateTextSummary(input: string, ai: GoogleGenAI, systemPrompt: string, promptContext: PromptContext): Promise<string> {
  const { text, truncated } = trimContent(input);
  if (!text) throw new Error('使用者輸入內容為空，無法摘要。');

  const result = await ai.models.generateContent({
    model: MODELS.text,
    config: {
      systemInstruction: systemPrompt.trim(),
    },
    contents: [{
      role: 'user',
      parts: [{
        text: buildPrompt({
          sourceType: '使用者輸入',
          sourceMeta: {},
          userPrompt: promptContext.userPrompt,
          contextJsonl: promptContext.contextJsonl,
          content: text,
          truncated,
        }),
      }],
    }],
  });

  return result.text ?? '';
}

async function generateUrlSummary(input: string, ai: GoogleGenAI, systemPrompt: string, promptContext: PromptContext): Promise<string> {
  const url = new URL(input).toString();
  console.error(`正在抓取網址：${url}`);

  const response = await fetchWithTimeout(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'GitHubClawDev/summary (+https://github.com/duotify/GitHubClawDev)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`抓取網址失敗：${url}（HTTP ${response.status}）`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    return generatePdfSummary(url, ai, systemPrompt, promptContext);
  }

  const html = await response.text();
  console.error('正在抽取正文...');
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();
  const raw = article?.textContent || document.querySelector('body')?.textContent || '';
  const { text, truncated } = trimContent(raw);
  if (text.length < MIN_CONTENT_LENGTH) throw new Error(`無法從頁面抽出足夠正文：${url}`);

  const prompt = buildPrompt({
    sourceType: '網頁',
    sourceMeta: {
      標題: normalizeText(article?.title || '未命名頁面'),
      網站: normalizeText(article?.siteName || '') || '未提供',
      作者: normalizeText(article?.byline || '') || '未提供',
      摘要: normalizeText(article?.excerpt || '') || '未提供',
      網址: url,
    },
    userPrompt: promptContext.userPrompt,
    contextJsonl: promptContext.contextJsonl,
    content: text,
    truncated,
  });

  const result = await ai.models.generateContent({
    model: MODELS.url,
    config: {
      systemInstruction: systemPrompt.trim(),
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return result.text ?? '';
}

async function generatePdfSummary(input: string, ai: GoogleGenAI, systemPrompt: string, promptContext: PromptContext): Promise<string> {
  console.error(`正在處理 PDF：${input}`);

  let buffer: Buffer;
  if (isRemoteUrl(input)) {
    const response = await fetchWithTimeout(input);
    if (!response.ok) throw new Error(`下載 PDF 失敗（HTTP ${response.status}）：${input}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    const local = input.startsWith('file://') ? fileURLToPath(input) : input;
    buffer = await readFile(path.resolve(local));
  }

  const displayName = path.basename(input.startsWith('http') ? new URL(input).pathname : input) || 'document.pdf';
  const pdfBytes = new Uint8Array(buffer);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  console.error('正在上傳 PDF 至 Vertex Files API...');
  let uploaded = await ai.files.upload({ file: blob, config: { mimeType: 'application/pdf', displayName } });
  while (uploaded.state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    uploaded = await ai.files.get({ name: uploaded.name });
  }
  if (uploaded.state === 'FAILED') throw new Error(`Vertex Files API 處理失敗：${uploaded.name}`);

  const result = await ai.models.generateContent({
    model: MODELS.pdf,
    config: {
      systemInstruction: systemPrompt.trim(),
    },
    contents: [{
      role: 'user',
      parts: [
        {
          text: buildPrompt({
            sourceType: 'PDF 文件',
            sourceMeta: {
              檔名: displayName,
              網址: isRemoteUrl(input) ? input : '未提供',
            },
            userPrompt: promptContext.userPrompt,
            contextJsonl: promptContext.contextJsonl,
          }),
        },
        { fileData: { mimeType: 'application/pdf', fileUri: uploaded.uri } },
      ],
    }],
  });

  await ai.files.delete({ name: uploaded.name }).catch(() => { });
  return result.text ?? '';
}

async function generateVideoOrAudioSummary(
  input: string,
  ai: GoogleGenAI,
  systemPrompt: string,
  promptContext: PromptContext,
  type: 'video' | 'audio',
): Promise<string> {
  console.error(`正在處理 ${type}：${input}`);

  let mediaPart:
    | { inlineData: { mimeType: string; data: string } }
    | { fileData: { mimeType: string; fileUri: string } };

  if (input.startsWith('data:')) {
    const mimeType = input.match(/^data:([^;]+);base64,/)?.[1] || 'video/mp4';
    const data = input.split('base64,')[1] || '';
    mediaPart = { inlineData: { mimeType, data } };
  } else if (isRemoteUrl(input)) {
    const ext = path.extname(new URL(input).pathname).toLowerCase();
    const mimeType = type === 'audio'
      ? (AUDIO_MIME_TYPES[ext] || 'audio/mpeg')
      : (VIDEO_MIME_TYPES[ext] || 'video/mp4');
    mediaPart = { fileData: { mimeType, fileUri: input } };
  } else {
    const local = input.startsWith('file://') ? fileURLToPath(input) : input;
    const buffer = await readFile(path.resolve(local));
    const ext = path.extname(local).toLowerCase();
    const mimeType = type === 'audio'
      ? (AUDIO_MIME_TYPES[ext] || 'audio/mpeg')
      : (VIDEO_MIME_TYPES[ext] || 'video/mp4');
    mediaPart = { inlineData: { mimeType, data: buffer.toString('base64') } };
  }

  const result = await ai.models.generateContent({
    model: type === 'audio' ? MODELS.audio : MODELS.video,
    config: {
      systemInstruction: systemPrompt.trim(),
    },
    contents: [{
      role: 'user',
      parts: [
        {
          text: buildPrompt({
            sourceType: type === 'audio' ? '音訊' : '影片',
            sourceMeta: { 網址: isRemoteUrl(input) ? input : '未提供' },
            userPrompt: promptContext.userPrompt,
            contextJsonl: promptContext.contextJsonl,
          }),
        },
        mediaPart,
      ],
    }],
  });

  return result.text ?? '';
}

async function main(): Promise<void> {
  const apiKey = process.env.VERTEXAI_API_KEY;
  if (!apiKey) throw new Error('缺少 VERTEXAI_API_KEY');

  const promptFile = process.env.PROMPT_FILE;
  if (!promptFile) throw new Error('缺少 PROMPT_FILE 環境變數');

  const userPrompt = await readUserPrompt(promptFile);
  const contextJsonlPath = await resolveContextJsonlPath();
  const contextJsonl = await readContextJsonl(contextJsonlPath);
  const promptContext: PromptContext = { userPrompt, contextJsonl };
  const resolvedInput = resolveInputFromUserPrompt(userPrompt);
  const input = resolvedInput.value;
  const type = resolvedInput.type === 'text' ? 'text' : detectInputType(input);
  const systemPrompt = await readSystemPrompt();

  console.error(`已讀取使用者提示：${path.resolve(promptFile)}`);
  console.error(`已讀取上下文 jsonl：${contextJsonlPath}`);
  console.error(`偵測到輸入類型：${type}`);

  const ai = new GoogleGenAI({ vertexai: true, apiKey, apiVersion: 'v1' });

  let summary = '';
  if (type === 'text') summary = await generateTextSummary(input, ai, systemPrompt, promptContext);
  else if (type === 'url') summary = await generateUrlSummary(input, ai, systemPrompt, promptContext);
  else if (type === 'pdf') summary = await generatePdfSummary(input, ai, systemPrompt, promptContext);
  else summary = await generateVideoOrAudioSummary(input, ai, systemPrompt, promptContext, type);

  process.stdout.write(`${summary}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
