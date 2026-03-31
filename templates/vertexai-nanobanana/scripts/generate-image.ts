import { GoogleGenAI } from '@google/genai';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

function buildUserPrompt(params: {
  userPrompt: string;
  contextJsonl: string;
}): string {
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
    '請先整合需求與上下文，輸出可直接用於影像生成的最終提示詞。',
    '若需要補充最新的公開資訊或查證內容，可以使用 Google Search。',
  ].join('\n');
}

async function main(): Promise<void> {
  const apiKey = normalizeText(process.env.VERTEXAI_API_KEY);
  if (!apiKey) throw new Error('缺少 VERTEXAI_API_KEY');

  const promptFile = process.env.PROMPT_FILE;
  if (!promptFile) throw new Error('缺少 PROMPT_FILE 環境變數');

  const issueDir = process.env.ISSUE_DIR;
  if (!issueDir) throw new Error('缺少 ISSUE_DIR 環境變數');
  const issueWorktree = process.env.ISSUE_WORKTREE ? path.resolve(process.env.ISSUE_WORKTREE) : null;

  const namePrefix = normalizeText(process.env.NAME_PREFIX) || 'image';
  const model = normalizeText(process.env.NANOBANANA_MODEL) || 'google/gemini-3-pro-image-preview';
  const userPrompt = await readUserPrompt(promptFile);
  const contextJsonlPath = await resolveContextJsonlPath();
  const contextJsonl = await readContextJsonl(contextJsonlPath);
  const systemPrompt = await readSystemPrompt();

  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey,
    apiVersion: 'v1',
  });

  console.error(`已讀取使用者提示：${path.resolve(promptFile)}`);
  console.error(`已讀取上下文 jsonl：${contextJsonlPath}`);

  const response = await ai.models.generateContent({
    model,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: buildUserPrompt({ userPrompt, contextJsonl }),
      }],
    }],
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
    throw new Error('Vertex AI response did not contain any image output.');
  }

  const resolvedIssueDir = path.resolve(issueDir);
  await mkdir(resolvedIssueDir, { recursive: true });

  let idx = 1;
  const savedFiles: string[] = [];
  for (const image of imageParts) {
    const extension = mimeToExtension(image.mimeType);
    const filePath = path.join(resolvedIssueDir, `${namePrefix}-${idx}${extension}`);
    await writeFile(filePath, Buffer.from(image.data, 'base64'));
    const relativePath = issueWorktree && filePath.startsWith(issueWorktree + path.sep)
      ? path.relative(issueWorktree, filePath)
      : path.relative(process.cwd(), filePath);
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
